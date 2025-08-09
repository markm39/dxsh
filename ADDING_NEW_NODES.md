# Adding New Nodes to the Workflow Engine

This guide provides a comprehensive step-by-step process for adding new node types to the visual workflow system. Following this checklist ensures all components are properly integrated with the standalone workflow engine architecture.

## Overview

The workflow engine consists of several interconnected components:
- **Frontend**: React Flow nodes, UI components, type definitions (`/frontend/`)
- **Backend**: Flask API endpoints, database models, business logic (`/backend/`)
- **Integration**: Node registration, validation, JWT authentication, and state management

## Complete Implementation Checklist

### 1. Define Node Type and Behavior

**File**: `/frontend/src/components/agents-dashboard/workflow-types.ts`

Add your node definition to the `NODE_DEFINITIONS` registry:

```typescript
yourNodeName: {
  nodeType: 'yourNodeName',
  category: NodeCategory.PROCESSING, // SOURCE, PROCESSING, SINK, STORAGE, CONTROL
  acceptedInputs: [DataType.STRUCTURED_DATA], // What data types it accepts
  outputType: DataType.STRUCTURED_DATA, // What it outputs
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
  // Standard properties for enhanced execution
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
      
      {/* Cache status indicator */}
      {data.cachedOutput && (
        <div className="text-xs text-green-400 mt-1">Cached</div>
      )}
      
      {/* Individual execution button */}
      {data.onExecute && (
        <button
          onClick={data.onExecute}
          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded mt-1"
        >
          ▶ Run
        </button>
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
  httpRequest: createEnhancedNodeWrapper(HttpRequestNode),
  aiProcessor: createEnhancedNodeWrapper(AIProcessorNode),
  chartGenerator: createEnhancedNodeWrapper(ChartGeneratorNode),
  linearRegression: createEnhancedNodeWrapper(LinearRegressionNode),
  randomForest: createEnhancedNodeWrapper(RandomForestNode),
  yourNodeName: createEnhancedNodeWrapper(YourNodeName), // Add this line
};
```

### 5. Add Node Click Handler

**File**: `/frontend/src/pages/AgentsDashboard.tsx`

Add to `handleNodeClick` callback:

```typescript
const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
  // ... existing handlers
  if (node.type === "yourNodeName") {
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
import { useAuth } from "../hooks/useAuth";

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
  const { authHeaders } = useAuth();
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

          {/* Show input data preview if available */}
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
  'httpRequest',
  'aiProcessor', 
  'chartGenerator', 
  'linearRegression', 
  'randomForest',
  'yourNodeName' // Add this line
]);
```

### 9. Backend API Endpoints (if needed)

**File**: `/backend/app/api/your_node.py`

```python
"""
Your Node API endpoints
"""
from flask import request, jsonify
from app.api import api_bp
from app.auth import auth_required, get_current_user
import logging

logger = logging.getLogger(__name__)

@api_bp.route('/your-node/process', methods=['POST'])
@auth_required
def process_your_node():
    """Process data with your node logic"""
    try:
        current_user = get_current_user()
        user_id = current_user.user_id
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        config = data.get('config', {})
        input_data = data.get('inputData', [])
        
        # Your processing logic here
        processed_data = your_processing_function(config, input_data)
        
        result = {
            'success': True,
            'data': processed_data,
            'message': 'Processing completed successfully'
        }
        
        logger.info(f"User {user_id} processed data with your node")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing your node: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def your_processing_function(config, input_data):
    """Implement your node's core processing logic here"""
    # Example processing
    field1 = config.get('field1', '')
    field2 = config.get('field2', 0)
    
    # Process input_data based on config
    processed = []
    for item in input_data:
        # Your transformation logic
        processed_item = {
            'original': item,
            'processed_with': field1,
            'multiplied_by': field2
        }
        processed.append(processed_item)
    
    return processed
```

Register in `/backend/app/api/__init__.py`:

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
  const config = nodeData.yourConfig; // Should match the property name used when saving config
  
  if (!config) {
    throw new Error('Your node is not configured');
  }

  const apiBaseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://your-production-api.com' 
    : 'http://localhost:5000';

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

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

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

## Key Differences from Chatmark System

