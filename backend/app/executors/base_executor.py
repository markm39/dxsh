"""
Base Executor Class

Provides the common interface and functionality for all node executors.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class BaseExecutor(ABC):
    """Base class for all node executors"""
    
    def __init__(self, node_config: Dict[str, Any]):
        """
        Initialize the executor with node configuration
        
        Args:
            node_config: The node configuration from the workflow
        """
        self.node_config = node_config
        self.node_id = node_config.get('id')
        self.node_type = node_config.get('type')
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def execute(self, input_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute the node with given input data
        
        Args:
            input_data: Data from previous nodes in the workflow
            
        Returns:
            Dictionary containing the execution result
        """
        pass
    
    def validate_config(self) -> bool:
        """
        Validate the node configuration
        
        Returns:
            True if configuration is valid, False otherwise
        """
        if not self.node_id or not self.node_type:
            self.logger.error(f"Missing required node configuration: id={self.node_id}, type={self.node_type}")
            return False
        return True
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value with optional default
        
        Args:
            key: Configuration key to retrieve
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        return self.node_config.get(key, default)
    
    def log_execution_start(self):
        """Log the start of node execution"""
        self.logger.info(f"Starting execution of {self.node_type} node (ID: {self.node_id})")
    
    def log_execution_complete(self, result_summary: str = ""):
        """Log the completion of node execution"""
        self.logger.info(f"Completed execution of {self.node_type} node (ID: {self.node_id}). {result_summary}")
    
    def log_execution_error(self, error: Exception):
        """Log an execution error"""
        self.logger.error(f"Error executing {self.node_type} node (ID: {self.node_id}): {error}")
    
    def create_error_result(self, error: str, details: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Create a standardized error result
        
        Args:
            error: Error message
            details: Optional additional error details
            
        Returns:
            Standardized error result dictionary
        """
        return {
            'success': False,
            'error': error,
            'node_id': self.node_id,
            'node_type': self.node_type,
            'details': details or {}
        }
    
    def create_success_result(self, data: Any, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Create a standardized success result
        
        Args:
            data: The result data
            metadata: Optional metadata about the execution
            
        Returns:
            Standardized success result dictionary
        """
        return {
            'success': True,
            'data': data,
            'node_id': self.node_id,
            'node_type': self.node_type,
            'metadata': metadata or {}
        }