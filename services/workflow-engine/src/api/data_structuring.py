"""
Data Structuring API endpoints for regex-based data extraction and transformation
Supports pattern matching, data cleaning, and structured data extraction
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
import logging
import re
import json
from datetime import datetime

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/data-structuring", tags=["data-structuring"])
logger = logging.getLogger(__name__)

def apply_regex_pattern(text: str, pattern: str, flags: int = 0) -> List[Dict[str, Any]]:
    """
    Apply regex pattern to text and return matches with groups
    """
    try:
        compiled_pattern = re.compile(pattern, flags)
        matches = []
        
        for match in compiled_pattern.finditer(text):
            match_data = {
                'match': match.group(0),
                'start': match.start(),
                'end': match.end(),
                'groups': list(match.groups()),
                'groupdict': match.groupdict()
            }
            matches.append(match_data)
        
        return matches
    except re.error as e:
        raise ValueError(f"Invalid regex pattern: {str(e)}")

def clean_and_structure_data(data: Any, cleaning_rules: Dict[str, Any]) -> Any:
    """
    Apply cleaning rules to data
    """
    if not cleaning_rules.get('enabled', False):
        return data
    
    # Convert to string for processing
    if not isinstance(data, str):
        data = str(data)
    
    # Apply cleaning rules
    if cleaning_rules.get('trim', False):
        data = data.strip()
    
    if cleaning_rules.get('removeExtraSpaces', False):
        data = re.sub(r'\s+', ' ', data)
    
    if cleaning_rules.get('removeNewlines', False):
        data = data.replace('\n', ' ').replace('\r', ' ')
    
    if cleaning_rules.get('toLowerCase', False):
        data = data.lower()
    
    if cleaning_rules.get('toUpperCase', False):
        data = data.upper()
    
    # Custom replacements
    replacements = cleaning_rules.get('replacements', [])
    for replacement in replacements:
        if replacement.get('from') and replacement.get('to') is not None:
            if replacement.get('useRegex', False):
                try:
                    data = re.sub(replacement['from'], replacement['to'], data)
                except re.error:
                    logger.warning(f"Invalid regex in replacement: {replacement['from']}")
            else:
                data = data.replace(replacement['from'], replacement['to'])
    
    return data

def extract_structured_data(text: str, extraction_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured data using multiple patterns
    """
    results = {}
    patterns = extraction_config.get('patterns', [])
    
    for pattern_config in patterns:
        pattern_name = pattern_config.get('name', 'unnamed')
        pattern = pattern_config.get('pattern', '')
        flags = 0
        
        # Set regex flags
        flag_config = pattern_config.get('flags', {})
        if flag_config.get('ignoreCase', False):
            flags |= re.IGNORECASE
        if flag_config.get('multiline', False):
            flags |= re.MULTILINE
        if flag_config.get('dotAll', False):
            flags |= re.DOTALL
        
        try:
            matches = apply_regex_pattern(text, pattern, flags)
            
            # Process matches based on configuration
            if pattern_config.get('extractFirst', False):
                results[pattern_name] = matches[0] if matches else None
            elif pattern_config.get('extractAll', False):
                results[pattern_name] = matches
            else:
                # Extract specific groups or full match
                group_names = pattern_config.get('groupNames', [])
                if group_names and matches:
                    extracted = {}
                    for match in matches:
                        for i, group_name in enumerate(group_names):
                            if i < len(match['groups']):
                                extracted[group_name] = match['groups'][i]
                    results[pattern_name] = extracted
                else:
                    results[pattern_name] = [m['match'] for m in matches]
        
        except Exception as e:
            logger.error(f"Error applying pattern '{pattern_name}': {e}")
            results[pattern_name] = None
    
    return results