### 1. Authentication System
- **Old**: Firebase Authentication with `useFilters` context
- **New**: JWT Authentication with `useAuth` hook
- **Update**: Replace `authHeaders` from `useFilters` with `authHeaders` from `useAuth`

### 2. API Base URLs
- **Old**: Multiple environment-specific URLs
- **New**: Single Flask backend on `http://localhost:5000` (dev) or production URL
- **Update**: Use consistent API base URL pattern

### 3. User Identification
- **Old**: Firebase UID with `get_current_firebase_id()`
- **New**: JWT user ID with `get_current_user_id()`
- **Update**: Backend auth decorators use JWT token validation

### 4. Database Models
- **Old**: Complex sports-specific schema
- **New**: Generic workflow models (User, Agent, WorkflowExecution, NodeExecution)
- **Update**: Use simplified user_id foreign keys

### 5. File Structure
- **Old**: Deep nested structure within larger app
- **New**: Flat, focused structure in standalone project
- **Update**: Simplified import paths and component organization

## Enhanced Execution Features

The workflow engine supports advanced execution patterns:

### 1. Individual Node Execution
- **"Run from here"** buttons on each node
- Automatic input gathering from cached upstream results
- Smart cache invalidation and reuse

### 2. Parameter Looping
- Built-in looping system for dynamic parameter substitution
- Progress tracking across iterations
- Automatic result aggregation

### 3. Type Validation
- Real-time connection validation
- Visual data type indicators
- Prevention of incompatible node connections

### 4. Caching System
- Node-level result caching with metadata
- Input change detection for cache invalidation
- Performance optimization for complex workflows

## Common Pitfalls and Debugging

### 1. Authentication Issues
**Symptom**: 401 Unauthorized errors when executing nodes or `ModuleNotFoundError: No module named 'app.utils'`
**Solution**: 
- **Frontend**: Ensure `useAuth` hook is properly imported and JWT token is valid
- **Backend**: Use correct import: `from app.auth import auth_required, get_current_user` (NOT `from app.utils.auth_utils`)
- **Backend**: Use `@auth_required` decorator and `current_user = get_current_user(); user_id = current_user.user_id`

### 2. Node Type Validation Issues
**Symptom**: Node type changes unexpectedly when switching agents
**Solution**: Ensure node type is added to `validNodeTypes` in `useAgentManagement.ts`

### 3. API Endpoint Mismatches
**Symptom**: 404 errors during node execution
**Solution**: Verify backend API routes match frontend execution calls

### 4. Configuration Property Naming
**Symptom**: Node shows as configured but execution fails
**Solution**: Ensure config property names match exactly between save and execution

### 5. Type Compatibility Issues
**Symptom**: Can't connect nodes together
**Solution**: Verify `acceptedInputs` and `outputType` in node definition

## Testing Workflow

Before considering your node complete, test:

- [ ] Node appears in sidebar and can be dragged to canvas
- [ ] Node can be clicked to open configuration modal
- [ ] Configuration can be saved and persists correctly
- [ ] Node shows configured state and summary after saving
- [ ] Node maintains type when switching between agents
- [ ] Node can be connected to compatible nodes (type validation)
- [ ] Node execution succeeds with valid inputs and configuration
- [ ] Node execution results display correctly in execution history
- [ ] Node handles error states gracefully with meaningful messages
- [ ] Individual node execution works with "Run from here" button
- [ ] Node respects caching system and cache invalidation
- [ ] E2E tests pass for all node functionality

## E2E Testing for New Nodes

The workflow engine uses Playwright for comprehensive end-to-end testing. Follow this guide to create thorough E2E tests for your new node.

### Setting Up E2E Tests

1. **Install Playwright** (if not already installed):
```bash
cd frontend
npm install --save-dev @playwright/test
```

2. **Configure Playwright** (`playwright.config.ts`):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../backend && source venv/bin/activate && python run.py',
      url: 'http://localhost:5000',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

3. **Add test scripts to package.json**:
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

### Creating E2E Tests

#### Test Structure

Create your tests in `frontend/tests/e2e/your-node.spec.ts`:

