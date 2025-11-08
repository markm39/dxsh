"""
Validation Module

Utilities for validating node inputs and outputs.
"""

from typing import Dict, Any, List, Optional
import re


class ValidationError(Exception):
    """Exception raised when validation fails."""
    pass


def validate_inputs(
    input_data: Dict[str, Any],
    schema: Dict[str, Any]
) -> bool:
    """
    Validate input data against a schema.

    Args:
        input_data: Input data to validate
        schema: Validation schema

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    for field, config in schema.items():
        required = config.get('required', False)
        field_type = config.get('type')
        default = config.get('default')

        # Check required fields
        if required and field not in input_data:
            if default is not None:
                input_data[field] = default
            else:
                raise ValidationError(f"Missing required field: {field}")

        # Type validation
        if field in input_data:
            value = input_data[field]

            if field_type and not check_type(value, field_type):
                raise ValidationError(
                    f"Invalid type for field '{field}': "
                    f"expected {field_type}, got {type(value).__name__}"
                )

            # Additional validators
            if 'min' in config and isinstance(value, (int, float)):
                if value < config['min']:
                    raise ValidationError(
                        f"Field '{field}' must be >= {config['min']}"
                    )

            if 'max' in config and isinstance(value, (int, float)):
                if value > config['max']:
                    raise ValidationError(
                        f"Field '{field}' must be <= {config['max']}"
                    )

            if 'min_length' in config and isinstance(value, (str, list)):
                if len(value) < config['min_length']:
                    raise ValidationError(
                        f"Field '{field}' length must be >= {config['min_length']}"
                    )

            if 'max_length' in config and isinstance(value, (str, list)):
                if len(value) > config['max_length']:
                    raise ValidationError(
                        f"Field '{field}' length must be <= {config['max_length']}"
                    )

            if 'pattern' in config and isinstance(value, str):
                if not re.match(config['pattern'], value):
                    raise ValidationError(
                        f"Field '{field}' does not match pattern: {config['pattern']}"
                    )

            if 'enum' in config:
                if value not in config['enum']:
                    raise ValidationError(
                        f"Field '{field}' must be one of: {config['enum']}"
                    )

    return True


def validate_outputs(output_data: Any, schema: Dict[str, Any]) -> bool:
    """
    Validate output data against a schema.

    Args:
        output_data: Output data to validate
        schema: Validation schema

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    output_type = schema.get('type')

    if output_type and not check_type(output_data, output_type):
        raise ValidationError(
            f"Invalid output type: expected {output_type}, "
            f"got {type(output_data).__name__}"
        )

    # Additional output validators
    if 'min' in schema and isinstance(output_data, (int, float)):
        if output_data < schema['min']:
            raise ValidationError(f"Output must be >= {schema['min']}")

    if 'max' in schema and isinstance(output_data, (int, float)):
        if output_data > schema['max']:
            raise ValidationError(f"Output must be <= {schema['max']}")

    if 'min_length' in schema and isinstance(output_data, (str, list)):
        if len(output_data) < schema['min_length']:
            raise ValidationError(
                f"Output length must be >= {schema['min_length']}"
            )

    if 'max_length' in schema and isinstance(output_data, (str, list)):
        if len(output_data) > schema['max_length']:
            raise ValidationError(
                f"Output length must be <= {schema['max_length']}"
            )

    return True


def check_type(value: Any, expected_type: str) -> bool:
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
        'integer': int,
        'float': float,
        'boolean': bool,
        'object': dict,
        'array': list,
        'null': type(None),
        'any': object
    }

    expected_python_type = type_mapping.get(expected_type, object)
    return isinstance(value, expected_python_type)


def validate_url(url: str) -> bool:
    """
    Validate a URL.

    Args:
        url: URL to validate

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    url_pattern = re.compile(
        r'^https?://'
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
        r'localhost|'
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        r'(?::\d+)?'
        r'(?:/?|[/?]\S+)$',
        re.IGNORECASE
    )

    if not url_pattern.match(url):
        raise ValidationError(f"Invalid URL: {url}")

    return True


def validate_email(email: str) -> bool:
    """
    Validate an email address.

    Args:
        email: Email to validate

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    email_pattern = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )

    if not email_pattern.match(email):
        raise ValidationError(f"Invalid email: {email}")

    return True


