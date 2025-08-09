# Adding New Nodes to the Workflow System

This guide provides a comprehensive step-by-step process for adding new node types to the visual workflow system. Following this checklist ensures all components are properly integrated and prevents common issues like type validation errors.

## Overview

The workflow system consists of several interconnected components:
- **Frontend**: React Flow nodes, UI components, type definitions
- **Backend**: API endpoints, database models, business logic
- **Integration**: Node registration, validation, and state management

## Complete Checklist

### 1. Define Node Type and Behavior

**File**: `/frontend/src/components/agents-dashboard/workflow-types.ts`

Add your node definition to the `NODE_DEFINITIONS` registry:

```typescript
yourNodeName: {
  nodeType: 'yourNodeName',
  category: NodeCategory.PROCESSING, // SOURCE, PROCESSING, SINK, STORAGE, CONTROL
  acceptedInputs: [DataType.STRUCTURED_DATA], // What data types it accepts - determines connection compatibility
  outputType: DataType.STRUCTURED_DATA, // What it outputs - what nodes can connect to this node
  outputTypeInfo: {
    type: DataType.STRUCTURED_DATA,
    shape: DataShape.ARRAY_OF_OBJECTS, // SINGLE, OBJECT, ARRAY, ARRAY_OF_OBJECTS
    schema: [
      { name: 'field1', type: 'string', description: 'Description of field' },
      { name: 'field2', type: 'number', optional: true, description: 'Optional field' }
    ],
    exampleValue: [
      { field1: 'example', field2: 42 },
      { field1: 'another', field2: 84 }
    ]
  },
  minInputs: 1,
  maxInputs: 1,
  displayName: 'Your Node Name',
  description: 'What this node does'
}
```

### 2. Add Node to Sidebar Configuration

**File**: `/frontend/src/components/agents-dashboard/constants.ts`

Add to `NODE_TYPES` array:

```typescript
{
  id: "your-node-id",
  type: "yourNodeName", // Must match nodeType above
  label: "Your Node",
  icon: React.createElement(YourIcon, { className: "w-4 h-4 text-color-600" }),
  description: "Brief description for sidebar",
}
```

Add to appropriate `SIDEBAR_SECTIONS`:

```typescript
{
  title: "Your Category",
  items: NODE_TYPES.filter(node => 
    ["yourNodeName"].includes(node.type)
  ),
}
```

### 3. Create Node Component

**File**: `/frontend/src/components/agents-dashboard/nodes/YourNodeName.tsx`

```typescript
import React from 'react';
import { Handle, Position } from 'reactflow';
import { YourIcon } from 'lucide-react';

interface YourNodeData {
  label: string;
  configured: boolean;
  // Add your node-specific data properties
  yourConfig?: {
    field1: string;
    field2: number;
  };
  // Standard properties
  cachedOutput?: any;
  isExecutingEnhanced?: boolean;
  onExecute?: () => void;
}

const YourNodeName: React.FC<{ data: YourNodeData }> = ({ data }) => {
  const isConfigured = data.configured && data.yourConfig;
  
  return (
    <div className={`bg-background border-2 rounded-lg p-3 min-w-[200px] ${
      isConfigured ? 'border-green-500' : 'border-border-subtle'
    }`}>
      {/* Input handle (if node accepts inputs) */}
      <Handle type="target" position={Position.Left} />
      
      <div className="flex items-center gap-2 mb-2">
        <YourIcon className="w-4 h-4 text-purple-600" />
        <span className="font-medium text-text-primary">{data.label}</span>
      </div>
      
      {/* Configuration display */}
      {isConfigured ? (
        <div className="text-xs text-text-muted">
          <div>Field 1: {data.yourConfig?.field1}</div>
          <div>Field 2: {data.yourConfig?.field2}</div>
        </div>
      ) : (
        <div className="text-xs text-text-muted">Not configured</div>
      )}
      
      {/* Execution status */}
      {data.isExecutingEnhanced && (
        <div className="text-xs text-blue-400 mt-1">Running...</div>
      )}
      
      {/* Output handle (if node produces outputs) */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export default YourNodeName;
```

### 4. Register Node Component

**File**: `/frontend/src/pages/AgentsDashboard.tsx`