@router.post("/test")
async def test_data_structuring(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Test data structuring configuration without saving to database
    """
    try:
        logger.info(f"Data structuring test called with data keys: {list(request_data.keys())}")
        
        # Get input data and configuration
        input_text = request_data.get('inputText', '')
        config = request_data.get('config', {})
        
        if not input_text:
            raise HTTPException(status_code=400, detail="Input text is required")
        
        # Apply data cleaning
        cleaned_data = clean_and_structure_data(input_text, config.get('cleaning', {}))
        
        # Extract structured data
        extraction_results = {}
        if config.get('extraction', {}).get('enabled', False):
            extraction_results = extract_structured_data(cleaned_data, config.get('extraction', {}))
        
        # Apply single pattern if provided
        pattern_results = []
        if config.get('pattern'):
            flags = 0
            flag_config = config.get('flags', {})
            if flag_config.get('ignoreCase', False):
                flags |= re.IGNORECASE
            if flag_config.get('multiline', False):
                flags |= re.MULTILINE
            if flag_config.get('dotAll', False):
                flags |= re.DOTALL
            
            pattern_results = apply_regex_pattern(cleaned_data, config['pattern'], flags)
        
        result = {
            'success': True,
            'original_text': input_text,
            'cleaned_data': cleaned_data,
            'pattern_matches': pattern_results,
            'extraction_results': extraction_results,
            'match_count': len(pattern_results),
            'tested_at': datetime.now().isoformat()
        }
        
        logger.info(f"User {current_user.user_id} tested data structuring with {len(pattern_results)} matches")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Data structuring test failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.post("/execute")
async def execute_data_structuring(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Execute data structuring for workflow execution
    """
    try:
        # Get input data from the request
        input_data = request_data.get('inputData', {})
        config = request_data.get('config', request_data)
        
        # Determine input text source
        input_text = ''
        if isinstance(input_data, str):
            input_text = input_data
        elif isinstance(input_data, dict):
            # Try common field names for text data
            text_fields = ['text', 'content', 'data', 'output', 'result']
            for field in text_fields:
                if field in input_data and isinstance(input_data[field], str):
                    input_text = input_data[field]
                    break
            
            # If no text field found, convert entire input to string
            if not input_text:
                input_text = json.dumps(input_data)
        elif isinstance(input_data, list):
            # Join list items into text
            input_text = '\n'.join(str(item) for item in input_data)
        else:
            input_text = str(input_data)
        
        if not input_text:
            raise HTTPException(status_code=400, detail="No input text found")
        
        # Apply data cleaning
        cleaned_data = clean_and_structure_data(input_text, config.get('cleaning', {}))
        
        # Extract structured data
        extraction_results = {}
        if config.get('extraction', {}).get('enabled', False):
            extraction_results = extract_structured_data(cleaned_data, config.get('extraction', {}))
        
        # Apply single pattern if provided
        pattern_results = []
        if config.get('pattern'):
            flags = 0
            flag_config = config.get('flags', {})
            if flag_config.get('ignoreCase', False):
                flags |= re.IGNORECASE
            if flag_config.get('multiline', False):
                flags |= re.MULTILINE
            if flag_config.get('dotAll', False):
                flags |= re.DOTALL
            
            pattern_results = apply_regex_pattern(cleaned_data, config['pattern'], flags)
        
        # Determine output format
        output_format = config.get('outputFormat', 'structured')
        
        if output_format == 'matches_only':
            output_data = [match['match'] for match in pattern_results]
        elif output_format == 'first_match':
            output_data = pattern_results[0]['match'] if pattern_results else None
        elif output_format == 'groups_only':
            output_data = [match['groups'] for match in pattern_results]
        elif output_format == 'cleaned_text':
            output_data = cleaned_data
        else:  # 'structured' or default
            output_data = {
                'cleaned_data': cleaned_data,
                'matches': pattern_results,
                'extractions': extraction_results,
                'match_count': len(pattern_results)
            }
        
        logger.info(f"User {current_user.user_id} executed data structuring with {len(pattern_results)} matches")
        
        return {
            'success': True,
            'output': output_data,
            'metadata': {
                'original_length': len(input_text),
                'cleaned_length': len(cleaned_data),
                'match_count': len(pattern_results),
                'extraction_count': len(extraction_results),
                'output_format': output_format
            },
            'executed_at': datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Data structuring execution failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")

@router.get("/patterns")
async def get_common_patterns(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of common regex patterns for data extraction
    """
    return {
        'success': True,
        'patterns': [
            {
                'name': 'Email Address',
                'pattern': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                'description': 'Extract email addresses'
            },
            {
                'name': 'Phone Number (US)',
                'pattern': r'\b(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b',
                'description': 'Extract US phone numbers'
            },
            {
                'name': 'URL',
                'pattern': r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?',
                'description': 'Extract URLs'
            },
            {
                'name': 'IP Address',
                'pattern': r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
                'description': 'Extract IP addresses'
            },
            {
                'name': 'Date (MM/DD/YYYY)',
                'pattern': r'\b(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])/([12][0-9]{3})\b',
                'description': 'Extract dates in MM/DD/YYYY format'
            },
            {
                'name': 'Currency (USD)',
                'pattern': r'\$\s?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)',
                'description': 'Extract USD currency amounts'
            },
            {
                'name': 'Credit Card',
                'pattern': r'\b(?:[0-9]{4}[-\s]?){3}[0-9]{4}\b',
                'description': 'Extract credit card numbers'
            },
            {
                'name': 'Social Security Number',
                'pattern': r'\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b',
                'description': 'Extract SSN in XXX-XX-XXXX format'
            },
            {
                'name': 'Hashtag',
                'pattern': r'#\w+',
                'description': 'Extract hashtags'
            },
            {
                'name': 'Mention (@username)',
                'pattern': r'@\w+',
                'description': 'Extract mentions/usernames'
            }
        ]
    }

@router.get("/cleaning-options")
async def get_cleaning_options(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get list of available data cleaning options
    """
    return {
        'success': True,
        'cleaning_options': [
            {
                'id': 'trim',
                'name': 'Trim Whitespace',
                'description': 'Remove leading and trailing spaces'
            },
            {
                'id': 'removeExtraSpaces',
                'name': 'Remove Extra Spaces',
                'description': 'Replace multiple spaces with single space'
            },
            {
                'id': 'removeNewlines',
                'name': 'Remove Newlines',
                'description': 'Replace newlines with spaces'
            },
            {
                'id': 'toLowerCase',
                'name': 'Convert to Lowercase',
                'description': 'Convert all text to lowercase'
            },
            {
                'id': 'toUpperCase',
                'name': 'Convert to Uppercase',
                'description': 'Convert all text to uppercase'
            },
            {
                'id': 'replacements',
                'name': 'Custom Replacements',
                'description': 'Apply custom find/replace operations'
            }
        ]
    }