```typescript
import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Utility functions
async function loginUser(page: Page) {
  await page.goto('/');
  
  const workflowInterface = page.locator('[data-testid="workflow-canvas"]');
  if (await workflowInterface.isVisible()) {
    return; // Already logged in
  }
  
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('password');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/workflow/);
}

async function createNewWorkflow(page: Page) {
  const createButton = page.locator('button:has-text("Create Agent")');
  if (await createButton.isVisible()) {
    await createButton.click();
    await page.locator('input[placeholder*="name"]').fill('Test Workflow');
    await page.locator('button:has-text("Create")').click();
  }
}

async function addNodeToCanvas(page: Page, nodeType: string) {
  const nodeLibrary = page.locator('[data-testid="node-library"]');
  if (!(await nodeLibrary.isVisible())) {
    await page.locator('button:has-text("Nodes")').click();
  }
  
  const node = page.locator(`[data-testid="node-library"] >> text=${nodeType}`);
  const canvas = page.locator('[data-testid="workflow-canvas"]');
  await node.dragTo(canvas);
  
  return page.locator(`[data-type="${nodeType.toLowerCase().replace(/\s+/g, '')}"]`);
}
```

#### Test Categories

**1. Component Visibility Tests:**
```typescript
test.describe('YourNode Component', () => {
  test('should be visible in node library', async ({ page }) => {
    await loginUser(page);
    await page.locator('button:has-text("Nodes")').click();
    
    const yourNode = page.locator('[data-testid="node-library"] >> text=Your Node');
    await expect(yourNode).toBeVisible();
  });

  test('should show correct initial state', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    
    await expect(node.locator('text=Configure')).toBeVisible();
    await expect(node.locator('text=Not configured')).toBeVisible();
  });
});
```

**2. Configuration Modal Tests:**
```typescript
test.describe('YourNode Setup Modal', () => {
  test('should open modal when clicked', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    
    await node.click();
    
    const modal = page.locator('[data-testid="your-node-setup-modal"]');
    await expect(modal).toBeVisible();
  });

  test('should validate configuration', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    await node.click();
    
    // Try to save without required fields
    await page.locator('button:has-text("Save Configuration")').click();
    
    await expect(page.locator('text=Field is required')).toBeVisible();
  });

  test('should save valid configuration', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    await node.click();
    
    // Fill required fields
    await page.locator('input[placeholder="Field 1"]').fill('test value');
    await page.locator('button:has-text("Save Configuration")').click();
    
    // Modal should close and node should show configured state
    const modal = page.locator('[data-testid="your-node-setup-modal"]');
    await expect(modal).not.toBeVisible();
    await expect(node.locator('text=Ready')).toBeVisible();
  });
});
```

**3. Execution Tests:**
```typescript
test.describe('YourNode Execution', () => {
  test('should execute successfully', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    
    // Configure node
    await node.click();
    await page.locator('input[placeholder="Field 1"]').fill('test');
    await page.locator('button:has-text("Save Configuration")').click();
    
    // Execute
    await node.locator('button[title*="Run"]').click();
    
    // Check execution status
    await expect(node.locator('text=Running')).toBeVisible();
    await expect(node.locator('text=Success')).toBeVisible({ timeout: 10000 });
  });

  test('should handle execution errors', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    
    // Configure with invalid data
    await node.click();
    await page.locator('input[placeholder="Field 1"]').fill('invalid');
    await page.locator('button:has-text("Save Configuration")').click();
    
    // Execute
    await node.locator('button[title*="Run"]').click();
    
    // Should show error
    await expect(node.locator('text=Failed')).toBeVisible({ timeout: 10000 });
  });
});
```

**4. Workflow Integration Tests:**
```typescript
test.describe('YourNode Workflow Integration', () => {
  test('should connect to compatible nodes', async ({ page }) => {
    await loginUser(page);
    
    // Add source node
    const sourceNode = await addNodeToCanvas(page, 'Web Source');
    
    // Add your node
    const yourNode = await addNodeToCanvas(page, 'Your Node');
    
    // Connect nodes
    const sourceOutput = sourceNode.locator('.react-flow__handle-bottom');
    const yourInput = yourNode.locator('.react-flow__handle-top');
    await sourceOutput.dragTo(yourInput);
    
    // Verify connection
    const edge = page.locator('.react-flow__edge');
    await expect(edge).toBeVisible();
  });

  test('should maintain configuration across saves', async ({ page }) => {
    await loginUser(page);
    const node = await addNodeToCanvas(page, 'Your Node');
    
    // Configure
    await node.click();
    await page.locator('input[placeholder="Field 1"]').fill('persistent');
    await page.locator('button:has-text("Save Configuration")').click();
    
    // Save workflow
    await page.locator('button:has-text("Save")').click();
    
    // Reload and verify
    await page.reload();
    await expect(node.locator('text=persistent')).toBeVisible();
  });
});
```

