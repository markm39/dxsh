"""
Data Structuring Executor

Applies regex patterns and data cleaning operations for text processing
Extracted from backend/app/api/data_processing.py
"""

import json
import logging
import re
from typing import Dict, Any, Optional, List
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class DataStructuringExecutor(BaseNodeExecutor):
    """Execute data structuring nodes using regex patterns"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'dataStructuring'
    
    def validate_config(self) -> bool:
        """Validate data structuring node configuration"""
        try:
            data = self.node_config.get('data', {})
            
            # Must have regex patterns
            patterns = data.get('patterns', [])
            if not patterns:
                logger.error("Data structuring node requires 'patterns' field")
                return False
            
            # Validate each pattern
            for i, pattern in enumerate(patterns):
                if not isinstance(pattern, dict):
                    logger.error(f"Pattern {i} must be a dictionary")
                    return False
                
                if not pattern.get('name') or not pattern.get('regex'):
                    logger.error(f"Pattern {i} must have 'name' and 'regex' fields")
                    return False
                
                # Test regex compilation
                try:
                    re.compile(pattern['regex'])
                except re.error as e:
                    logger.error(f"Invalid regex in pattern {i}: {e}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating data structuring config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute data structuring node"""
        try:
            # Get configuration
            data = self.node_config.get('data', {})
            patterns = data.get('patterns', [])
            target_field = data.get('targetField', 'text')
            extract_all = data.get('extractAll', False)
            case_insensitive = data.get('caseInsensitive', False)
            
            # Use input data or fallback to configured data
            processing_data = input_data if input_data is not None else data.get('inputData', [])
            
            if not processing_data:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No input data provided for data structuring",
                    metadata={}
                )
            
            # Ensure we have a list to work with
            if not isinstance(processing_data, list):
                processing_data = [processing_data]
            
            results = []
            total_matches = 0
            
            for item in processing_data:
                if isinstance(item, dict):
                    text = str(item.get(target_field, ''))
                elif isinstance(item, str):
                    text = item
                else:
                    text = str(item)
                
                structured_item = {'original': item}
                
                # Apply each regex pattern
                for pattern in patterns:
                    pattern_name = pattern['name']
                    regex = pattern['regex']
                    
                    # Compile regex with flags
                    flags = re.IGNORECASE if case_insensitive else 0
                    try:
                        compiled_regex = re.compile(regex, flags)
                    except re.error as e:
                        logger.warning(f"Skipping invalid regex pattern '{pattern_name}': {e}")
                        continue
                    
                    # Extract matches
                    if extract_all:
                        matches = compiled_regex.findall(text)
                        structured_item[pattern_name] = matches
                        total_matches += len(matches)
                    else:
                        match = compiled_regex.search(text)
                        if match:
                            # If groups exist, extract them
                            if match.groups():
                                structured_item[pattern_name] = list(match.groups())
                            else:
                                structured_item[pattern_name] = match.group(0)
                            total_matches += 1
                        else:
                            structured_item[pattern_name] = None
                
                results.append(structured_item)
            
            return NodeExecutionResult(
                node_id=self.node_id,
                success=True,
                data=results,
                error=None,
                metadata={
                    'patterns_applied': len(patterns),
                    'items_processed': len(processing_data),
                    'total_matches': total_matches,
                    'target_field': target_field,
                    'extract_all': extract_all,
                    'case_insensitive': case_insensitive
                }
            )
        
        except Exception as e:
            logger.error(f"Error in data structuring execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Data structuring execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    def _extract_with_regex(self, text: str, pattern: str, extract_all: bool, case_insensitive: bool) -> Any:
        """Extract data using regex pattern"""
        flags = re.IGNORECASE if case_insensitive else 0
        
        try:
            compiled_regex = re.compile(pattern, flags)
            
            if extract_all:
                return compiled_regex.findall(text)
            else:
                match = compiled_regex.search(text)
                if match:
                    return match.groups() if match.groups() else match.group(0)
                return None
                
        except re.error as e:
            logger.error(f"Regex error: {e}")
            return None