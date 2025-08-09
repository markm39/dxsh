"""
File Node API endpoints

Handles file loading and saving operations for various formats including
JSON, CSV, Excel, TXT, DOC, and others.
"""

import os
import json
import pandas as pd
import logging
from pathlib import Path
from werkzeug.utils import secure_filename
from flask import request, jsonify, current_app
from app.api import api_bp
from app.auth import auth_required, get_current_user

logger = logging.getLogger(__name__)

# Supported file extensions and their handlers
SUPPORTED_EXTENSIONS = {
    '.json': 'json',
    '.csv': 'csv', 
    '.xlsx': 'excel',
    '.xls': 'excel',
    '.txt': 'text',
    '.doc': 'document',
    '.docx': 'document'
}

# File upload configuration
UPLOAD_FOLDER = 'uploads'
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

def ensure_upload_directory():
    """Ensure upload directory exists"""
    upload_path = Path(current_app.instance_path) / UPLOAD_FOLDER
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path

def get_file_type(filename):
    """Get file type from filename extension"""
    ext = Path(filename).suffix.lower()
    return SUPPORTED_EXTENSIONS.get(ext, 'unknown')

def load_json_file(file_path, config):
    """Load JSON file"""
    try:
        with open(file_path, 'r', encoding=config.get('encoding', 'utf-8')) as f:
            data = json.load(f)
        
        # Handle max_rows for arrays
        if isinstance(data, list) and config.get('maxRows'):
            data = data[:config['maxRows']]
        
        # Skip rows if specified
        skip_rows = config.get('skipRows', 0)
        if isinstance(data, list) and skip_rows > 0:
            data = data[skip_rows:]
            
        return data
    except Exception as e:
        raise ValueError(f"Failed to load JSON file: {str(e)}")

def load_csv_file(file_path, config):
    """Load CSV file using pandas"""
    try:
        # Prepare pandas read_csv parameters
        pandas_args = {
            'encoding': config.get('encoding', 'utf-8'),
            'sep': config.get('delimiter', ','),
        }
        
        # Handle headers
        if not config.get('hasHeaders', True):
            pandas_args['header'] = None
        
        # Handle row limits and skipping
        if config.get('maxRows'):
            pandas_args['nrows'] = config['maxRows']
        
        if config.get('skipRows', 0) > 0:
            pandas_args['skiprows'] = config['skipRows']
        
        df = pd.read_csv(file_path, **pandas_args)
        
        # Convert to records (list of dicts)
        return df.to_dict('records')
    except Exception as e:
        raise ValueError(f"Failed to load CSV file: {str(e)}")

def load_excel_file(file_path, config):
    """Load Excel file using pandas"""
    try:
        # Prepare pandas read_excel parameters
        pandas_args = {
            'engine': 'openpyxl'
        }
        
        # Handle sheet name
        if config.get('sheetName'):
            pandas_args['sheet_name'] = config['sheetName']
        
        # Handle headers
        if not config.get('hasHeaders', True):
            pandas_args['header'] = None
        
        # Handle row limits and skipping
        if config.get('maxRows'):
            pandas_args['nrows'] = config['maxRows']
        
        if config.get('skipRows', 0) > 0:
            pandas_args['skiprows'] = config['skipRows']
        
        df = pd.read_excel(file_path, **pandas_args)
        
        # Convert to records (list of dicts)
        return df.to_dict('records')
    except Exception as e:
        raise ValueError(f"Failed to load Excel file: {str(e)}")

def load_text_file(file_path, config):
    """Load text file"""
    try:
        with open(file_path, 'r', encoding=config.get('encoding', 'utf-8')) as f:
            content = f.read()
        
        # Split into lines if needed
        lines = content.split('\n')
        
        # Handle skipping and max rows
        skip_rows = config.get('skipRows', 0)
        max_rows = config.get('maxRows')
        
        if skip_rows > 0:
            lines = lines[skip_rows:]
        
        if max_rows:
            lines = lines[:max_rows]
        
        # Return as list of line objects
        return [{'line_number': i + 1, 'content': line} for i, line in enumerate(lines)]
    except Exception as e:
        raise ValueError(f"Failed to load text file: {str(e)}")

