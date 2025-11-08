"""
Base Node Module

Base class for creating custom workflow nodes.
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)


@dataclass
class NodeExecutionResult:
    """Result of a node execution."""
    success: bool
    data: Any
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    execution_time_ms: float = 0.0


class BaseNode(ABC):
    """
    Base class for custom workflow nodes.

    Extend this class to create custom node types.
    """

    # Node metadata - override in subclass
    node_type: str = "custom"
    node_name: str = "Custom Node"
    node_description: str = "A custom workflow node"
    node_category: str = "custom"

    # Input/output schemas - override in subclass
    input_schema: Dict[str, Any] = {}
    output_schema: Dict[str, Any] = {}

    def __init__(self, node_config: Optional[Dict[str, Any]] = None):
        """
        Initialize node.

        Args:
            node_config: Node configuration from workflow definition
        """
        self.config = node_config or {}
        self.node_id = self.config.get('id', '')
        self.node_data = self.config.get('data', {})

    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> NodeExecutionResult:
        """
        Execute the node logic.

        Args:
            input_data: Input data for the node

        Returns:
            NodeExecutionResult with output data
        """
        pass

    async def validate_inputs(self, input_data: Dict[str, Any]) -> bool:
        """
        Validate input data against schema.

        Args:
            input_data: Input data to validate

        Returns:
            True if valid

        Raises:
            ValueError: If validation fails
        """
        if not self.input_schema:
            return True

        for field, field_config in self.input_schema.items():
            required = field_config.get('required', False)
            field_type = field_config.get('type')

            if required and field not in input_data:
                raise ValueError(f"Missing required input field: {field}")

            if field in input_data and field_type:
                value = input_data[field]
                if not self._check_type(value, field_type):
                    raise ValueError(
                        f"Invalid type for field {field}: "
                        f"expected {field_type}, got {type(value).__name__}"
                    )

        return True

    async def validate_outputs(self, output_data: Any) -> bool:
        """
        Validate output data against schema.

        Args:
            output_data: Output data to validate

        Returns:
            True if valid

        Raises:
            ValueError: If validation fails
        """
        if not self.output_schema:
            return True

        output_type = self.output_schema.get('type')
        if output_type and not self._check_type(output_data, output_type):
            raise ValueError(
                f"Invalid output type: "
                f"expected {output_type}, got {type(output_data).__name__}"
            )

        return True

    def _check_type(self, value: Any, expected_type: str) -> bool:
        """
        Check if value matches expected type.

        Args:
            value: Value to check
            expected_type: Expected type string

        Returns:
            True if type matches
        """
        type_mapping = {
            'string': str,
            'number': (int, float),
            'boolean': bool,
            'object': dict,
            'array': list,
            'any': object
        }

        expected_python_type = type_mapping.get(expected_type, object)
        return isinstance(value, expected_python_type)

    def get_config_value(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value from node data.

        Args:
            key: Configuration key
            default: Default value if not found

        Returns:
            Configuration value
        """
        return self.node_data.get(key, default)

    def log_info(self, message: str):
        """Log info message."""
        logger.info(f"[{self.node_id}] {message}")

    def log_error(self, message: str):
        """Log error message."""
        logger.error(f"[{self.node_id}] {message}")

    def log_warning(self, message: str):
        """Log warning message."""
        logger.warning(f"[{self.node_id}] {message}")

    def success(
        self,
        data: Any,
        metadata: Optional[Dict[str, Any]] = None
    ) -> NodeExecutionResult:
        """
        Create a success result.

        Args:
            data: Output data
            metadata: Optional metadata

        Returns:
            NodeExecutionResult
        """
        return NodeExecutionResult(
            success=True,
            data=data,
            metadata=metadata
        )

    def failure(
        self,
        error: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> NodeExecutionResult:
        """
        Create a failure result.

        Args:
            error: Error message
            metadata: Optional metadata

        Returns:
            NodeExecutionResult
        """
        return NodeExecutionResult(
            success=False,
            data=None,
            error=error,
            metadata=metadata
        )

    @classmethod
    def get_node_definition(cls) -> Dict[str, Any]:
        """
        Get node definition for registration.

        Returns:
            Node definition dict
        """
        return {
            'type': cls.node_type,
            'name': cls.node_name,
            'description': cls.node_description,
            'category': cls.node_category,
            'input_schema': cls.input_schema,
            'output_schema': cls.output_schema
        }


class SimpleNode(BaseNode):
    """
    Simplified node class for basic transformations.

    Use this for simple nodes that just transform data.
    """

    @abstractmethod
    async def process(self, input_data: Dict[str, Any]) -> Any:
        """
        Process input data and return output.

        Args:
            input_data: Input data

        Returns:
            Output data
        """
        pass

    async def execute(self, input_data: Dict[str, Any]) -> NodeExecutionResult:
        """
        Execute the node by calling process method.

        Args:
            input_data: Input data

        Returns:
            NodeExecutionResult
        """
        try:
            await self.validate_inputs(input_data)
            output = await self.process(input_data)
            await self.validate_outputs(output)

            return self.success(output)

        except Exception as e:
            self.log_error(f"Execution failed: {e}")
            return self.failure(str(e))


class AsyncNode(BaseNode):
    """
    Base class for async nodes that may take time.

    Includes progress reporting capabilities.
    """

    def __init__(self, node_config: Optional[Dict[str, Any]] = None):
        """Initialize async node."""
        super().__init__(node_config)
        self.progress = 0.0
        self.status_message = ""

    def update_progress(self, progress: float, message: str = ""):
        """
        Update node execution progress.

        Args:
            progress: Progress percentage (0-100)
            message: Optional status message
        """
        self.progress = min(100.0, max(0.0, progress))
        self.status_message = message

        self.log_info(f"Progress: {self.progress:.1f}% - {message}")

    def get_progress(self) -> Dict[str, Any]:
        """
        Get current progress.

        Returns:
            Progress dict
        """
        return {
            'progress': self.progress,
            'status': self.status_message
        }
