"""
Data Structuring API

Endpoints for regex-based data structuring and text parsing.
"""

from flask import request, jsonify
from app.api import api_bp
from app.services.data_structuring_service import data_structuring_service
from app.auth import auth_required, get_current_user
import logging

logger = logging.getLogger(__name__)


@api_bp.route('/data-structuring/structure', methods=['POST'])
@auth_required
def structure_data():
    """
    Extract structured data using regex patterns
    
    Expected JSON payload:
    {
        "input_data": [...],  # List of data items to parse
        "patterns": [...],    # List of regex pattern configurations
        "output_format": "object",  # "object" or "array"
        "skip_empty_matches": true
    }
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Extract parameters
        input_data = data.get('input_data', [])
        patterns = data.get('patterns', [])
        output_format = data.get('output_format', 'object')
        skip_empty_matches = data.get('skip_empty_matches', True)
        
        # Validate input
        if not input_data:
            return jsonify({'error': 'No input data provided'}), 400
        
        if not patterns:
            return jsonify({'error': 'No patterns provided'}), 400
        
        # Validate patterns first
        validation_result = data_structuring_service.validate_patterns(patterns)
        if not validation_result['valid']:
            return jsonify({
                'error': 'Invalid patterns',
                'validation_errors': validation_result['errors'],
                'warnings': validation_result.get('warnings', [])
            }), 400
        
        # Process data
        result = data_structuring_service.structure_data(
            input_data=input_data,
            patterns=patterns,
            output_format=output_format,
            skip_empty_matches=skip_empty_matches
        )
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 500
        
    except Exception as e:
        logger.error(f"Data structuring API error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@api_bp.route('/data-structuring/validate-patterns', methods=['POST'])
@auth_required
def validate_patterns():
    """
    Validate regex patterns for syntax errors
    
    Expected JSON payload:
    {
        "patterns": [...]  # List of regex pattern configurations
    }
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        patterns = data.get('patterns', [])
        if not patterns:
            return jsonify({'error': 'No patterns provided'}), 400
        
        # Validate patterns
        validation_result = data_structuring_service.validate_patterns(patterns)
        
        return jsonify(validation_result), 200
        
    except Exception as e:
        logger.error(f"Pattern validation API error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@api_bp.route('/data-structuring/test-pattern', methods=['POST'])
@auth_required
def test_single_pattern():
    """
    Test a single regex pattern against sample text
    
    Expected JSON payload:
    {
        "pattern": {
            "regex": "...",
            "flags": "...", 
            "type": "text"
        },
        "test_text": "Sample text to test against"
    }
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        pattern_config = data.get('pattern', {})
        test_text = data.get('test_text', '')
        
        if not pattern_config.get('regex'):
            return jsonify({'error': 'No regex pattern provided'}), 400
        
        if not test_text:
            return jsonify({'error': 'No test text provided'}), 400
        
        # Test the pattern
        result = data_structuring_service.structure_data(
            input_data=[{'full_text': test_text}],
            patterns=[pattern_config],
            output_format='object',
            skip_empty_matches=False
        )
        
        return jsonify({
            'success': True,
            'test_result': result.get('results', [{}])[0] if result.get('results') else {},
            'pattern_valid': result.get('success', False)
        }), 200
        
    except Exception as e:
        logger.error(f"Pattern test API error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@api_bp.route('/data-structuring/sample-patterns/<data_type>', methods=['GET'])
@auth_required
def get_sample_patterns(data_type):
    """
    Get sample regex patterns for common data types
    
    Supported data types:
    - sports_player: Patterns for parsing sports player data (on3.com style)
    - contact_info: Patterns for parsing contact information
    - financial: Patterns for parsing financial data
    - generic: Basic patterns for common text extraction
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        sample_patterns = {
            'sports_player': [
                {
                    'id': 'rank',
                    'name': 'Rank',
                    'regex': '^(\\d+)\\.',
                    'flags': 'm',
                    'type': 'number',
                    'description': 'Player ranking number'
                },
                {
                    'id': 'position',
                    'name': 'Position', 
                    'regex': '\\}([A-Z]{1,3})(?=[A-Z][a-z])',
                    'flags': '',
                    'type': 'text',
                    'description': 'Player position (QB, RB, etc.)'
                },
                {
                    'id': 'name',
                    'name': 'Player Name',
                    'regex': '([A-Z][a-z]+ [A-Z][a-z]+)(?=\\d{4})',
                    'flags': '',
                    'type': 'text',
                    'description': 'Player first and last name'
                },
                {
                    'id': 'year',
                    'name': 'Class Year',
                    'regex': '(\\d{4})/',
                    'flags': '',
                    'type': 'number',
                    'description': 'Graduation year'
                },
                {
                    'id': 'rating',
                    'name': 'Composite Rating',
                    'regex': '\\)(\\d{2}\\.\\d+)',
                    'flags': '',
                    'type': 'number',
                    'description': 'Composite rating score'
                }
            ],
            'contact_info': [
                {
                    'id': 'email',
                    'name': 'Email',
                    'regex': '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
                    'flags': 'i',
                    'type': 'text',
                    'description': 'Email addresses'
                },
                {
                    'id': 'phone',
                    'name': 'Phone Number',
                    'regex': r'(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})',
                    'flags': '',
                    'type': 'text',
                    'description': 'US phone numbers'
                },
                {
                    'id': 'website',
                    'name': 'Website',
                    'regex': r'(https?://[^\s]+)',
                    'flags': 'i',
                    'type': 'url',
                    'description': 'Website URLs'
                }
            ],
            'financial': [
                {
                    'id': 'currency',
                    'name': 'Currency Amount',
                    'regex': r'\$([\d,]+\.?\d*)',
                    'flags': '',
                    'type': 'number',
                    'description': 'Dollar amounts'
                },
                {
                    'id': 'percentage',
                    'name': 'Percentage',
                    'regex': r'(\d+(?:\.\d+)?)%',
                    'flags': '',
                    'type': 'number',
                    'description': 'Percentage values'
                }
            ],
            'generic': [
                {
                    'id': 'numbers',
                    'name': 'Numbers',
                    'regex': r'(\d+(?:\.\d+)?)',
                    'flags': 'g',
                    'type': 'number',
                    'description': 'Any numeric values'
                },
                {
                    'id': 'dates',
                    'name': 'Dates',
                    'regex': r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
                    'flags': '',
                    'type': 'text',
                    'description': 'Date patterns (MM/DD/YYYY, etc.)'
                },
                {
                    'id': 'words',
                    'name': 'Words',
                    'regex': r'([A-Za-z]+)',
                    'flags': 'g',
                    'type': 'text',
                    'description': 'Individual words'
                }
            ]
        }
        
        if data_type not in sample_patterns:
            return jsonify({
                'error': f'Unknown data type: {data_type}',
                'available_types': list(sample_patterns.keys())
            }), 400
        
        return jsonify({
            'data_type': data_type,
            'patterns': sample_patterns[data_type]
        }), 200
        
    except Exception as e:
        logger.error(f"Sample patterns API error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500