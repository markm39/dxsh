# Dxsh SDK - Custom Node Development Kit

Python SDK for creating custom workflow nodes for the Dxsh platform.

## Installation

```bash
pip install dxsh-sdk
```

## Quick Start

### Creating a Simple Node

```python
from dxsh_sdk import BaseNode, NodeExecutionResult

class UppercaseNode(BaseNode):
    node_type = "text_uppercase"
    node_name = "Text Uppercase"
    node_description = "Converts text to uppercase"
    node_category = "text_processing"

    input_schema = {
        'text': {
            'type': 'string',
            'required': True,
            'description': 'Text to convert'
        }
    }

    output_schema = {
        'type': 'string',
        'description': 'Uppercase text'
    }

    async def execute(self, input_data):
        try:
            text = input_data.get('text', '')
            result = text.upper()
            return self.success(result)
        except Exception as e:
            return self.failure(str(e))
```

### Using Decorators

```python
from dxsh_sdk import node, input_param, output_param

@output_param('string', 'Uppercase text')
@input_param('text', 'string', 'Text to convert', required=True)
@node(
    node_type='text_uppercase',
    name='Text Uppercase',
    description='Converts text to uppercase'
)
async def uppercase_node(input_data):
    text = input_data.get('text', '')
    return text.upper()
```

### Simple Node Class

```python
from dxsh_sdk import SimpleNode

class ReverseTextNode(SimpleNode):
    node_type = "text_reverse"
    node_name = "Reverse Text"

    async def process(self, input_data):
        text = input_data.get('text', '')
        return text[::-1]
```

## Features

- Base classes for custom nodes
- Input/output validation
- Decorators for clean node definitions
- Progress tracking for async operations
- Built-in error handling
- Retry and caching decorators

## Advanced Usage

### Validation

```python
from dxsh_sdk import BaseNode, validate_inputs

class ValidatedNode(BaseNode):
    input_schema = {
        'email': {
            'type': 'string',
            'required': True,
            'pattern': r'^[\w\.-]+@[\w\.-]+\.\w+$'
        },
        'age': {
            'type': 'number',
            'min': 0,
            'max': 150
        }
    }

    async def execute(self, input_data):
        await self.validate_inputs(input_data)
        # Process data...
```

### Progress Tracking

```python
from dxsh_sdk import AsyncNode

class LongRunningNode(AsyncNode):
    async def execute(self, input_data):
        total_steps = 10

        for i in range(total_steps):
            # Do work
            progress = (i + 1) / total_steps * 100
            self.update_progress(progress, f"Step {i+1}/{total_steps}")

        return self.success(result)
```

### Using Decorators

```python
from dxsh_sdk import retry, timeout, cache_result

@cache_result(ttl_seconds=300)
@timeout(30)
@retry(max_attempts=3)
@node('api_caller', 'API Caller')
async def call_api(input_data):
    # API call logic
    pass
```

## Documentation

Full documentation available at: https://docs.dxsh.io/sdk

## License

MIT License