def validate_json(json_string: str) -> bool:
    """
    Validate JSON string.

    Args:
        json_string: JSON string to validate

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    import json

    try:
        json.loads(json_string)
        return True
    except json.JSONDecodeError as e:
        raise ValidationError(f"Invalid JSON: {e}")


def validate_range(
    value: float,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None
) -> bool:
    """
    Validate a numeric value is within range.

    Args:
        value: Value to validate
        min_value: Minimum value (inclusive)
        max_value: Maximum value (inclusive)

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    if min_value is not None and value < min_value:
        raise ValidationError(f"Value {value} is less than minimum {min_value}")

    if max_value is not None and value > max_value:
        raise ValidationError(f"Value {value} is greater than maximum {max_value}")

    return True


def validate_length(
    value: Any,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None
) -> bool:
    """
    Validate length of string, list, or dict.

    Args:
        value: Value to validate
        min_length: Minimum length
        max_length: Maximum length

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    if not isinstance(value, (str, list, dict)):
        raise ValidationError(
            f"Length validation not supported for type {type(value).__name__}"
        )

    length = len(value)

    if min_length is not None and length < min_length:
        raise ValidationError(
            f"Length {length} is less than minimum {min_length}"
        )

    if max_length is not None and length > max_length:
        raise ValidationError(
            f"Length {length} is greater than maximum {max_length}"
        )

    return True


def validate_enum(value: Any, allowed_values: List[Any]) -> bool:
    """
    Validate value is in allowed list.

    Args:
        value: Value to validate
        allowed_values: List of allowed values

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    if value not in allowed_values:
        raise ValidationError(
            f"Value '{value}' not in allowed values: {allowed_values}"
        )

    return True


def validate_pattern(value: str, pattern: str) -> bool:
    """
    Validate string matches regex pattern.

    Args:
        value: String to validate
        pattern: Regex pattern

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
    """
    if not isinstance(value, str):
        raise ValidationError(
            f"Pattern validation requires string, got {type(value).__name__}"
        )

    if not re.match(pattern, value):
        raise ValidationError(f"Value '{value}' does not match pattern: {pattern}")

    return True


class Validator:
    """
    Chainable validator for building complex validations.

    Example:
        validator = Validator()
        validator.required().type('string').min_length(5).validate(data, 'username')
    """

    def __init__(self):
        """Initialize validator."""
        self.validators = []

    def required(self):
        """Mark field as required."""
        self.validators.append(('required', None))
        return self

    def type(self, expected_type: str):
        """Add type validation."""
        self.validators.append(('type', expected_type))
        return self

    def min(self, min_value: float):
        """Add minimum value validation."""
        self.validators.append(('min', min_value))
        return self

    def max(self, max_value: float):
        """Add maximum value validation."""
        self.validators.append(('max', max_value))
        return self

    def min_length(self, min_length: int):
        """Add minimum length validation."""
        self.validators.append(('min_length', min_length))
        return self

    def max_length(self, max_length: int):
        """Add maximum length validation."""
        self.validators.append(('max_length', max_length))
        return self

    def pattern(self, pattern: str):
        """Add pattern validation."""
        self.validators.append(('pattern', pattern))
        return self

    def enum(self, allowed_values: List[Any]):
        """Add enum validation."""
        self.validators.append(('enum', allowed_values))
        return self

    def validate(self, data: Dict[str, Any], field: str) -> bool:
        """
        Execute all validators on a field.

        Args:
            data: Data dict
            field: Field name to validate

        Returns:
            True if valid

        Raises:
            ValidationError: If validation fails
        """
        for validator_type, validator_param in self.validators:
            if validator_type == 'required':
                if field not in data:
                    raise ValidationError(f"Missing required field: {field}")

            elif validator_type == 'type':
                if field in data and not check_type(data[field], validator_param):
                    raise ValidationError(
                        f"Invalid type for '{field}': expected {validator_param}"
                    )

            elif validator_type == 'min':
                if field in data and data[field] < validator_param:
                    raise ValidationError(
                        f"Field '{field}' must be >= {validator_param}"
                    )

            elif validator_type == 'max':
                if field in data and data[field] > validator_param:
                    raise ValidationError(
                        f"Field '{field}' must be <= {validator_param}"
                    )

            elif validator_type == 'min_length':
                if field in data and len(data[field]) < validator_param:
                    raise ValidationError(
                        f"Field '{field}' length must be >= {validator_param}"
                    )

            elif validator_type == 'max_length':
                if field in data and len(data[field]) > validator_param:
                    raise ValidationError(
                        f"Field '{field}' length must be <= {validator_param}"
                    )

            elif validator_type == 'pattern':
                if field in data and not re.match(validator_param, data[field]):
                    raise ValidationError(
                        f"Field '{field}' does not match pattern"
                    )

            elif validator_type == 'enum':
                if field in data and data[field] not in validator_param:
                    raise ValidationError(
                        f"Field '{field}' must be one of: {validator_param}"
                    )

        return True