Add import:

```typescript
import YourNodeName from "../components/agents-dashboard/nodes/YourNodeName";
```

Add to `nodeTypes` object:

```typescript
const nodeTypes = {
  webSource: createEnhancedNodeWrapper(WebSourceNode),
  dataStructuring: createEnhancedNodeWrapper(DataStructuringNode),
  aiProcessor: createEnhancedNodeWrapper(AIProcessorNode),
  chartGenerator: createEnhancedNodeWrapper(ChartGeneratorNode),
  linearRegression: createEnhancedNodeWrapper(LinearRegressionNode),
  postgres: createEnhancedNodeWrapper(PostgresNode),
  yourNodeName: createEnhancedNodeWrapper(YourNodeName), // Add this line
};
```

### 5. Add Node Click Handler

**File**: `/frontend/src/pages/AgentsDashboard.tsx`

Add to `onNodeClick` callback:

```typescript
const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
  if (node.type === "webSource") {
    // ... existing handlers
  } else if (node.type === "yourNodeName") {
    setSelectedNodeForConfig(node.id);
    setShowYourNodeSetup(true);
  }
}, []);
```

### 6. Create Configuration Modal

**File**: `/frontend/src/components/YourNodeSetup.tsx`

```typescript
import React, { useState, useEffect } from "react";
import { YourIcon, CheckCircle, X } from "lucide-react";
import { useFilters } from "../context/FiltersProvider";

interface YourNodeConfig {
  field1: string;
  field2: number;
  // Add your configuration fields
}

interface YourNodeSetupProps {
  onClose: () => void;
  onSave: (config: YourNodeConfig) => void;
  initialConfig?: YourNodeConfig;
  inputData?: any[]; // Data from connected nodes
  isConfigured?: boolean;
}

const YourNodeSetup: React.FC<YourNodeSetupProps> = ({
  onClose,
  onSave,
  initialConfig,
  inputData = [],
  isConfigured = false,
}) => {
  const { authHeaders } = useFilters();
  const [config, setConfig] = useState<YourNodeConfig>({
    field1: '',
    field2: 0,
    ...initialConfig
  });

  const handleConfigChange = (field: keyof YourNodeConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Validate configuration
    if (!config.field1.trim()) {
      alert('Field 1 is required');
      return;
    }

    console.log('💾 Saving YourNode config:', config);
    onSave(config);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <YourIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-text-primary">Your Node</h2>
                  {isConfigured && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <p className="text-text-secondary">Configure your node settings</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Field 1</label>
            <input
              type="text"
              value={config.field1}
              onChange={(e) => handleConfigChange('field1', e.target.value)}
              className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
              placeholder="Enter field 1 value"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Field 2</label>
            <input
              type="number"
              value={config.field2}
              onChange={(e) => handleConfigChange('field2', parseInt(e.target.value) || 0)}
              className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
              placeholder="Enter field 2 value"
            />
          </div>

          {/* Show input data if available */}
          {inputData.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Input Data Preview</label>
              <div className="bg-surface rounded-lg border border-border-subtle p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-text-secondary font-mono">
                  {JSON.stringify(inputData.slice(0, 3), null, 2)}
                </pre>
                {inputData.length > 3 && (
                  <p className="text-xs text-text-muted mt-2">
                    ...and {inputData.length - 3} more records
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
            >
              <CheckCircle className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YourNodeSetup;
```

### 7. Add Modal State Management

**File**: `/frontend/src/pages/AgentsDashboard.tsx`

Add state:

```typescript
const [showYourNodeSetup, setShowYourNodeSetup] = useState(false);
```

Add modal JSX before closing div:

```typescript
{showYourNodeSetup && selectedNodeForConfig && (
  <YourNodeSetup
    onClose={() => {
      setShowYourNodeSetup(false);
      setSelectedNodeForConfig(null);
    }}
    onSave={(config) => {
      const updatedNodes = reactFlowNodes.map(node =>
        node.id === selectedNodeForConfig
          ? {
              ...node,
              data: {
                ...node.data,
                yourConfig: config,
                configured: true,
                label: `Your Node (${config.field1})`
              }
            }
          : node
      );
      setReactFlowNodes(updatedNodes);
      debouncedSave();
      
      setShowYourNodeSetup(false);
      setSelectedNodeForConfig(null);
    }}
    initialConfig={reactFlowNodes.find(n => n.id === selectedNodeForConfig)?.data?.yourConfig}
    inputData={[]} // Pass input data if needed
    isConfigured={reactFlowNodes.find(n => n.id === selectedNodeForConfig)?.data?.configured}
  />
)}
```

