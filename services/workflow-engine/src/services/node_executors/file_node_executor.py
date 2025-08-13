"""
File Node Executor

Handles file loading and saving operations for various formats
Extracted and simplified from backend/app/api/file_node.py
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
import pandas as pd
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class FileNodeExecutor(BaseNodeExecutor):
    """Execute file operations (load/save) nodes"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'fileNode'
        
        # Supported file extensions and their handlers
        self.supported_extensions = {
            '.json': 'json',
            '.csv': 'csv', 
            '.xlsx': 'excel',
            '.xls': 'excel',
            '.txt': 'text',
        }
    
    def validate_config(self) -> bool:
        """Validate file node configuration"""
        try:
            data = self.node_config.get('data', {})
            
            operation = data.get('operation', 'load')
            if operation not in ['load', 'save']:
                logger.error(f"Invalid file operation: {operation}. Must be 'load' or 'save'")
                return False
            
            if operation == 'load':
                if not data.get('file_path') and not data.get('file_data'):
                    logger.error("File load operation requires 'file_path' or 'file_data' field")
                    return False
            
            elif operation == 'save':
                if not data.get('file_path'):
                    logger.error("File save operation requires 'file_path' field")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating file node config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute file node operation"""
        try:
            data = self.node_config.get('data', {})
            operation = data.get('operation', 'load')
            
            if operation == 'load':
                return await self._load_file(data, input_data)
            elif operation == 'save':
                return await self._save_file(data, input_data)
            else:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=f"Unsupported file operation: {operation}",
                    metadata={}
                )
        
        except Exception as e:
            logger.error(f"Error in file node execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"File node execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    async def _load_file(self, config: Dict[str, Any], input_data: Optional[Any]) -> NodeExecutionResult:
        """Load file based on configuration"""
        try:
            # Check for data in different possible locations
            file_data = None
            file_path = None
            
            # First check for frontend React Flow node structure: data.fileNode.executionResult
            file_node_config = config.get('fileNode', {})
            if file_node_config.get('executionResult'):
                file_data = file_node_config['executionResult']
                file_path = file_node_config.get('filePath')
                logger.info(f"Found execution result data with {len(file_data) if isinstance(file_data, list) else 1} items")
            
            # Fallback to direct data fields
            if not file_data:
                file_data = config.get('file_data')
                file_path = config.get('file_path') or file_node_config.get('filePath')
            
            if file_data:
                # Direct data provided (already loaded from frontend)
                data = file_data
                logger.info(f"Using cached file data: {len(data) if isinstance(data, list) else 1} items")
            elif file_path:
                # Load from file path
                if not os.path.exists(file_path):
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error=f"File not found: {file_path}",
                        metadata={'file_path': file_path}
                    )
                
                file_type = self._get_file_type(file_path)
                data = self._load_by_type(file_path, file_type, config)
                logger.info(f"Loaded file data from disk: {len(data) if isinstance(data, list) else 1} items")
            else:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No file data or file path provided",
                    metadata={}
                )
            
            # Apply any filtering or processing
            processed_data = self._process_loaded_data(data, config)
            
            return NodeExecutionResult(
                node_id=self.node_id,
                success=True,
                data=processed_data,
                error=None,
                metadata={
                    'file_type': self._get_file_type(file_path) if file_path else 'direct_data',
                    'data_size': len(processed_data) if isinstance(processed_data, (list, dict, str)) else 1,
                    'file_path': file_path or 'direct_data'
                }
            )
            
        except Exception as e:
            logger.error(f"Error loading file: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Failed to load file: {str(e)}",
                metadata={'error_type': 'load_error'}
            )
    
    async def _save_file(self, config: Dict[str, Any], input_data: Optional[Any]) -> NodeExecutionResult:
        """Save data to file"""
        try:
            if input_data is None:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No input data to save",
                    metadata={}
                )
            
            file_path = config.get('file_path')
            if not file_path:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No file path specified for save operation",
                    metadata={}
                )
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            file_type = self._get_file_type(file_path)
            self._save_by_type(input_data, file_path, file_type, config)
            
            return NodeExecutionResult(
                node_id=self.node_id,
                success=True,
                data={'file_path': file_path, 'message': 'File saved successfully'},
                error=None,
                metadata={
                    'file_type': file_type,
                    'file_path': file_path,
                    'data_size': len(input_data) if isinstance(input_data, (list, dict, str)) else 1
                }
            )
            
        except Exception as e:
            logger.error(f"Error saving file: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Failed to save file: {str(e)}",
                metadata={'error_type': 'save_error'}
            )
    
    def _get_file_type(self, filename: str) -> str:
        """Get file type from filename extension"""
        ext = Path(filename).suffix.lower()
        return self.supported_extensions.get(ext, 'unknown')
    
    def _load_by_type(self, file_path: str, file_type: str, config: Dict[str, Any]) -> Any:
        """Load file based on its type"""
        if file_type == 'json':
            with open(file_path, 'r', encoding=config.get('encoding', 'utf-8')) as f:
                return json.load(f)
        
        elif file_type == 'csv':
            df = pd.read_csv(
                file_path,
                encoding=config.get('encoding', 'utf-8'),
                sep=config.get('delimiter', ','),
                nrows=config.get('maxRows'),
                skiprows=config.get('skipRows', 0)
            )
            return df.to_dict('records')
        
        elif file_type == 'excel':
            df = pd.read_excel(
                file_path,
                engine='openpyxl',
                sheet_name=config.get('sheetName', 0),
                nrows=config.get('maxRows'),
                skiprows=config.get('skipRows', 0)
            )
            return df.to_dict('records')
        
        elif file_type == 'text':
            with open(file_path, 'r', encoding=config.get('encoding', 'utf-8')) as f:
                content = f.read()
                if config.get('splitLines', False):
                    return content.splitlines()
                return content
        
        else:
            # Unknown type, try to read as text
            with open(file_path, 'r', encoding=config.get('encoding', 'utf-8')) as f:
                return f.read()
    
    def _save_by_type(self, data: Any, file_path: str, file_type: str, config: Dict[str, Any]):
        """Save data based on file type"""
        if file_type == 'json':
            with open(file_path, 'w', encoding=config.get('encoding', 'utf-8')) as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        
        elif file_type == 'csv':
            if isinstance(data, list) and data and isinstance(data[0], dict):
                df = pd.DataFrame(data)
                df.to_csv(
                    file_path, 
                    index=False,
                    encoding=config.get('encoding', 'utf-8'),
                    sep=config.get('delimiter', ',')
                )
            else:
                # Convert to simple CSV format
                with open(file_path, 'w', encoding=config.get('encoding', 'utf-8')) as f:
                    if isinstance(data, list):
                        for item in data:
                            f.write(f"{item}\n")
                    else:
                        f.write(str(data))
        
        elif file_type == 'excel':
            if isinstance(data, list) and data and isinstance(data[0], dict):
                df = pd.DataFrame(data)
                df.to_excel(file_path, index=False, engine='openpyxl')
            else:
                # Simple Excel format
                df = pd.DataFrame([data] if not isinstance(data, list) else data)
                df.to_excel(file_path, index=False, engine='openpyxl')
        
        elif file_type == 'text':
            with open(file_path, 'w', encoding=config.get('encoding', 'utf-8')) as f:
                if isinstance(data, (list, dict)):
                    f.write(json.dumps(data, indent=2))
                else:
                    f.write(str(data))
        
        else:
            # Default to JSON
            with open(file_path, 'w', encoding=config.get('encoding', 'utf-8')) as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _process_loaded_data(self, data: Any, config: Dict[str, Any]) -> Any:
        """Apply any post-processing to loaded data"""
        # Apply max rows limit for lists
        if isinstance(data, list) and config.get('maxRows'):
            data = data[:config['maxRows']]
        
        # Skip rows if specified for lists
        skip_rows = config.get('skipRows', 0)
        if isinstance(data, list) and skip_rows > 0:
            data = data[skip_rows:]
        
        return data