#### Test Data and Fixtures

Create test fixtures in `tests/e2e/fixtures/`:

```typescript
// For file-based nodes
await page.locator('input[type="file"]').setInputFiles(
  path.join(__dirname, 'fixtures/sample.json')
);

// For API mocking
await page.route('/api/v1/your-endpoint', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ success: true, data: [] })
  });
});
```

### Running E2E Tests

**Development:**
```bash
# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test your-node.spec.ts

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

**CI/CD:**
```bash
# Install browsers first
npx playwright install

# Run tests in CI mode
npm run test:e2e
```

### Best Practices

1. **Test Data Independence**: Each test should create its own data and clean up after itself
2. **Stable Selectors**: Use `data-testid` attributes for reliable element selection
3. **Wait Strategies**: Use `waitForURL`, `waitForLoadState`, and `expect` with timeouts
4. **Error Scenarios**: Test both success and failure paths
5. **Cross-Browser**: Test on Chrome, Firefox, and Safari
6. **Mobile**: Include mobile viewport tests for responsive design

### Real Example: FileNode E2E Tests

The FileNode implementation includes comprehensive E2E tests covering:

- **Component rendering** and visibility in node library
- **Modal functionality** with file upload and configuration options
- **File format support** (JSON, CSV, TXT) with format-specific options
- **Source and sink modes** with different file operations
- **Validation and error handling** for various scenarios
- **Workflow integration** with other nodes
- **Persistence** across workflow saves and reloads

Files:
- `tests/e2e/file-node.spec.ts` - Main functionality tests
- `tests/e2e/file-formats.spec.ts` - File format specific tests
- `tests/e2e/fixtures/` - Sample test files

This provides a complete testing strategy that ensures your node works reliably in all scenarios.

## Node Connection Compatibility

Understanding data flow is crucial for building functional workflows:

### Current Node Connection Matrix

| Source Node | Output Type | Can Connect To |
|-------------|-------------|----------------|
| **Web Source** | `RAW_DATA` | HTTP Request, AI Processor |
| **HTTP Request** | `STRUCTURED_DATA` | AI Processor, Linear Regression, Random Forest, Chart Generator |
| **AI Processor** | `TEXT_DATA` | Chart Generator |
| **Linear Regression** | `PREDICTION_DATA` | Chart Generator |
| **Random Forest** | `PREDICTION_DATA` | Chart Generator |
| **Chart Generator** | `CHART_DATA` | *(Terminal node)* |

### Adding New Data Types

When creating nodes with new data types:

1. **Add to DataType enum** in `workflow-types.ts`
2. **Update DATA_COMPATIBILITY matrix** with new type relationships
3. **Define clear output schema** in node definition
4. **Test compatibility** with existing nodes

## File Summary

When adding a new node, you'll typically modify these files:

**Frontend Core:**
- `workflow-types.ts` - Node definition and typing
- `constants.ts` - Sidebar configuration  
- `nodes/YourNodeName.tsx` - Node component
- `YourNodeSetup.tsx` - Configuration modal
- `AgentsDashboard.tsx` - Integration and state management
- `useAgentManagement.ts` - Type validation (CRITICAL)
- `workflow-execution-engine.ts` - Execution logic

**Backend (if needed):**
- `api/your_node.py` - API endpoints
- `api/__init__.py` - Route registration
- `services/your_node_service.py` - Business logic

**Authentication Integration:**
- Replace Firebase auth with JWT `useAuth` hook
- Update backend decorators to use `@token_required`
- Ensure API calls include JWT headers

Following this guide ensures your new node integrates seamlessly with the standalone workflow engine and maintains all advanced features like caching, individual execution, and type safety.