### 8. Add to Valid Node Types (CRITICAL)

**File**: `/frontend/src/components/agents-dashboard/hooks/useAgentManagement.ts`

Add to `validNodeTypes` Set:

```typescript
const validNodeTypes = new Set([
  'webSource', 
  'dataStructuring', 
  'aiProcessor', 
  'chartGenerator', 
  'linearRegression', 
  'postgres',
  'yourNodeName' // Add this line
]);
```

Add to hardcoded validation:

```typescript
if (node.type !== 'webSource' && 
    node.type !== 'aiProcessor' && 
    node.type !== 'chartGenerator' && 
    node.type !== 'linearRegression' && 
    node.type !== 'dataStructuring' && 
    node.type !== 'postgres' &&
    node.type !== 'yourNodeName') { // Add this line
```

### 9. Backend API Endpoints (if needed)

**File**: `/backend/flask-backend/app/api/your_node.py`

```python
"""
Your Node API endpoints
"""
from flask import request, jsonify
from app.api import api_bp
from app.utils.auth_utils import token_required, get_current_firebase_id
import logging

logger = logging.getLogger(__name__)

@api_bp.route('/your-node/process', methods=['POST'])
@token_required
def process_your_node():
    """Process data with your node logic"""
    try:
        firebase_id = get_current_firebase_id()
        if not firebase_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Your processing logic here
        result = {
            'success': True,
            'data': processed_data,
            'message': 'Processing completed successfully'
        }
        
        logger.info(f"User {firebase_id} processed data with your node")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing your node: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

Register in `/backend/flask-backend/app/api/__init__.py`:

```python
from app.api import your_node  # Add this import
```

### 10. Workflow Execution Support (CRITICAL)

**File**: `/frontend/src/components/agents-dashboard/workflow-execution-engine.ts`

#### Step 1: Add execution case

Add your node type to the switch statement in `executeNodeLogic` method:

```typescript
case 'yourNodeName':
  result = await this.executeYourNode(nodeData, inputs);
  dataType = DataType.STRUCTURED_DATA; // Or your node's output type
  break;