def load_document_file(file_path, config):
    """Load Word document (requires python-docx)"""
    try:
        # Try to import docx, fallback to basic text reading if not available
        try:
            from docx import Document
            doc = Document(file_path)
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            
            # Handle skipping and max rows
            skip_rows = config.get('skipRows', 0)
            max_rows = config.get('maxRows')
            
            if skip_rows > 0:
                paragraphs = paragraphs[skip_rows:]
            
            if max_rows:
                paragraphs = paragraphs[:max_rows]
            
            return [{'paragraph_number': i + 1, 'content': para} for i, para in enumerate(paragraphs)]
        except ImportError:
            # Fallback to basic file reading
            return load_text_file(file_path, config)
    except Exception as e:
        raise ValueError(f"Failed to load document file: {str(e)}")

def save_json_file(file_path, data, config):
    """Save data as JSON file"""
    try:
        with open(file_path, 'w', encoding=config.get('encoding', 'utf-8')) as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return {"success": True, "records_saved": len(data) if isinstance(data, list) else 1}
    except Exception as e:
        raise ValueError(f"Failed to save JSON file: {str(e)}")

def save_csv_file(file_path, data, config):
    """Save data as CSV file"""
    try:
        # Convert to DataFrame
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            df = pd.DataFrame(data)
        else:
            raise ValueError("Data must be a list of dictionaries for CSV export")
        
        # Save CSV
        csv_args = {
            'index': False,
            'encoding': config.get('encoding', 'utf-8'),
            'sep': config.get('delimiter', ',')
        }
        
        df.to_csv(file_path, **csv_args)
        return {"success": True, "records_saved": len(df)}
    except Exception as e:
        raise ValueError(f"Failed to save CSV file: {str(e)}")

def save_excel_file(file_path, data, config):
    """Save data as Excel file"""
    try:
        # Convert to DataFrame
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            df = pd.DataFrame(data)
        else:
            raise ValueError("Data must be a list of dictionaries for Excel export")
        
        # Save Excel
        excel_args = {
            'index': False,
            'engine': 'openpyxl'
        }
        
        df.to_excel(file_path, **excel_args)
        return {"success": True, "records_saved": len(df)}
    except Exception as e:
        raise ValueError(f"Failed to save Excel file: {str(e)}")

def save_text_file(file_path, data, config):
    """Save data as text file"""
    try:
        with open(file_path, 'w', encoding=config.get('encoding', 'utf-8')) as f:
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        # Extract content field or convert to string
                        content = item.get('content', str(item))
                        f.write(f"{content}\n")
                    else:
                        f.write(f"{item}\n")
            else:
                f.write(str(data))
        
        return {"success": True, "records_saved": len(data) if isinstance(data, list) else 1}
    except Exception as e:
        raise ValueError(f"Failed to save text file: {str(e)}")

