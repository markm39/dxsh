"""
Data Structuring Service

Provides regex-based text parsing to extract structured data from unstructured text.
Useful for parsing scraped data, logs, or any text with consistent patterns.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional, Union

logger = logging.getLogger(__name__)


class DataStructuringService:
    """Service for extracting structured data using regex patterns"""
    
    def __init__(self):
        self.logger = logger
    
    def structure_data(self, 
                      input_data: List[Dict[str, Any]], 
                      patterns: List[Dict[str, Any]], 
                      output_format: str = 'object',
                      skip_empty_matches: bool = True) -> Dict[str, Any]:
        """
        Extract structured data from input using regex patterns
        
        Args:
            input_data: List of dictionaries containing text data
            patterns: List of regex pattern configurations
            output_format: 'object' or 'array' format for output
            skip_empty_matches: Whether to skip fields with no matches
            
        Returns:
            Dictionary with results and metadata
        """
        try:
            results = []
            
            for item_idx, item in enumerate(input_data):
                try:
                    # Get text to parse from item
                    text = self._extract_text_from_item(item)
                    if not text:
                        continue
                    
                    # Apply each pattern to extract fields
                    extracted_data = self._apply_patterns(text, patterns, skip_empty_matches)
                    
                    if extracted_data or not skip_empty_matches:
                        # Add metadata
                        extracted_data['_source_index'] = item_idx
                        extracted_data['_original_text'] = text[:200] + ('...' if len(text) > 200 else '')
                        results.append(extracted_data)
                        
                except Exception as e:
                    self.logger.error(f"Error processing item {item_idx}: {str(e)}")
                    if not skip_empty_matches:
                        results.append({
                            '_source_index': item_idx,
                            '_error': str(e),
                            '_original_text': str(item)[:200]
                        })
            
            return {
                'success': True,
                'results': results,
                'total_processed': len(input_data),
                'successful_extractions': len(results),
                'patterns_applied': len(patterns),
                'output_format': output_format
            }
            
        except Exception as e:
            self.logger.error(f"Data structuring failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }
    
    def _extract_text_from_item(self, item: Dict[str, Any]) -> str:
        """Extract text content from a data item"""
        # Try common text fields
        text_fields = ['full_text', 'text', 'content', 'description', 'body']
        
        for field in text_fields:
            if field in item and item[field]:
                return str(item[field])
        
        # If no text field found, try to stringify the whole item
        if isinstance(item, dict):
            # Look for any string values
            for value in item.values():
                if isinstance(value, str) and len(value) > 10:
                    return value
        
        # Last resort: convert to string
        return str(item)
    
    def _apply_patterns(self, 
                       text: str, 
                       patterns: List[Dict[str, Any]], 
                       skip_empty_matches: bool) -> Dict[str, Any]:
        """Apply regex patterns to extract data from text"""
        extracted_data = {}
        
        for pattern_config in patterns:
            try:
                field_name = pattern_config.get('name', 'unknown_field')
                regex_pattern = pattern_config.get('regex', '')
                flags_str = pattern_config.get('flags', '')
                data_type = pattern_config.get('type', 'text')
                
                if not regex_pattern:
                    continue
                
                # Convert flags string to regex flags
                flags = self._parse_regex_flags(flags_str)
                
                # Apply regex
                matches = self._apply_single_pattern(text, regex_pattern, flags, data_type)
                
                if matches is not None:
                    extracted_data[field_name] = matches
                elif not skip_empty_matches:
                    extracted_data[field_name] = None
                    
            except Exception as e:
                self.logger.error(f"Error applying pattern '{pattern_config.get('name', 'unknown')}': {str(e)}")
                extracted_data[f"{field_name}_error"] = str(e)
        
        return extracted_data
    
    def _apply_single_pattern(self, 
                             text: str, 
                             pattern: str, 
                             flags: int, 
                             data_type: str) -> Optional[Union[str, int, float, List]]:
        """Apply a single regex pattern and return typed result"""
        try:
            regex = re.compile(pattern, flags)
            
            # Check if pattern has global flag for multiple matches
            if flags & re.MULTILINE or flags & re.DOTALL or 'g' in str(flags):
                matches = regex.findall(text)
                if matches:
                    # If we have capture groups, use the first group; otherwise use full match
                    if isinstance(matches[0], tuple):
                        matches = [match[0] if match[0] else match[-1] for match in matches if any(match)]
                    
                    # Return single value if only one match, otherwise list
                    if len(matches) == 1:
                        return self._convert_type(matches[0], data_type)
                    else:
                        return [self._convert_type(match, data_type) for match in matches]
            else:
                # Single match
                match = regex.search(text)
                if match:
                    # Use capture group if available, otherwise full match
                    value = match.group(1) if match.groups() else match.group(0)
                    return self._convert_type(value, data_type)
            
            return None
            
        except re.error as e:
            self.logger.error(f"Invalid regex pattern '{pattern}': {str(e)}")
            return f"REGEX_ERROR: {str(e)}"
        except Exception as e:
            self.logger.error(f"Error applying pattern '{pattern}': {str(e)}")
            return f"ERROR: {str(e)}"
    
    def _parse_regex_flags(self, flags_str: str) -> int:
        """Convert flags string to regex flags integer"""
        flags = 0
        
        if 'i' in flags_str.lower():
            flags |= re.IGNORECASE
        if 'm' in flags_str.lower():
            flags |= re.MULTILINE
        if 's' in flags_str.lower():
            flags |= re.DOTALL
        if 'x' in flags_str.lower():
            flags |= re.VERBOSE
        
        return flags
    
    def _convert_type(self, value: str, data_type: str) -> Union[str, int, float]:
        """Convert string value to specified type"""
        if not value:
            return value
        
        try:
            if data_type == 'number':
                # Try integer first, then float
                if '.' in value:
                    return float(value)
                else:
                    return int(value)
            elif data_type == 'url':
                # Ensure URL is properly formatted
                if not value.startswith(('http://', 'https://')):
                    if value.startswith('//'):
                        return 'https:' + value
                    elif value.startswith('/'):
                        return value  # Relative URL
                    else:
                        return 'https://' + value
                return value
            else:
                # text, image, or default - return as string
                return str(value).strip()
                
        except (ValueError, TypeError):
            # If conversion fails, return as string
            return str(value).strip()
    
    def validate_patterns(self, patterns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate regex patterns for syntax errors"""
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        for i, pattern_config in enumerate(patterns):
            try:
                pattern = pattern_config.get('regex', '')
                flags_str = pattern_config.get('flags', '')
                name = pattern_config.get('name', f'Pattern {i+1}')
                
                if not pattern:
                    validation_results['errors'].append(f"{name}: Empty regex pattern")
                    validation_results['valid'] = False
                    continue
                
                # Test compile
                flags = self._parse_regex_flags(flags_str)
                re.compile(pattern, flags)
                
                # Test with sample text
                test_text = "Sample text 123 with data (test, value) and more content"
                try:
                    self._apply_single_pattern(test_text, pattern, flags, 'text')
                except Exception as e:
                    validation_results['warnings'].append(f"{name}: Pattern may not work as expected: {str(e)}")
                
            except re.error as e:
                validation_results['errors'].append(f"{name}: Invalid regex syntax: {str(e)}")
                validation_results['valid'] = False
            except Exception as e:
                validation_results['errors'].append(f"{name}: Pattern validation error: {str(e)}")
                validation_results['valid'] = False
        
        return validation_results


# Singleton instance
data_structuring_service = DataStructuringService()