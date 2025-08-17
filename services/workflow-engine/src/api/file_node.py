"""
File Node API endpoints for file upload, processing, and management
Handles CSV, Excel, JSON, text, and document files with comprehensive processing options
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import logging
import os
import json
import pandas as pd
import tempfile
import shutil
from pathlib import Path
from werkzeug.utils import secure_filename
import asyncio
import aiofiles
from datetime import datetime

from ..auth import get_current_user, AuthUser
from ..database import get_db
from ..models import WorkflowExecution, NodeExecution

router = APIRouter(prefix="/api/v1/file-node", tags=["file-node"])
logger = logging.getLogger(__name__)

# Configuration
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
UPLOAD_DIR = Path("uploads")
SUPPORTED_EXTENSIONS = {
    '.json': 'json',
    '.csv': 'csv', 
    '.xlsx': 'excel',
    '.xls': 'excel',
    '.txt': 'text',
    '.doc': 'document',
    '.docx': 'document'
}

# Ensure upload directory exists
UPLOAD_DIR.mkdir(exist_ok=True)

def get_user_upload_dir(user_id: int) -> Path:
    """Get user-specific upload directory"""
    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(exist_ok=True)
    return user_dir

def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return Path(filename).suffix.lower() in SUPPORTED_EXTENSIONS

def get_file_type(filename: str) -> str:
    """Get file type from extension"""
    ext = Path(filename).suffix.lower()
    return SUPPORTED_EXTENSIONS.get(ext, 'unknown')

async def save_upload_file(upload_file: UploadFile, destination: Path) -> int:
    """Save uploaded file to destination and return file size"""
    file_size = 0
    async with aiofiles.open(destination, 'wb') as f:
        while chunk := await upload_file.read(8192):  # Read in 8KB chunks
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                await f.close()
                destination.unlink(missing_ok=True)  # Delete partial file
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
                )
            await f.write(chunk)
    return file_size

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Upload a file for processing
    Supports JSON, CSV, Excel, text, and document files up to 16MB
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        if not is_allowed_file(file.filename):
            supported = ", ".join(SUPPORTED_EXTENSIONS.keys())
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Supported types: {supported}"
            )
        
        # Generate secure filename
        secure_name = secure_filename(file.filename)
        if not secure_name:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Add timestamp to prevent conflicts
        name_parts = secure_name.rsplit('.', 1)
        if len(name_parts) == 2:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            secure_name = f"{name_parts[0]}_{timestamp}.{name_parts[1]}"
        
        # Create user directory and file path
        user_dir = get_user_upload_dir(current_user.user_id)
        file_path = user_dir / secure_name
        
        # Save file
        file_size = await save_upload_file(file, file_path)
        
        logger.info(f"User {current_user.user_id} uploaded file: {secure_name} ({file_size} bytes)")
        
        return {
            "success": True,
            "message": "File uploaded successfully",
            "file": {
                "path": str(file_path),
                "name": secure_name,
                "original_name": file.filename,
                "size": file_size,
                "type": get_file_type(secure_name),
                "uploaded_at": datetime.now().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

def load_json_file(file_path: Path, max_rows: Optional[int] = None, encoding: str = 'utf-8') -> List[Dict[str, Any]]:
    """Load JSON file with optional row limiting"""
    try:
        with open(file_path, 'r', encoding=encoding) as f:
            data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(data, list):
            return data[:max_rows] if max_rows else data
        elif isinstance(data, dict):
            return [data]
        else:
            return [{"value": data}]
            
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading JSON file: {str(e)}")

def load_csv_file(
    file_path: Path, 
    delimiter: str = ',',
    has_headers: bool = True,
    max_rows: Optional[int] = None,
    skip_rows: int = 0,
    encoding: str = 'utf-8'
) -> List[Dict[str, Any]]:
    """Load CSV file using pandas"""
    try:
        # Read CSV with pandas
        df = pd.read_csv(
            file_path,
            delimiter=delimiter,
            header=0 if has_headers else None,
            nrows=max_rows,
            skiprows=skip_rows,
            encoding=encoding,
            na_filter=False  # Don't convert strings like 'NA' to NaN
        )
        
        # Convert to list of dictionaries
        return df.to_dict('records')
        
    except pd.errors.EmptyDataError:
        return []
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV file: {str(e)}")

def load_excel_file(
    file_path: Path,
    sheet_name: Optional[str] = None,
    has_headers: bool = True,
    max_rows: Optional[int] = None,
    skip_rows: int = 0
) -> List[Dict[str, Any]]:
    """Load Excel file using pandas"""
    try:
        # Read Excel with pandas
        df = pd.read_excel(
            file_path,
            sheet_name=sheet_name or 0,  # Default to first sheet
            header=0 if has_headers else None,
            nrows=max_rows,
            skiprows=skip_rows,
            engine='openpyxl',
            na_filter=False
        )
        
        return df.to_dict('records')
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")

def load_text_file(
    file_path: Path,
    max_rows: Optional[int] = None,
    encoding: str = 'utf-8'
) -> List[Dict[str, Any]]:
    """Load text file line by line"""
    try:
        data = []
        with open(file_path, 'r', encoding=encoding) as f:
            for line_num, line in enumerate(f, 1):
                data.append({
                    "line_number": line_num,
                    "content": line.rstrip('\n\r')
                })
                if max_rows and len(data) >= max_rows:
                    break
        
        return data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading text file: {str(e)}")

def load_document_file(file_path: Path, max_rows: Optional[int] = None) -> List[Dict[str, Any]]:
    """Load document file (Word docs)"""
    try:
        # Try to import python-docx
        try:
            from docx import Document
            
            doc = Document(file_path)
            data = []
            
            for para_num, paragraph in enumerate(doc.paragraphs, 1):
                if paragraph.text.strip():  # Skip empty paragraphs
                    data.append({
                        "paragraph_number": para_num,
                        "content": paragraph.text
                    })
                    if max_rows and len(data) >= max_rows:
                        break
            
            return data
            
        except ImportError:
            # Fall back to text processing if python-docx not available
            logger.warning("python-docx not available, falling back to text processing")
            return load_text_file(file_path, max_rows)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading document file: {str(e)}")

@router.post("/load")
async def load_file(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Load and parse file content into structured data
    Supports various file formats with extensive configuration options
    """
    try:
        # Validate required fields
        file_path = request_data.get('filePath')
        if not file_path:
            raise HTTPException(status_code=400, detail="filePath is required")
        
        # Security: Ensure file belongs to current user
        path_obj = Path(file_path)
        user_dir = get_user_upload_dir(current_user.user_id)
        
        if path_obj.is_absolute():
            # Absolute path - use directly but ensure it's within user directory
            full_path = path_obj
            try:
                full_path.resolve().relative_to(user_dir.resolve())
            except ValueError:
                raise HTTPException(status_code=403, detail="Access denied to file outside user directory")
        else:
            # Relative path - check if it already includes user directory structure
            if str(path_obj).startswith(f"uploads/{current_user.user_id}/"):
                # Path already includes user directory from root
                full_path = Path(path_obj)
            else:
                # Path is relative to user directory
                full_path = user_dir / path_obj
        
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Extract parameters
        encoding = request_data.get('encoding', 'utf-8')
        delimiter = request_data.get('delimiter', ',')
        has_headers = request_data.get('hasHeaders', True)
        max_rows = request_data.get('maxRows')
        skip_rows = request_data.get('skipRows', 0)
        sheet_name = request_data.get('sheetName')
        include_metadata = request_data.get('includeMetadata', False)
        
        # Determine file type and load accordingly
        file_type = get_file_type(full_path.name)
        
        if file_type == 'json':
            data = load_json_file(full_path, max_rows, encoding)
        elif file_type == 'csv':
            data = load_csv_file(full_path, delimiter, has_headers, max_rows, skip_rows, encoding)
        elif file_type == 'excel':
            data = load_excel_file(full_path, sheet_name, has_headers, max_rows, skip_rows)
        elif file_type == 'text':
            data = load_text_file(full_path, max_rows, encoding)
        elif file_type == 'document':
            data = load_document_file(full_path, max_rows)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")
        
        # Sanitize data to handle NaN and Infinity values that can't be JSON serialized
        def sanitize_value(value):
            """Clean NaN and Infinity values for JSON serialization"""
            if isinstance(value, float):
                import math
                if math.isnan(value) or math.isinf(value):
                    return None
            return value
        
        def sanitize_data(obj):
            """Recursively sanitize data structure"""
            if isinstance(obj, dict):
                return {k: sanitize_data(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [sanitize_data(item) for item in obj]
            else:
                return sanitize_value(obj)
        
        # Clean the data
        sanitized_data = sanitize_data(data)
        
        # Prepare response
        response = {
            "success": True,
            "data": sanitized_data,
            "row_count": len(sanitized_data),
            "file_type": file_type
        }
        
        # Add metadata if requested
        if include_metadata:
            file_stat = full_path.stat()
            response["metadata"] = {
                "file_size": file_stat.st_size,
                "modified_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                "file_name": full_path.name,
                "file_extension": full_path.suffix,
                "encoding": encoding if file_type in ['json', 'csv', 'text'] else None,
                "delimiter": delimiter if file_type == 'csv' else None,
                "has_headers": has_headers if file_type in ['csv', 'excel'] else None,
                "sheet_name": sheet_name if file_type == 'excel' else None
            }
        
        logger.info(f"User {current_user.user_id} loaded file: {full_path.name} ({len(data)} rows)")
        
        # Save execution data for dashboard widgets (same pattern as other nodes)
        node_id = request_data.get('nodeId')
        agent_id = request_data.get('agentId')
        
        if node_id and agent_id:
            try:
                # Create or get workflow execution
                workflow_execution = WorkflowExecution(
                    agent_id=agent_id,
                    user_id=current_user.user_id,
                    workflow_nodes=[{"id": node_id, "type": "fileNode"}],
                    workflow_edges=[],
                    status='completed',
                    started_at=datetime.utcnow(),
                    completed_at=datetime.utcnow()
                )
                db.add(workflow_execution)
                db.commit()
                db.refresh(workflow_execution)
                
                # Create node execution record
                node_execution = NodeExecution(
                    node_id=node_id,
                    node_type='fileNode',
                    execution_id=workflow_execution.id,
                    status='completed',
                    started_at=datetime.utcnow(),
                    completed_at=datetime.utcnow(),
                    output_data=sanitized_data,
                    input_config={
                        'file_path': str(full_path),
                        'file_type': file_type,
                        'encoding': encoding,
                        'delimiter': delimiter,
                        'has_headers': has_headers,
                        'max_rows': max_rows,
                        'skip_rows': skip_rows
                    },
                    node_specific_data={
                        'file_size': full_path.stat().st_size,
                        'file_name': full_path.name,
                        'row_count': len(sanitized_data)
                    }
                )
                db.add(node_execution)
                db.commit()
                
                logger.info(f" Saved file node execution: node_id={node_id}, agent_id={agent_id}, execution_id={workflow_execution.id}")
                
            except Exception as e:
                logger.error(f"Failed to save file node execution: {e}")
                # Don't fail the entire request if execution tracking fails
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File load error for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load file: {str(e)}")

@router.post("/preview")
async def preview_file(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Preview first 10 rows of file content
    Same parameters as load endpoint but limited to 10 rows
    """
    # Force max_rows to 10 for preview
    request_data['maxRows'] = 10
    return await load_file(request_data, current_user)

def save_json_file(data: List[Dict[str, Any]], file_path: Path, encoding: str = 'utf-8'):
    """Save data as JSON file"""
    with open(file_path, 'w', encoding=encoding) as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def save_csv_file(
    data: List[Dict[str, Any]], 
    file_path: Path, 
    delimiter: str = ',',
    encoding: str = 'utf-8'
):
    """Save data as CSV file"""
    if not data:
        # Create empty CSV file
        with open(file_path, 'w', encoding=encoding) as f:
            f.write('')
        return
    
    df = pd.DataFrame(data)
    df.to_csv(file_path, sep=delimiter, index=False, encoding=encoding)

def save_excel_file(data: List[Dict[str, Any]], file_path: Path):
    """Save data as Excel file"""
    if not data:
        # Create empty Excel file
        df = pd.DataFrame()
    else:
        df = pd.DataFrame(data)
    
    df.to_excel(file_path, index=False, engine='openpyxl')

def save_text_file(data: List[Dict[str, Any]], file_path: Path, encoding: str = 'utf-8'):
    """Save data as text file"""
    with open(file_path, 'w', encoding=encoding) as f:
        for item in data:
            if isinstance(item, dict):
                # Convert dict to string representation
                if 'content' in item:
                    f.write(str(item['content']) + '\n')
                else:
                    f.write(str(item) + '\n')
            else:
                f.write(str(item) + '\n')

@router.post("/save")
async def save_file(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Save structured data to file
    Supports JSON, CSV, Excel, and text formats
    """
    try:
        # Validate required fields
        input_data = request_data.get('inputData')
        output_filename = request_data.get('outputFileName')
        
        if not input_data:
            raise HTTPException(status_code=400, detail="inputData is required")
        if not output_filename:
            raise HTTPException(status_code=400, detail="outputFileName is required")
        
        # Validate input data format
        if not isinstance(input_data, list):
            raise HTTPException(status_code=400, detail="inputData must be an array")
        
        # Extract parameters
        output_path = request_data.get('outputPath')
        overwrite_existing = request_data.get('overwriteExisting', False)
        create_directories = request_data.get('createDirectories', True)
        encoding = request_data.get('encoding', 'utf-8')
        delimiter = request_data.get('delimiter', ',')
        
        # Determine output directory
        if output_path:
            # Custom output path (must be within user directory for security)
            user_dir = get_user_upload_dir(current_user.user_id)
            output_dir = user_dir / output_path
        else:
            output_dir = get_user_upload_dir(current_user.user_id)
        
        # Create directories if needed
        if create_directories:
            output_dir.mkdir(parents=True, exist_ok=True)
        
        # Secure filename
        secure_name = secure_filename(output_filename)
        if not secure_name:
            raise HTTPException(status_code=400, detail="Invalid output filename")
        
        full_path = output_dir / secure_name
        
        # Check if file exists
        if full_path.exists() and not overwrite_existing:
            raise HTTPException(
                status_code=409, 
                detail="File already exists. Set overwriteExisting=true to overwrite"
            )
        
        # Determine output format from file extension
        file_type = get_file_type(secure_name)
        
        # Save file based on type
        if file_type == 'json':
            save_json_file(input_data, full_path, encoding)
        elif file_type == 'csv':
            save_csv_file(input_data, full_path, delimiter, encoding)
        elif file_type == 'excel':
            save_excel_file(input_data, full_path)
        elif file_type == 'text':
            save_text_file(input_data, full_path, encoding)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported output format: {file_type}")
        
        # Get file size
        file_size = full_path.stat().st_size
        
        logger.info(f"User {current_user.user_id} saved file: {secure_name} ({len(input_data)} records, {file_size} bytes)")
        
        return {
            "success": True,
            "message": "File saved successfully",
            "file": {
                "path": str(full_path),
                "name": secure_name,
                "size": file_size,
                "type": file_type,
                "records_saved": len(input_data),
                "saved_at": datetime.now().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File save error for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")