@api_bp.route('/file-node/upload', methods=['POST'])
@auth_required
def upload_file():
    """Upload a file for processing"""
    try:
        current_user = get_current_user()
        user_id = current_user.user_id
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Validate file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'success': False, 'error': f'File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB'}), 400
        
        # Validate file type
        file_type = get_file_type(file.filename)
        if file_type == 'unknown':
            return jsonify({'success': False, 'error': 'Unsupported file type'}), 400
        
        # Secure filename and create user-specific directory
        filename = secure_filename(file.filename)
        upload_dir = ensure_upload_directory() / str(user_id)
        upload_dir.mkdir(exist_ok=True)
        
        file_path = upload_dir / filename
        file.save(str(file_path))
        
        logger.info(f"User {user_id} uploaded file: {filename} ({file_size} bytes)")
        
        return jsonify({
            'success': True,
            'filePath': str(file_path),
            'fileName': filename,
            'fileSize': file_size,
            'fileType': file_type
        })
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/file-node/load', methods=['POST'])
@auth_required
def load_file():
    """Load data from a file"""
    try:
        current_user = get_current_user()
        user_id = current_user.user_id
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        config = data or {}
        
        file_path = config.get('filePath')
        if not file_path:
            return jsonify({'success': False, 'error': 'File path is required'}), 400
        
        # Validate file exists and user has access
        file_path = Path(file_path)
        if not file_path.exists():
            return jsonify({'success': False, 'error': 'File not found'}), 404
        
        # Basic security check - ensure file is in user's upload directory
        upload_dir = ensure_upload_directory() / str(user_id)
        try:
            file_path.resolve().relative_to(upload_dir.resolve())
        except ValueError:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Determine file type and load accordingly
        file_type = get_file_type(file_path.name)
        
        if file_type == 'json':
            loaded_data = load_json_file(file_path, config)
        elif file_type == 'csv':
            loaded_data = load_csv_file(file_path, config)
        elif file_type == 'excel':
            loaded_data = load_excel_file(file_path, config)
        elif file_type == 'text':
            loaded_data = load_text_file(file_path, config)
        elif file_type == 'document':
            loaded_data = load_document_file(file_path, config)
        else:
            return jsonify({'success': False, 'error': f'Unsupported file type: {file_type}'}), 400
        
        # Add metadata if requested
        result = {
            'success': True,
            'data': loaded_data,
            'fileType': file_type,
            'recordCount': len(loaded_data) if isinstance(loaded_data, list) else 1
        }
        
        if config.get('includeMetadata'):
            result['metadata'] = {
                'fileName': file_path.name,
                'fileSize': file_path.stat().st_size,
                'lastModified': file_path.stat().st_mtime
            }
        
        logger.info(f"User {user_id} loaded file: {file_path.name} ({result['recordCount']} records)")
        return jsonify(result)
        
    except ValueError as e:
        logger.error(f"File loading error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error loading file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/file-node/save', methods=['POST'])
@auth_required
def save_file():
    """Save data to a file"""
    try:
        current_user = get_current_user()
        user_id = current_user.user_id
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        config = data or {}
        input_data = data.get('inputData', [])
        
        output_filename = config.get('outputFileName')
        if not output_filename:
            return jsonify({'success': False, 'error': 'Output filename is required'}), 400
        
        # Secure filename
        filename = secure_filename(output_filename)
        
        # Determine output directory
        if config.get('outputPath'):
            output_dir = Path(config['outputPath'])
        else:
            output_dir = ensure_upload_directory() / str(user_id)
        
        # Create directories if needed
        if config.get('createDirectories', True):
            output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / filename
        
        # Check if file exists and handle overwrite setting
        if output_path.exists() and not config.get('overwriteExisting', False):
            return jsonify({'success': False, 'error': 'File already exists and overwrite is disabled'}), 400
        
        # Determine file type and save accordingly
        file_type = get_file_type(filename)
        
        if file_type == 'json':
            result = save_json_file(output_path, input_data, config)
        elif file_type == 'csv':
            result = save_csv_file(output_path, input_data, config)
        elif file_type == 'excel':
            result = save_excel_file(output_path, input_data, config)
        elif file_type == 'text':
            result = save_text_file(output_path, input_data, config)
        else:
            return jsonify({'success': False, 'error': f'Unsupported output file type: {file_type}'}), 400
        
        result.update({
            'filePath': str(output_path),
            'fileName': filename,
            'fileType': file_type
        })
        
        logger.info(f"User {user_id} saved file: {filename} ({result['records_saved']} records)")
        return jsonify(result)
        
    except ValueError as e:
        logger.error(f"File saving error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error saving file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/file-node/preview', methods=['POST'])
@auth_required
def preview_file():
    """Preview file content (limited rows)"""
    try:
        current_user = get_current_user()
        user_id = current_user.user_id
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        config = data or {}
        
        # Force a low max rows for preview
        config['maxRows'] = min(config.get('maxRows', 10), 10)
        
        # Use the same logic as load_file but with limited rows
        return load_file()
        
    except Exception as e:
        logger.error(f"Error previewing file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500