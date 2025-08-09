
from flask import request, jsonify
from app.api import api_bp
from app.auth import auth_required, get_current_user
from app.services.chart_service import ChartService
import openai
import logging
import os
import json

logger = logging.getLogger(__name__)

# Set OpenAI API key
openai.api_key = os.getenv('OPENAI_API_KEY')

@api_bp.route('/ai/process', methods=['POST'])
@auth_required
def process_with_ai():
    """Process data using OpenAI with custom prompts"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Required fields
        prompt = data.get('prompt')
        input_data = data.get('data', [])
        is_preview = data.get('preview', False)
        
        if not prompt:
            return jsonify({'success': False, 'error': 'Prompt is required'}), 400
        
        if not input_data:
            return jsonify({'success': False, 'error': 'Input data is required'}), 400
        
        # Prepare the data for AI processing
        data_str = json.dumps(input_data, indent=2)
        
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
            client = openai.OpenAI(api_key=openai.api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Use cost-effective model for data processing
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,  # Lower temperature for more consistent results
                max_tokens=2000 if is_preview else 4000
            )
            
            ai_output = response.choices[0].message.content
            
            return jsonify({
                'success': True,
                'output': ai_output,
                'model_used': 'gpt-4o-mini',
                'tokens_used': response.usage.total_tokens if response.usage else 0
            })
            
        except openai.RateLimitError:
            return jsonify({
                'success': False, 
                'error': 'OpenAI API rate limit exceeded. Please try again in a moment.'
            }), 429
            
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return jsonify({
                'success': False, 
                'error': f'OpenAI API error: {str(e)}'
            }), 500
            
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}")
            return jsonify({
                'success': False, 
                'error': 'Failed to process data with AI. Please try again.'
            }), 500
        
    except Exception as e:
        logger.error(f"Error in AI processing endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/ai/models', methods=['GET'])
@auth_required
def get_available_models():
    """Get list of available AI models"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Available models with their characteristics
        models = [
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
            }
        ]
        
        return jsonify({
            'success': True,
            'models': models
        })
        
    except Exception as e:
        logger.error(f"Error getting AI models: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/ai/chart/generate', methods=['POST'])
@auth_required
def generate_chart_data():
    """Generate structured chart data from input data using AI"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Required fields
        input_data = data.get('data', [])
        chart_type = data.get('chartType', 'bar')
        title = data.get('title')
        custom_prompt = data.get('customPrompt')
        
        if not input_data:
            return jsonify({'success': False, 'error': 'Input data is required'}), 400
        
        # Validate chart configuration
        config_validation = ChartService.validate_chart_config({
            'chartType': chart_type
        })
        
        if not config_validation['valid']:
            return jsonify({
                'success': False, 
                'error': config_validation['error']
            }), 400
        
        # Generate chart data using AI
        result = ChartService.generate_chart_data(
            input_data=input_data,
            chart_type=chart_type,
            title=title,
            custom_prompt=custom_prompt
        )
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'chart_data': result['chart_data'],
                'tokens_used': result.get('tokens_used', 0)
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Chart generation failed'),
                'reason': result.get('reason', 'Unknown error')
            }), 400
            
    except Exception as e:
        logger.error(f"Error in chart generation endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/ai/chart/types', methods=['GET'])
@auth_required
def get_chart_types():
    """Get available chart types"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        chart_types = ChartService.get_chart_types()
        
        return jsonify({
            'success': True,
            'chart_types': chart_types
        })
        
    except Exception as e:
        logger.error(f"Error getting chart types: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500