```

#### Step 2: Implement execution method

Add the execution method before the "// Utility methods" comment:

```typescript
private async executeYourNode(nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
  const config = nodeData.yourNodeName; // Should match the property name used when saving config
  
  if (!config) {
    throw new Error('Your node is not configured');
  }

  const apiBaseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://your-production-api.com' 
    : 'http://localhost:5001';

  try {
    // Process inputs if needed
    const inputData = inputs.length > 0 ? inputs[0].data : [];

    const response = await fetch(`${apiBaseUrl}/api/v1/your-node/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify({
        config,
        inputData
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Your node processing failed');
    }

    return result.data;
  } catch (error) {
    throw new Error(`Your node execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

**Important Notes:**
- The execution method should return the raw data (not a NodeOutput object)
- The engine will automatically wrap your result in a NodeOutput
- Use `this.context.authHeaders` for authentication
- Handle both success and error cases properly
- Validate configuration before processing
- **CRITICAL**: Ensure the config property name matches exactly between:
  - How it's saved in AgentsDashboard.tsx (e.g., `yourNodeName: config`)
  - How it's accessed in execution engine (e.g., `nodeData.yourNodeName`)
  - Configuration interface field names must match API expectations

## Common Pitfalls and Debugging

### 1. Node Type Validation Issues
**Symptom**: Node type changes to 'dataStructuring' when switching agents
**Solution**: Ensure node type is added to both validation lists in `useAgentManagement.ts`

### 2. Setup Modal Not Opening
**Symptom**: Clicking node doesn't open configuration modal
**Solution**: Check `onNodeClick` handler includes your node type

### 3. Node Not Appearing in Sidebar
**Symptom**: Can't drag node from sidebar
**Solution**: Verify node is added to `constants.ts` and appropriate sidebar section

### 4. Execution Failures
**Symptom**: Node shows error status when executed
**Solution**: Check workflow execution engine has handler for your node type

### 5. Type Compatibility Issues
**Symptom**: Can't connect nodes together
**Solution**: Verify `acceptedInputs` and `outputType` in node definition

## Testing Checklist

Before considering your node complete, test:

- [ ] Node appears in sidebar
- [ ] Node can be dragged to canvas
- [ ] Node can be clicked to open configuration
- [ ] Configuration can be saved
- [ ] Node shows configured state after saving
- [ ] Node maintains type when switching agents
- [ ] Node can be connected to compatible nodes
- [ ] Node executes successfully with valid inputs
- [ ] Node execution results display correctly
- [ ] Node handles error states gracefully

## File Summary

When adding a new node, you'll typically modify these files:

**Frontend Core:**
- `workflow-types.ts` - Node definition and typing
- `constants.ts` - Sidebar configuration
- `nodes/YourNodeName.tsx` - Node component
- `YourNodeSetup.tsx` - Configuration modal
- `AgentsDashboard.tsx` - Integration and state
- `useAgentManagement.ts` - Type validation (CRITICAL)
- `workflow-execution-engine.ts` - Execution logic

**Backend (if needed):**
- `api/your_node.py` - API endpoints
- `api/__init__.py` - Route registration
- `services/your_node_service.py` - Business logic

Following this guide ensures your new node integrates seamlessly with the workflow system and avoids common integration issues.

## Node Connection Compatibility

Understanding how nodes can connect to each other is crucial for building functional workflows. Node connections are validated based on **data types** - the output data type of the source node must be compatible with the accepted input types of the target node.

### Current Node Connection Matrix

| Source Node | Output Type | Can Connect To |
|-------------|-------------|----------------|
| **Web Source** | `RAW_DATA` | Data Structuring, AI Processor, PostgreSQL |
| **Data Structuring** | `STRUCTURED_DATA` | AI Processor, Linear Regression, Chart Generator, PostgreSQL |
| **AI Processor** | `TEXT_DATA` | Chart Generator, PostgreSQL |
| **Linear Regression** | `PREDICTION_DATA` | Chart Generator, PostgreSQL |
| **PostgreSQL** | `STRUCTURED_DATA` | AI Processor, Linear Regression, Chart Generator, PostgreSQL |
| **Chart Generator** | `CHART_DATA` | *(Terminal node - no outputs)* |

### Detailed Connection Rules

#### 🌐 Web Source Node
- **Outputs**: `RAW_DATA` (extracted web content)
- **Can connect to**:
  - Data Structuring (transforms raw data)
  - AI Processor (processes raw content)
  - PostgreSQL (stores raw data)

#### 📊 Data Structuring Node  
- **Accepts**: `RAW_DATA` 
- **Outputs**: `STRUCTURED_DATA`
- **Can connect to**:
  - AI Processor (analyzes structured data)
  - Linear Regression (trains on structured data)
  - Chart Generator (visualizes structured data)
  - PostgreSQL (stores structured data)

#### 🧠 AI Processor Node
- **Accepts**: `RAW_DATA`, `STRUCTURED_DATA`, `TEXT_DATA`
- **Outputs**: `TEXT_DATA` 
- **Can connect to**:
  - Chart Generator (visualizes AI insights)
  - PostgreSQL (stores AI results)

#### 📈 Linear Regression Node
- **Accepts**: `STRUCTURED_DATA`
- **Outputs**: `PREDICTION_DATA`
- **Can connect to**:  
  - Chart Generator (visualizes predictions)
  - PostgreSQL (stores model results)

#### 🗄️ PostgreSQL Node (Dual Mode)
- **Accepts**: `RAW_DATA`, `STRUCTURED_DATA`, `TEXT_DATA`, `PREDICTION_DATA` *(for sink mode)*
- **Outputs**: `STRUCTURED_DATA` *(for source mode)*
- **Can connect to**: Any node that accepts `STRUCTURED_DATA`
- **Special**: Can act as both data source and data sink

#### 📊 Chart Generator Node
- **Accepts**: `STRUCTURED_DATA`, `PREDICTION_DATA`, `TEXT_DATA`
- **Outputs**: `CHART_DATA` *(terminal - no further connections)*

### Adding Connection Compatibility for New Nodes

When creating a new node, you must define its connection compatibility in the node definition:

#### Step 1: Define Accepted Input Types

```typescript
// In workflow-types.ts NODE_DEFINITIONS
yourNodeName: {
  nodeType: 'yourNodeName',
  category: NodeCategory.PROCESSING,
  acceptedInputs: [DataType.STRUCTURED_DATA, DataType.TEXT_DATA], // What this node can accept
  outputType: DataType.STRUCTURED_DATA, // What this node outputs
  // ... rest of definition
}
```

#### Step 2: Update Data Compatibility Matrix (if needed)

```typescript
// Add to DATA_COMPATIBILITY array if creating new data types
export const DATA_COMPATIBILITY: DataCompatibility[] = [
  // ... existing compatibility rules
  { fromType: DataType.YOUR_NEW_TYPE, toType: DataType.STRUCTURED_DATA, compatible: true },
  { fromType: DataType.STRUCTURED_DATA, toType: DataType.YOUR_NEW_TYPE, compatible: true },
];
```

#### Connection Design Guidelines

1. **Source Nodes** (no inputs):
   - `acceptedInputs: []`
   - Should output data that other nodes can process

2. **Processing Nodes** (transform data):
   - Accept 1-3 related data types
   - Output a specific, useful data type
   - Example: `acceptedInputs: [DataType.RAW_DATA, DataType.STRUCTURED_DATA]`

3. **Sink Nodes** (terminal/storage):
   - Accept multiple data types for maximum flexibility
   - May or may not produce outputs
   - Example: `acceptedInputs: [DataType.STRUCTURED_DATA, DataType.TEXT_DATA, DataType.PREDICTION_DATA]`

4. **Storage Nodes** (dual source/sink):
   - Should accept most/all data types for storage flexibility
   - Output structured data for downstream processing
   - Example: `acceptedInputs: [DataType.RAW_DATA, DataType.STRUCTURED_DATA, DataType.TEXT_DATA, DataType.PREDICTION_DATA]`

#### Common Connection Patterns

**Linear Processing Chain:**
```
Web Source → Data Structuring → AI Processor → Chart Generator
(RAW_DATA)   (STRUCTURED_DATA)   (TEXT_DATA)     (CHART_DATA)
```

**Storage Integration:**
```
Web Source → PostgreSQL (sink mode)
PostgreSQL (source mode) → Linear Regression → Chart Generator
```

**Multi-input Processing:**
```
Web Source → AI Processor → PostgreSQL
Data Structuring ↗       ↙
```

#### Debugging Connection Issues

If nodes can't connect:

1. **Check Data Types**: Verify the source node's `outputType` is in the target node's `acceptedInputs`
2. **Check Compatibility Matrix**: Ensure `DATA_COMPATIBILITY` includes the type mapping
3. **Validate Node Definitions**: Confirm both nodes exist in `NODE_DEFINITIONS`
4. **Test in Console**: Use `validateNodeConnection('sourceType', 'targetType')` to debug

#### Real-World Connection Examples

```typescript
// ✅ VALID: Web Source → PostgreSQL
// webSource.outputType = RAW_DATA
// postgres.acceptedInputs = [RAW_DATA, STRUCTURED_DATA, TEXT_DATA, PREDICTION_DATA]

// ✅ VALID: Data Structuring → Linear Regression  
// dataStructuring.outputType = STRUCTURED_DATA
// linearRegression.acceptedInputs = [STRUCTURED_DATA]

// ❌ INVALID: Linear Regression → Data Structuring
// linearRegression.outputType = PREDICTION_DATA  
// dataStructuring.acceptedInputs = [RAW_DATA] // Missing PREDICTION_DATA

// ✅ VALID: AI Processor → Chart Generator
// aiProcessor.outputType = TEXT_DATA
// chartGenerator.acceptedInputs = [STRUCTURED_DATA, PREDICTION_DATA, TEXT_DATA]
```

This connection system ensures type safety and prevents invalid workflow configurations while maintaining flexibility for complex data processing pipelines.