"""
AI Processor Executor

Processes data using OpenAI with custom prompts
Extracted from backend/app/api/ai_processing.py
"""

import json
import logging
import os
from typing import Dict, Any, List, Optional
import openai
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class AiProcessorExecutor(BaseNodeExecutor):
    """Execute AI processing nodes using OpenAI models"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'aiProcessor'
        
        # Set up OpenAI client
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            logger.warning("OPENAI_API_KEY not found in environment variables")
    
    def validate_config(self) -> bool:
        """Validate AI processor node configuration"""
        try:
            data = self.node_config.get('data', {})
            
            # Required fields
            if not data.get('prompt'):
                logger.error("AI processor node requires 'prompt' field")
                return False
            
            # Optional fields with defaults
            model = data.get('model', 'gpt-4o-mini')
            temperature = data.get('temperature', 0.3)
            max_tokens = data.get('max_tokens', 4000)
            
            # Validate model
            valid_models = ['gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo']
            if model not in valid_models:
                logger.error(f"Invalid model: {model}. Must be one of: {valid_models}")
                return False
            
            # Validate temperature
            if not isinstance(temperature, (int, float)) or temperature < 0 or temperature > 2:
                logger.error(f"Invalid temperature: {temperature}. Must be between 0 and 2")
                return False
            
            # Validate max_tokens
            if not isinstance(max_tokens, int) or max_tokens < 1 or max_tokens > 128000:
                logger.error(f"Invalid max_tokens: {max_tokens}. Must be between 1 and 128000")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating AI processor config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute AI processing node"""
        try:
            if not self.openai_api_key:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
                    metadata={}
                )
            
            # Get configuration
            data = self.node_config.get('data', {})
            prompt = data.get('prompt')
            model = data.get('model', 'gpt-4o-mini')
            temperature = data.get('temperature', 0.3)
            max_tokens = data.get('max_tokens', 4000)
            is_preview = data.get('preview', False)
            
            # Use input data or fallback to configured data
            processing_data = input_data if input_data is not None else data.get('input_data', [])
            
            if not processing_data:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No input data provided for AI processing",
                    metadata={}
                )
            
            # Prepare data for AI processing
            data_str = json.dumps(processing_data, indent=2) if isinstance(processing_data, (list, dict)) else str(processing_data)
            
            # System message for AI processing
            system_message = """You are an AI data processing assistant. Your role is to:

1. Analyze the provided structured data carefully
2. Follow the user's specific instructions exactly  
3. Provide clear, actionable insights and results
4. Format your response in a readable way
5. Be concise but comprehensive
6. If the data seems to be from web scraping, consider the context and structure

Always focus on being helpful and providing value through your analysis."""

            # User message combining prompt and data
            user_message = f"""Please process the following data according to these instructions:

INSTRUCTIONS:
{prompt}

DATA TO PROCESS:
{data_str}

Please provide your analysis and results based on the instructions above."""

            # Call OpenAI API
            try:
                client = openai.OpenAI(api_key=self.openai_api_key)
                
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens if not is_preview else min(max_tokens, 2000)
                )
                
                ai_output = response.choices[0].message.content
                tokens_used = response.usage.total_tokens if response.usage else 0
                
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=True,
                    data={
                        'ai_output': ai_output,
                        'ai_metadata': {
                            'model': model,
                            'tokens_used': {
                                'total_tokens': tokens_used,
                                'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
                                'completion_tokens': response.usage.completion_tokens if response.usage else 0
                            },
                            'temperature': temperature,
                            'max_tokens': max_tokens,
                            'finish_reason': response.choices[0].finish_reason if response.choices else 'stop'
                        },
                        'prompt_used': prompt
                    },
                    error=None,
                    metadata={
                        'model': model,
                        'temperature': temperature,
                        'max_tokens': max_tokens,
                        'tokens_used': tokens_used,
                        'input_data_type': type(processing_data).__name__,
                        'input_data_length': len(processing_data) if isinstance(processing_data, (list, dict, str)) else 1
                    }
                )
                
            except openai.RateLimitError:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="OpenAI API rate limit exceeded. Please try again in a moment.",
                    metadata={'error_type': 'rate_limit'}
                )
                
            except openai.APIError as e:
                logger.error(f"OpenAI API error: {e}")
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=f"OpenAI API error: {str(e)}",
                    metadata={'error_type': 'api_error', 'error_details': str(e)}
                )
                
            except Exception as e:
                logger.error(f"Error calling OpenAI API: {e}")
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="Failed to process data with AI. Please check your configuration and try again.",
                    metadata={'error_type': 'execution_error', 'error_details': str(e)}
                )
        
        except Exception as e:
            logger.error(f"Error in AI processor execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"AI processor execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    @staticmethod
    def get_available_models() -> List[Dict[str, Any]]:
        """Get list of available AI models"""
        return [
            {
                'id': 'gpt-4o-mini',
                'name': 'GPT-4o Mini',
                'description': 'Fast and cost-effective for most data processing tasks',
                'cost_per_1k_tokens': 0.00015,
                'max_tokens': 128000,
                'recommended': True
            },
            {
                'id': 'gpt-4o',
                'name': 'GPT-4o',
                'description': 'More powerful for complex analysis and reasoning',
                'cost_per_1k_tokens': 0.0025,
                'max_tokens': 128000,
                'recommended': False
            },
            {
                'id': 'gpt-4',
                'name': 'GPT-4',
                'description': 'High-quality reasoning for complex tasks',
                'cost_per_1k_tokens': 0.03,
                'max_tokens': 8000,
                'recommended': False
            },
            {
                'id': 'gpt-3.5-turbo',
                'name': 'GPT-3.5 Turbo',
                'description': 'Fast and efficient for simple tasks',
                'cost_per_1k_tokens': 0.0005,
                'max_tokens': 4000,
                'recommended': False
            }
        ]