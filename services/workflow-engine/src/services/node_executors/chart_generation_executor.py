"""
Chart Generation Executor

AI-powered chart generation using ChartService
Extracted from ai_processing.py chart endpoints
"""

import logging
from typing import Dict, Any, Optional
from .base_executor import BaseNodeExecutor, NodeExecutionResult
from ..chart_service import ChartService

logger = logging.getLogger(__name__)


class ChartGenerationExecutor(BaseNodeExecutor):
    """Execute chart generation nodes using AI"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'chartGenerator'
    
    def validate_config(self) -> bool:
        """Validate chart generation node configuration"""
        try:
            data = self.node_config.get('data', {})
            
            # Validate chart type
            chart_type = data.get('chartType', 'bar')
            valid_types = list(ChartService.CHART_SCHEMAS.keys())
            if chart_type not in valid_types:
                logger.error(f"Invalid chart type: {chart_type}. Must be one of: {valid_types}")
                return False
            
            # Validate chart configuration
            config_validation = ChartService.validate_chart_config({'chartType': chart_type})
            if not config_validation['valid']:
                logger.error(f"Chart config validation failed: {config_validation['error']}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating chart generation config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute chart generation node"""
        try:
            # Get configuration
            data = self.node_config.get('data', {})
            chart_type = data.get('chartType', 'bar')
            title = data.get('title')
            custom_prompt = data.get('customPrompt')
            
            # Use input data or fallback to configured data
            chart_data = input_data if input_data is not None else data.get('inputData', [])
            
            if not chart_data:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No input data provided for chart generation",
                    metadata={}
                )
            
            # Generate chart data using ChartService
            result = ChartService.generate_chart_data(
                input_data=chart_data if isinstance(chart_data, list) else [chart_data],
                chart_type=chart_type,
                title=title,
                custom_prompt=custom_prompt
            )
            
            if result.get('success'):
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=True,
                    data={
                        'chart_data': result['chart_data'],
                        'tokens_used': result.get('tokens_used', 0),
                        'chart_type': chart_type
                    },
                    error=None,
                    metadata={
                        'chart_type': chart_type,
                        'tokens_used': result.get('tokens_used', 0),
                        'has_title': bool(title),
                        'has_custom_prompt': bool(custom_prompt),
                        'input_data_length': len(chart_data) if isinstance(chart_data, list) else 1
                    }
                )
            else:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=result.get('error', 'Chart generation failed'),
                    metadata={
                        'chart_type': chart_type,
                        'error_reason': result.get('reason', 'Unknown error'),
                        'error_type': 'chart_generation_failed'
                    }
                )
        
        except Exception as e:
            logger.error(f"Error in chart generation execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Chart generation execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    @staticmethod
    def get_supported_chart_types():
        """Get list of supported chart types"""
        return ChartService.get_chart_types()