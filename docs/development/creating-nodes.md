# Creating Custom Workflow Nodes

This guide explains how to create custom nodes for the workflow engine in the microservices architecture.

## Node Structure

Nodes are defined in the workflow-engine service and consist of:
1. A Python class that implements the node logic
2. Frontend configuration in the workflow-frontend service

## Creating a Backend Node

### 1. Create the Node Class

Create a new file in `services/workflow-engine/src/nodes/`:

```python
# services/workflow-engine/src/nodes/my_custom_node.py
from typing import Dict, Any
from .base import BaseNode

class MyCustomNode(BaseNode):
    """
    A custom node that processes data in some way.
    """
    
    name = "My Custom Node"
    type = "my_custom"
    category = "processing"  # or "input", "output", "ml", etc.
    
    def execute(self, inputs: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the node logic.
        
        Args:
            inputs: Data from connected input nodes
            parameters: Node configuration parameters
            
        Returns:
            Dictionary with output data
        """
        # Get input data
        data = inputs.get('data', [])
        
        # Get parameters
        multiplier = parameters.get('multiplier', 1)
        
        # Process data
        result = [item * multiplier for item in data]
        
        return {
            'result': result,
            'count': len(result)
        }
    
    @classmethod
    def get_schema(cls) -> Dict[str, Any]:
        """Define the node's parameter schema."""
        return {
            'multiplier': {
                'type': 'number',
                'default': 1,
                'description': 'Value to multiply by'
            }
        }
```

### 2. Register the Node

Add your node to `services/workflow-engine/src/nodes/__init__.py`:

```python
from .my_custom_node import MyCustomNode

NODE_REGISTRY = {
    # ... existing nodes ...
    'my_custom': MyCustomNode,
}
```

## Creating the Frontend Component

### 1. Define Node Configuration

Create a new file in `services/workflow-frontend/src/nodes/`:

```typescript
// services/workflow-frontend/src/nodes/MyCustomNode.tsx
import { NodeConfig } from '../types/node';

export const MyCustomNodeConfig: NodeConfig = {
  type: 'my_custom',
  label: 'My Custom Node',
  category: 'processing',
  inputs: [
    { id: 'data', label: 'Data', type: 'array' }
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'array' },
    { id: 'count', label: 'Count', type: 'number' }
  ],
  parameters: [
    {
      id: 'multiplier',
      label: 'Multiplier',
      type: 'number',
      default: 1,
      description: 'Value to multiply each item by'
    }
  ],
  color: '#4F46E5',  // Node color
  icon: ''         // Optional icon
};
```

### 2. Register Frontend Node

Add to `services/workflow-frontend/src/nodes/index.ts`:

```typescript
import { MyCustomNodeConfig } from './MyCustomNode';

export const nodeConfigs = {
  // ... existing nodes ...
  my_custom: MyCustomNodeConfig,
};
```

## Node Categories

Standard categories:
- `input` - Data sources (API, database, file)
- `processing` - Data transformation and manipulation
- `ml` - Machine learning and AI nodes
- `output` - Data destinations and exports
- `control` - Flow control (conditionals, loops)
- `utility` - Helper nodes

## Parameter Types

Supported parameter types:
- `string` - Text input
- `number` - Numeric input
- `boolean` - Checkbox
- `select` - Dropdown selection
- `json` - JSON editor
- `code` - Code editor
- `file` - File upload

## Best Practices

### 1. Error Handling

```python
def execute(self, inputs, parameters):
    try:
        # Node logic here
        return {'result': processed_data}
    except Exception as e:
        raise NodeExecutionError(f"Failed to process: {str(e)}")
```

### 2. Input Validation

```python
def execute(self, inputs, parameters):
    # Validate required inputs
    if 'data' not in inputs:
        raise ValueError("Missing required input: data")
    
    # Validate parameters
    multiplier = parameters.get('multiplier', 1)
    if not isinstance(multiplier, (int, float)):
        raise ValueError("Multiplier must be a number")
```

### 3. Progress Updates

For long-running operations:

```python
def execute(self, inputs, parameters):
    data = inputs.get('data', [])
    total = len(data)
    
    results = []
    for i, item in enumerate(data):
        # Update progress
        self.update_progress(i / total * 100)
        
        # Process item
        results.append(process_item(item))
    
    return {'results': results}
```

## Testing Your Node

### 1. Unit Tests

Create `services/workflow-engine/tests/nodes/test_my_custom_node.py`:

```python
import pytest
from src.nodes.my_custom_node import MyCustomNode

def test_my_custom_node():
    node = MyCustomNode()
    
    inputs = {'data': [1, 2, 3]}
    parameters = {'multiplier': 2}
    
    result = node.execute(inputs, parameters)
    
    assert result['result'] == [2, 4, 6]
    assert result['count'] == 3
```

### 2. Integration Testing

1. Start all services using `./start-dev.sh`
2. Create a workflow using your node
3. Execute and verify results

## Advanced Features

### Dynamic Outputs

```python
def execute(self, inputs, parameters):
    # Process data
    results = process_data(inputs['data'])
    
    # Dynamic outputs based on results
    outputs = {'processed': results}
    
    if parameters.get('include_stats'):
        outputs['stats'] = calculate_stats(results)
    
    return outputs
```

### Async Operations

```python
import asyncio

class AsyncNode(BaseNode):
    async def execute_async(self, inputs, parameters):
        # Async operations
        result = await fetch_external_data(parameters['url'])
        return {'data': result}
```

### External Dependencies

If your node requires additional packages:

1. Add to `services/workflow-engine/requirements.txt`
2. Document in node docstring
3. Handle import errors gracefully

## Deployment

After creating your node:

1. Restart the workflow-engine service
2. The node will automatically appear in the workflow builder
3. Test thoroughly before deploying to production

## Examples

See existing nodes in `services/workflow-engine/src/nodes/` for examples:
- `http_request.py` - API integration
- `data_transform.py` - Data processing
- `gpt_node.py` - External service integration
- `database_query.py` - Database operations