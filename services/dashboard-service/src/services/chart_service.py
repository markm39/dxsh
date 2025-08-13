import json
import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class ChartService:
    """Service for generating structured chart data from input data using AI with OpenAI Structured Outputs"""
    
    # JSON Schemas for structured outputs
    CHART_SCHEMAS = {
        'bar': {
            "type": "json_schema",
            "json_schema": {
                "name": "bar_chart_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "chartType": {"type": "string", "enum": ["bar"]},
                        "title": {"type": "string"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "category": {"type": "string"},
                                    "value": {"type": "number"}
                                },
                                "required": ["category", "value"],
                                "additionalProperties": False
                            }
                        },
                        "xAxis": {"type": "string"},
                        "yAxis": {"type": "string"},
                        "error": {"type": "string"},
                        "reason": {"type": "string"}
                    },
                    "required": ["success", "chartType", "title", "data", "xAxis", "yAxis", "error", "reason"],
                    "additionalProperties": False
                }
            }
        },
        
        'line': {
            "type": "json_schema",
            "json_schema": {
                "name": "line_chart_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "chartType": {"type": "string", "enum": ["line"]},
                        "title": {"type": "string"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "x": {"type": "string"},
                                    "y": {"type": "number"}
                                },
                                "required": ["x", "y"],
                                "additionalProperties": False
                            }
                        },
                        "xAxis": {"type": "string"},
                        "yAxis": {"type": "string"},
                        "error": {"type": "string"},
                        "reason": {"type": "string"}
                    },
                    "required": ["success", "chartType", "title", "data", "xAxis", "yAxis", "error", "reason"],
                    "additionalProperties": False
                }
            }
        },
        
        'radar': {
            "type": "json_schema",
            "json_schema": {
                "name": "radar_chart_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "chartType": {"type": "string", "enum": ["radar"]},
                        "title": {"type": "string"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "subject": {"type": "string"},
                                    "values": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "metric": {"type": "string"},
                                                "value": {"type": "number"}
                                            },
                                            "required": ["metric", "value"],
                                            "additionalProperties": False
                                        }
                                    }
                                },
                                "required": ["subject", "values"],
                                "additionalProperties": False
                            }
                        },
                        "metricNames": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "error": {"type": "string"},
                        "reason": {"type": "string"}
                    },
                    "required": ["success", "chartType", "title", "data", "metricNames", "error", "reason"],
                    "additionalProperties": False
                }
            }
        }
    }
    
    SYSTEM_PROMPTS = {
        'bar': """You are a data visualization expert. Transform the input data into a structured format for a bar chart.

You must analyze the provided data and determine if it can be meaningfully represented as a bar chart. Follow these guidelines:

SUCCESS CASE (set success: true):
- Extract the most relevant categories and their corresponding numeric values
- If data lacks clear categories, intelligently group similar items together
- Ensure all values are numeric and meaningful for comparison
- Limit to 10-15 data points for optimal readability
- Create descriptive category names and an informative chart title
- Provide meaningful xAxis and yAxis labels
- Set data as an array of {category, value} objects
- Set error and reason to empty strings

ERROR CASE (set success: false):
- If data cannot be meaningfully represented as a bar chart
- Set data to empty array, xAxis and yAxis to empty strings
- Provide clear error message and detailed reason explaining why the data is unsuitable

The AI must intelligently infer structure from potentially unstructured data and make the best possible chart representation.""",

        'line': """You are a data visualization expert. Transform the input data into a structured format for a line chart.

You must analyze the provided data and determine if it can be meaningfully represented as a line chart. Follow these guidelines:

SUCCESS CASE (set success: true):
- Look for time-series data, sequences, trends, or progressive values
- X-axis should represent time, dates, sequential categories, or progression (as strings)
- Y-axis should contain numeric values showing change over the x-axis
- Sort data chronologically or sequentially if applicable
- Create meaningful axis labels and chart title
- Set data as an array of {x, y} objects
- Set error and reason to empty strings

ERROR CASE (set success: false):
- If data lacks temporal, sequential, or progressive aspects
- Set data to empty array, xAxis and yAxis to empty strings
- Provide clear error message and detailed reason explaining why the data is unsuitable

The AI must intelligently infer structure from potentially unstructured data and identify meaningful trends or sequences.""",

        'radar': """You are a data visualization expert. Transform the input data into a structured format for a radar chart.

You must analyze the provided data and determine if it can be meaningfully represented as a radar chart. Follow these guidelines:

SUCCESS CASE (set success: true):
- Identify items/subjects that have multiple comparable metrics or attributes
- Extract 3-8 key metrics per subject for optimal visualization
- Normalize values to 0-100 scale when possible for better comparison
- Ensure all metric values are numeric
- Create consistent metric names across all subjects
- Set data as array of {subject, values} objects where values is an array of {metric, value} objects
- List all metric names in the metricNames array
- Set error and reason to empty strings

ERROR CASE (set success: false):
- If data lacks multiple comparable metrics per item
- If data cannot be meaningfully compared across multiple dimensions
- Set data to empty array, metricNames to empty array
- Provide clear error message and detailed reason explaining why the data is unsuitable

The AI must intelligently infer structure from potentially unstructured data and identify meaningful multi-dimensional comparisons."""
    }

    @staticmethod
    def generate_chart_data(
        input_data: List[Any],
        chart_type: str,
        title: Optional[str] = None,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate structured chart data from input data using AI with OpenAI Structured Outputs
        
        Args:
            input_data: The raw data to transform
            chart_type: Type of chart ('bar', 'line', 'radar')
            title: Optional custom title for the chart
            custom_prompt: Optional custom system prompt
            
        Returns:
            Dict containing structured chart data or error information
        """
        try:
            logger.info(f"Generating chart with structured outputs: type={chart_type}, title={title}, data_length={len(input_data) if input_data else 0}")
            
            if chart_type not in ChartService.CHART_SCHEMAS:
                return {
                    'error': 'Invalid chart type',
                    'reason': f'Chart type must be one of: {list(ChartService.CHART_SCHEMAS.keys())}'
                }
            
            if not input_data:
                return {
                    'error': 'No input data provided',
                    'reason': 'Cannot generate chart from empty data'
                }
            
            # Use custom prompt or default system prompt
            system_prompt = custom_prompt or ChartService.SYSTEM_PROMPTS[chart_type]
            
            # Add custom title instruction if provided
            if title:
                system_prompt += f'\n\nUse this title for the chart: "{title}"'
            
            # Prepare user message with input data
            user_message = f"Transform this data into a {chart_type} chart:\n\n{json.dumps(input_data, indent=2)}"
            logger.info(f"User message length: {len(user_message)}, Input data sample: {str(input_data)[:200]}...")
            
            # Call OpenAI with structured outputs
            try:
                client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                
                # Use gpt-4o-2024-08-06 for structured outputs support
                openai_response = client.chat.completions.create(
                    model="gpt-4o-2024-08-06",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.3,
                    max_tokens=2000,
                    response_format=ChartService.CHART_SCHEMAS[chart_type]
                )
                
                ai_response = openai_response.choices[0].message.content
                tokens_used = openai_response.usage.total_tokens if openai_response.usage else 0
                
                logger.info(f"Structured output response received: {ai_response[:200]}...")
                
            except openai.RateLimitError:
                return {
                    'error': 'OpenAI API rate limit exceeded',
                    'reason': 'Please try again in a moment'
                }
            except openai.APIError as e:
                logger.error(f"OpenAI API error: {e}")
                return {
                    'error': 'OpenAI API error',
                    'reason': str(e)
                }
            except Exception as e:
                logger.error(f"Error calling OpenAI API: {e}")
                return {
                    'error': 'Failed to process with AI',
                    'reason': str(e)
                }
            
            # Parse the guaranteed JSON response (no markdown parsing needed with structured outputs)
            try:
                if not ai_response or not ai_response.strip():
                    return {
                        'error': 'Empty AI response',
                        'reason': 'OpenAI returned an empty response'
                    }
                
                chart_response = json.loads(ai_response)
                
                # Validate that we got a proper chart structure
                if isinstance(chart_response, dict):
                    # Check if the AI determined the data was suitable for the chart type
                    if chart_response.get('success', False):
                        # Successful chart generation
                        data = chart_response['data']
                        
                        # Transform radar chart data format from array of {metric, value} to {subject, metrics}
                        if chart_response['chartType'] == 'radar' and data:
                            data = [
                                {
                                    'subject': item['subject'],
                                    'metrics': {
                                        metric_obj['metric']: metric_obj['value'] 
                                        for metric_obj in item['values']
                                    }
                                }
                                for item in data
                            ]
                        
                        chart_data = {
                            'chartType': chart_response['chartType'],
                            'title': chart_response['title'],
                            'data': data,
                            'xAxis': chart_response.get('xAxis', ''),
                            'yAxis': chart_response.get('yAxis', ''),
                            'metrics': chart_response.get('metricNames', []),
                            'generated_at': datetime.now(timezone.utc).isoformat(),
                            'tokens_used': tokens_used,
                            'model': 'gpt-4o-2024-08-06'
                        }
                        
                        return {
                            'success': True,
                            'chart_data': chart_data,
                            'tokens_used': tokens_used
                        }
                    else:
                        # AI determined data was not suitable for this chart type
                        return {
                            'error': chart_response.get('error', 'Data not suitable for chart'),
                            'reason': chart_response.get('reason', 'AI determined the data cannot be meaningfully represented as this chart type')
                        }
                else:
                    return {
                        'error': 'Invalid chart data format',
                        'reason': 'AI response was not a valid JSON object'
                    }
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse structured output as JSON: {e}")
                logger.error(f"AI response was: {repr(ai_response)}")
                return {
                    'error': 'Invalid JSON response from structured output',
                    'reason': f'Unexpected JSON parsing error: {str(e)}'
                }
                
        except Exception as e:
            logger.error(f"Error generating chart data: {e}")
            return {
                'error': 'Chart generation failed',
                'reason': str(e)
            }

    @staticmethod
    def get_chart_types() -> List[Dict[str, str]]:
        """Get available chart types with descriptions"""
        return [
            {
                'value': 'bar',
                'label': 'Bar Chart',
                'description': 'Compare values across categories'
            },
            {
                'value': 'line', 
                'label': 'Line Chart',
                'description': 'Show trends over time'
            },
            {
                'value': 'radar',
                'label': 'Radar Chart', 
                'description': 'Compare multiple metrics'
            }
        ]
    
    @staticmethod
    def validate_chart_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate chart configuration"""
        required_fields = ['chartType']
        
        for field in required_fields:
            if field not in config:
                return {
                    'valid': False,
                    'error': f'Missing required field: {field}'
                }
        
        if config['chartType'] not in ChartService.CHART_SCHEMAS:
            return {
                'valid': False,
                'error': f'Invalid chart type: {config["chartType"]}'
            }
        
        return {'valid': True}