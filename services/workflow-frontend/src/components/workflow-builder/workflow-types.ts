/**
 * Extensible Workflow Type System
 * 
 * This file defines the core types for a scalable, typed workflow system
 * that supports dynamic node types and data formats.
 */

// Core enums that can be extended
export enum NodeCategory {
  SOURCE = 'source',      // Output only - generates data
  PROCESSING = 'processing', // Input + Output - transforms data  
  SINK = 'sink',         // Input only - consumes data
  // Future categories can be added here
  STORAGE = 'storage',   // For future database/file nodes
  CONTROL = 'control'    // For future conditional/loop nodes
}

export enum DataType {
  // Current data types
  RAW_DATA = 'rawData',           // Unstructured web scraping results
  STRUCTURED_DATA = 'structuredData', // Tabular data, JSON objects
  TEXT_DATA = 'textData',         // Processed text, summaries  
  MODEL_DATA = 'modelData',       // ML training data with features/targets
  PREDICTION_DATA = 'predictionData', // ML model outputs
  CHART_DATA = 'chartData',       // Data ready for visualization
  
  // Future extensibility
  IMAGE_DATA = 'imageData',       // For future image processing
  AUDIO_DATA = 'audioData',       // For future audio processing
  VIDEO_DATA = 'videoData',       // For future video processing
  BINARY_DATA = 'binaryData',     // For future file processing
  STREAM_DATA = 'streamData',     // For future real-time data
  
  // Special types
  ANY = 'any',                    // Accepts any input type
  VOID = 'void'                   // No output (for sink nodes)
}

// Detailed data shape information
export enum DataShape {
  SINGLE = 'single',              // Single value (string, number, boolean)
  OBJECT = 'object',              // Single object/dictionary
  ARRAY = 'array',                // Array of primitive values
  ARRAY_OF_OBJECTS = 'arrayOfObjects', // Array of objects (most common for structured data)
}

// Schema field definition
export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'any';
  optional?: boolean;
  description?: string;
}

// Enhanced type information
export interface DataTypeInfo {
  type: DataType;
  shape: DataShape;
  schema?: SchemaField[];  // Optional schema for structured data
  exampleValue?: any;      // Optional example for UI hints
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running', 
  SUCCESS = 'success',
  ERROR = 'error',
  CACHED = 'cached'
}

// Core interfaces
export interface NodeOutput {
  nodeId: string;
  executionId: string;
  dataType: DataType;
  data: any;
  timestamp: string;
  inputSources: string[]; // Node IDs that provided input
  executionStatus: ExecutionStatus;
  errorMessage?: string;
  
  // Enhanced type information
  typeInfo?: DataTypeInfo;
  
  metadata: {
    itemCount?: number;
    processingTime?: number;
    dataSize?: number;
    model?: any; // For ML nodes
    [key: string]: any; // Extensible metadata
  };
}

export interface NodeDefinition {
  nodeType: string;
  category: NodeCategory;
  acceptedInputs: DataType[];
  outputType: DataType;
  
  // Enhanced type information
  outputTypeInfo?: DataTypeInfo;
  
  minInputs: number;
  maxInputs: number;
  displayName: string;
  description: string;
  // Extensible validation
  customValidation?: (inputs: NodeOutput[]) => ValidationResult;
  // Future extensibility
  capabilities?: string[]; // For feature flags
  version?: string; // For versioning support
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataCompatibility {
  fromType: DataType;
  toType: DataType;
  compatible: boolean;
  requiresTransformation?: boolean;
  transformationCost?: number; // For optimization
}

// Enhanced node data interface
export interface WorkflowNodeData {
  // Core properties
  label: string;
  configured: boolean;
  
  // Execution state
  isExecuting: boolean;
  lastExecuted?: string;
  executionStatus?: ExecutionStatus;
  executionId?: string;
  
  // Data flow
  cachedOutput?: NodeOutput;
  inputSources: string[]; // Connected predecessor node IDs
  
  // Type information
  nodeDefinition: NodeDefinition;
  
  // Configuration (node-specific)
  monitoring?: any;     // For webSource
  processor?: any;      // For aiProcessor
  chartGenerator?: any; // For chartGenerator
  model?: any;         // For linearRegression
  [key: string]: any;  // Extensible for new node types
  
  // UI state
  showPreview?: boolean;
  previewData?: any;
  
  // Event handlers
  onExecute?: () => void;
  onShowPreview?: () => void;
}

// Type guards for extensibility
export function isSourceNode(category: NodeCategory): boolean {
  return category === NodeCategory.SOURCE;
}

export function isProcessingNode(category: NodeCategory): boolean {
  return category === NodeCategory.PROCESSING;
}

export function isSinkNode(category: NodeCategory): boolean {
  return category === NodeCategory.SINK;
}

export function canAcceptDataType(nodeType: string, dataType: DataType): boolean {
  const definition = NODE_DEFINITIONS[nodeType];
  if (!definition) return false;
  
  return definition.acceptedInputs.includes(dataType) || 
         definition.acceptedInputs.includes(DataType.ANY);
}

// Extensible node definitions registry
export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  webSource: {
    nodeType: 'webSource',
    category: NodeCategory.SOURCE,
    acceptedInputs: [],
    outputType: DataType.RAW_DATA,
    // Dynamic output type info based on configuration:
    // - Repeating mode: ARRAY_OF_OBJECTS with dynamic schema
    // - Table mode: ARRAY_OF_OBJECTS with known column schema
    // - Single selector: ARRAY of primitive values
    // - All mode: ARRAY_OF_OBJECTS with all selected elements
    outputTypeInfo: {
      type: DataType.RAW_DATA,
      shape: DataShape.ARRAY_OF_OBJECTS, // Most common case
      schema: [
        { name: 'text', type: 'string', description: 'Extracted text content' },
        { name: 'href', type: 'string', optional: true, description: 'Link URL if applicable' },
        { name: 'src', type: 'string', optional: true, description: 'Image/media source if applicable' },
        { name: 'selector', type: 'string', description: 'CSS selector used for extraction' }
      ],
      exampleValue: [
        { text: 'Sample text', href: 'https://example.com', selector: '.title' },
        { text: 'Another item', src: 'image.jpg', selector: '.item' }
      ]
    },
    minInputs: 0,
    maxInputs: 0,
    displayName: 'Web Source',
    description: 'Extract data from web pages using CSS selectors'
  },
  
  dataStructuring: {
    nodeType: 'dataStructuring',
    category: NodeCategory.PROCESSING,
    acceptedInputs: [DataType.RAW_DATA],
    outputType: DataType.STRUCTURED_DATA,
    outputTypeInfo: {
      type: DataType.STRUCTURED_DATA,
      shape: DataShape.ARRAY_OF_OBJECTS,
      schema: [
        { name: 'field1', type: 'string', description: 'Structured field (dynamic based on configuration)' },
        { name: 'field2', type: 'any', optional: true, description: 'Additional structured fields' }
      ],
      exampleValue: [
        { name: 'John Doe', email: 'john@example.com', score: 85 },
        { name: 'Jane Smith', email: 'jane@example.com', score: 92 }
      ]
    },
    minInputs: 1,
    maxInputs: 1,
    displayName: 'Data Structuring',
    description: 'Transform raw data into structured format using regex and patterns'
  },
  
  aiProcessor: {
    nodeType: 'aiProcessor',
    category: NodeCategory.PROCESSING,
    acceptedInputs: [DataType.RAW_DATA, DataType.STRUCTURED_DATA, DataType.TEXT_DATA],
    outputType: DataType.TEXT_DATA,
    outputTypeInfo: {
      type: DataType.TEXT_DATA,
      shape: DataShape.SINGLE, // AI typically outputs single text response
      exampleValue: 'AI-generated analysis: The data shows a positive trend with 85% accuracy based on the provided metrics and historical patterns.'
    },
    minInputs: 1,
    maxInputs: 1,
    displayName: 'AI Processor',
    description: 'Process data using AI models and custom prompts'
  },
  
  linearRegression: {
    nodeType: 'linearRegression',
    category: NodeCategory.PROCESSING,
    acceptedInputs: [DataType.STRUCTURED_DATA],
    outputType: DataType.PREDICTION_DATA,
    outputTypeInfo: {
      type: DataType.PREDICTION_DATA,
      shape: DataShape.OBJECT,
      schema: [
        { name: 'prediction', type: 'number', description: 'Predicted value' },
        { name: 'r_squared', type: 'number', description: 'Model R² score' },
        { name: 'coefficients', type: 'any', description: 'Model coefficients' },
        { name: 'model', type: 'any', description: 'Trained model metadata' }
      ],
      exampleValue: {
        prediction: 42.5,
        r_squared: 0.85,
        coefficients: [1.2, -0.5],
        model: { id: 123, name: 'Linear Regression Model' }
      }
    },
    minInputs: 1,
    maxInputs: 1,
    displayName: 'Linear Regression',
    description: 'Train linear regression models and make predictions'
  },

  randomForest: {
    nodeType: 'randomForest',
    category: NodeCategory.PROCESSING,
    acceptedInputs: [DataType.STRUCTURED_DATA],
    outputType: DataType.PREDICTION_DATA,
    outputTypeInfo: {
      type: DataType.PREDICTION_DATA,
      shape: DataShape.OBJECT,
      schema: [
        { name: 'prediction', type: 'number', description: 'Predicted value' },
        { name: 'r_squared', type: 'number', description: 'Model R² score' },
        { name: 'feature_importance', type: 'any', description: 'Feature importance rankings' },
        { name: 'model', type: 'any', description: 'Trained model metadata' }
      ],
      exampleValue: {
        prediction: 45.2,
        r_squared: 0.92,
        feature_importance: [0.3, 0.25, 0.2, 0.15, 0.1],
        model: { id: 124, name: 'Random Forest Model', n_estimators: 100 }
      }
    },
    minInputs: 1,
    maxInputs: 1,
    displayName: 'Random Forest',
    description: 'Train ensemble decision tree models with feature importance'
  },
  
  chartGenerator: {
    nodeType: 'chartGenerator',
    category: NodeCategory.SINK,
    acceptedInputs: [DataType.STRUCTURED_DATA, DataType.PREDICTION_DATA, DataType.TEXT_DATA],
    outputType: DataType.CHART_DATA,
    outputTypeInfo: {
      type: DataType.CHART_DATA,
      shape: DataShape.OBJECT,
      schema: [
        { name: 'chartType', type: 'string', description: 'Type of chart (bar, line, radar)' },
        { name: 'data', type: 'any', description: 'Chart data array' },
        { name: 'options', type: 'any', optional: true, description: 'Chart configuration options' },
        { name: 'title', type: 'string', optional: true, description: 'Chart title' }
      ],
      exampleValue: {
        chartType: 'bar',
        data: [{ label: 'Q1', value: 100 }, { label: 'Q2', value: 150 }],
        options: { responsive: true },
        title: 'Quarterly Revenue'
      }
    },
    minInputs: 1,
    maxInputs: 1,
    displayName: 'Chart Generator',
    description: 'Generate interactive charts and visualizations'
  },
  
  postgres: {
    nodeType: 'postgres',
    category: NodeCategory.STORAGE,
    acceptedInputs: [DataType.RAW_DATA, DataType.STRUCTURED_DATA, DataType.TEXT_DATA, DataType.PREDICTION_DATA], // For sink operations - can store any data type
    outputType: DataType.STRUCTURED_DATA, // For source operations
    outputTypeInfo: {
      type: DataType.STRUCTURED_DATA,
      shape: DataShape.ARRAY_OF_OBJECTS, // SQL queries typically return array of rows
      schema: [
        { name: 'column1', type: 'any', description: 'Database column (dynamic based on query/table)' },
        { name: 'column2', type: 'any', optional: true, description: 'Additional columns' }
      ],
      exampleValue: [
        { id: 1, name: 'Product A', price: 29.99, created_at: '2025-01-15T10:30:00Z' },
        { id: 2, name: 'Product B', price: 49.99, created_at: '2025-01-16T11:45:00Z' }
      ]
    },
    minInputs: 0, // Can work without inputs (source mode)
    maxInputs: 1, // Can accept one input (sink mode)
    displayName: 'PostgreSQL Database',
    description: 'Connect to PostgreSQL database for data extraction and insertion'
  },
  
  httpRequest: {
    nodeType: 'httpRequest',
    category: NodeCategory.SOURCE,
    acceptedInputs: [DataType.STRUCTURED_DATA, DataType.TEXT_DATA], // Can accept input for dynamic parameters
    outputType: DataType.STRUCTURED_DATA,
    outputTypeInfo: {
      type: DataType.STRUCTURED_DATA,
      shape: DataShape.OBJECT, // HTTP responses can be objects or arrays depending on API
      schema: [
        { name: 'status', type: 'number', description: 'HTTP status code' },
        { name: 'data', type: 'any', description: 'Response body data' },
        { name: 'headers', type: 'any', optional: true, description: 'Response headers' },
        { name: 'url', type: 'string', description: 'Request URL' },
        { name: 'method', type: 'string', description: 'HTTP method used' }
      ],
      exampleValue: {
        status: 200,
        data: { message: "API response data", items: [1, 2, 3] },
        headers: { "content-type": "application/json" },
        url: "https://api.example.com/data",
        method: "GET"
      }
    },
    minInputs: 0, // Can work without inputs for static requests
    maxInputs: 1, // Can accept input for dynamic parameters/body
    displayName: 'HTTP Request',
    description: 'Make HTTP requests to APIs with authentication and parameter support'
  },

  fileNode: {
    nodeType: 'fileNode',
    category: NodeCategory.STORAGE, // Can act as both source and sink
    acceptedInputs: [DataType.RAW_DATA, DataType.STRUCTURED_DATA, DataType.TEXT_DATA, DataType.PREDICTION_DATA, DataType.CHART_DATA], // For sink mode - can store any data
    outputType: DataType.STRUCTURED_DATA, // For source mode - output depends on file type
    outputTypeInfo: {
      type: DataType.STRUCTURED_DATA,
      shape: DataShape.ARRAY_OF_OBJECTS, // Most file formats result in structured data
      schema: [
        { name: 'column1', type: 'any', description: 'File content (dynamic based on file type and structure)' },
        { name: 'column2', type: 'any', optional: true, description: 'Additional columns from file' }
      ],
      exampleValue: [
        { name: 'John Doe', age: 30, city: 'New York', salary: 75000 },
        { name: 'Jane Smith', age: 25, city: 'Los Angeles', salary: 68000 }
      ]
    },
    minInputs: 0, // Can work without inputs (source mode)
    maxInputs: 1, // Can accept one input (sink mode)
    displayName: 'File Node',
    description: 'Load data from files (JSON, CSV, Excel, TXT, DOC) or save data to files'
  }
};

// Data type compatibility matrix - extensible
export const DATA_COMPATIBILITY: DataCompatibility[] = [
  // Direct compatibility
  { fromType: DataType.RAW_DATA, toType: DataType.RAW_DATA, compatible: true },
  { fromType: DataType.STRUCTURED_DATA, toType: DataType.STRUCTURED_DATA, compatible: true },
  { fromType: DataType.TEXT_DATA, toType: DataType.TEXT_DATA, compatible: true },
  
  // Processing chains
  { fromType: DataType.RAW_DATA, toType: DataType.STRUCTURED_DATA, compatible: true },
  { fromType: DataType.RAW_DATA, toType: DataType.TEXT_DATA, compatible: true },
  { fromType: DataType.STRUCTURED_DATA, toType: DataType.TEXT_DATA, compatible: true },
  { fromType: DataType.STRUCTURED_DATA, toType: DataType.PREDICTION_DATA, compatible: true },
  { fromType: DataType.STRUCTURED_DATA, toType: DataType.CHART_DATA, compatible: true },
  { fromType: DataType.PREDICTION_DATA, toType: DataType.CHART_DATA, compatible: true },
  { fromType: DataType.TEXT_DATA, toType: DataType.CHART_DATA, compatible: true },
  
  // ANY type compatibility
  { fromType: DataType.ANY, toType: DataType.ANY, compatible: true },
];

// Input variable support
export interface InputVariable {
  name: string; // e.g., 'input', 'data', 'items'
  typeInfo: DataTypeInfo;
  value?: any; // The actual data value
  path?: string; // For nested access like $input.fieldname
}

// Dynamic type detection for runtime type info
export function detectDataTypeInfo(data: any): DataTypeInfo {
  if (data === null || data === undefined) {
    return {
      type: DataType.ANY,
      shape: DataShape.SINGLE,
      exampleValue: null
    };
  }
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return {
        type: DataType.STRUCTURED_DATA,
        shape: DataShape.ARRAY,
        exampleValue: []
      };
    }
    
    const firstItem = data[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      // Array of objects - extract schema from first item
      const schema: SchemaField[] = Object.keys(firstItem).map(key => ({
        name: key,
        type: typeof firstItem[key] as any,
        optional: false,
        description: `Field extracted from data: ${key}`
      }));
      
      return {
        type: DataType.STRUCTURED_DATA,
        shape: DataShape.ARRAY_OF_OBJECTS,
        schema,
        exampleValue: data.slice(0, 2) // First 2 items as example
      };
    } else {
      // Array of primitives
      return {
        type: DataType.STRUCTURED_DATA,
        shape: DataShape.ARRAY,
        exampleValue: data.slice(0, 5) // First 5 items as example
      };
    }
  }
  
  if (typeof data === 'object') {
    // Single object - extract schema
    const schema: SchemaField[] = Object.keys(data).map(key => ({
      name: key,
      type: typeof data[key] as any,
      optional: false,
      description: `Field extracted from data: ${key}`
    }));
    
    return {
      type: DataType.STRUCTURED_DATA,
      shape: DataShape.OBJECT,
      schema,
      exampleValue: data
    };
  }
  
  // Primitive value
  return {
    type: DataType.TEXT_DATA,
    shape: DataShape.SINGLE,
    exampleValue: data
  };
}

// Generate available input variables for a node
export function getAvailableInputVariables(nodeId: string, nodeOutputs: NodeOutput[]): InputVariable[] {
  const inputVariables: InputVariable[] = [];
  
  // Find all connected predecessor nodes
  const connectedOutputs = nodeOutputs.filter(output => 
    // This would be determined by the workflow graph connections
    // For now, we'll assume any cached output could be an input
    output.nodeId !== nodeId && output.executionStatus === ExecutionStatus.SUCCESS
  );
  
  connectedOutputs.forEach(output => {
    const typeInfo = output.typeInfo || detectDataTypeInfo(output.data);
    
    inputVariables.push({
      name: 'input', // Primary input variable
      typeInfo,
      value: output.data
    });
    
    // Add field-level variables for structured data
    if (typeInfo.shape === DataShape.OBJECT && typeInfo.schema) {
      typeInfo.schema.forEach(field => {
        inputVariables.push({
          name: `input.${field.name}`,
          typeInfo: {
            type: DataType.TEXT_DATA,
            shape: DataShape.SINGLE,
            exampleValue: output.data?.[field.name]
          },
          value: output.data?.[field.name],
          path: field.name
        });
      });
    }
    
    // Add array access for array data
    if (typeInfo.shape === DataShape.ARRAY_OF_OBJECTS && typeInfo.schema) {
      inputVariables.push({
        name: 'input[0]', // First item access
        typeInfo: {
          type: DataType.STRUCTURED_DATA,
          shape: DataShape.OBJECT,
          schema: typeInfo.schema,
          exampleValue: Array.isArray(output.data) ? output.data[0] : null
        },
        value: Array.isArray(output.data) ? output.data[0] : null,
        path: '[0]'
      });
    }
  });
  
  return inputVariables;
}

// SQL query variable substitution
export function substituteInputVariables(query: string, inputVariables: InputVariable[]): string {
  let substitutedQuery = query;
  
  inputVariables.forEach(variable => {
    const placeholder = `$${variable.name}`;
    if (substitutedQuery.includes(placeholder)) {
      let value = variable.value;
      
      // Format value for SQL
      if (typeof value === 'string') {
        value = `'${value.replace(/'/g, "''")}'`; // Escape single quotes
      } else if (value === null || value === undefined) {
        value = 'NULL';
      } else if (typeof value === 'object') {
        value = `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      }
      
      substitutedQuery = substitutedQuery.replace(new RegExp(`\\$${variable.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), String(value));
    }
  });
  
  return substitutedQuery;
}

// Column mapping for data insertion
export interface ColumnMapping {
  sourceField: string; // Field from input data
  targetColumn: string; // Column in database table
  dataType?: string; // Expected database column type
  transform?: 'string' | 'number' | 'boolean' | 'date' | 'json'; // Optional transformation
}

export function generateColumnMappings(inputSchema: SchemaField[], tableColumns: any[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  
  inputSchema.forEach(field => {
    // Try to find matching column by name
    const matchingColumn = tableColumns.find(col => 
      col.column_name.toLowerCase() === field.name.toLowerCase()
    );
    
    if (matchingColumn) {
      mappings.push({
        sourceField: field.name,
        targetColumn: matchingColumn.column_name,
        dataType: matchingColumn.data_type,
        transform: inferTransform(field.type, matchingColumn.data_type)
      });
    }
  });
  
  return mappings;
}

function inferTransform(sourceType: string, targetType: string): ColumnMapping['transform'] {
  if (targetType.includes('json') || targetType.includes('jsonb')) {
    return 'json';
  }
  if (targetType.includes('timestamp') || targetType.includes('date')) {
    return 'date';
  }
  if (targetType.includes('int') || targetType.includes('numeric')) {
    return 'number';
  }
  if (targetType.includes('bool')) {
    return 'boolean';
  }
  return 'string';
}

// Utility functions for extensibility
export function registerNodeType(definition: NodeDefinition): void {
  NODE_DEFINITIONS[definition.nodeType] = definition;
}

export function registerDataCompatibility(compatibility: DataCompatibility): void {
  DATA_COMPATIBILITY.push(compatibility);
}

export function getCompatibleInputTypes(nodeType: string): DataType[] {
  const definition = NODE_DEFINITIONS[nodeType];
  if (!definition) return [];
  
  return definition.acceptedInputs;
}

export function isDataTypeCompatible(fromType: DataType, toType: DataType): boolean {
  return DATA_COMPATIBILITY.some(
    compat => compat.fromType === fromType && compat.toType === toType && compat.compatible
  );
}

export function validateNodeConnection(sourceNodeType: string, targetNodeType: string): ValidationResult {
  const sourceDef = NODE_DEFINITIONS[sourceNodeType];
  const targetDef = NODE_DEFINITIONS[targetNodeType];
  
  if (!sourceDef || !targetDef) {
    return {
      isValid: false,
      errors: ['Invalid node type'],
      warnings: []
    };
  }
  
  const isCompatible = isDataTypeCompatible(sourceDef.outputType, targetDef.acceptedInputs[0]) ||
                      targetDef.acceptedInputs.includes(DataType.ANY);
  
  if (!isCompatible) {
    return {
      isValid: false,
      errors: [`${sourceDef.displayName} outputs ${sourceDef.outputType} but ${targetDef.displayName} requires ${targetDef.acceptedInputs.join(' or ')}`],
      warnings: []
    };
  }
  
  // Additional validation for data shape compatibility
  const sourceTypeInfo = sourceDef.outputTypeInfo;
  const warnings: string[] = [];
  
  if (sourceTypeInfo && targetNodeType === 'postgres') {
    if (sourceTypeInfo.shape === DataShape.SINGLE) {
      warnings.push('PostgreSQL node typically expects array of objects for bulk operations');
    }
  }
  
  return {
    isValid: true,
    errors: [],
    warnings
  };
}

// Enhanced validation with type info
export function validateNodeInputs(nodeType: string, inputs: NodeOutput[]): ValidationResult {
  const definition = NODE_DEFINITIONS[nodeType];
  if (!definition) {
    return {
      isValid: false,
      errors: ['Unknown node type'],
      warnings: []
    };
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check input count
  if (inputs.length < definition.minInputs) {
    errors.push(`${definition.displayName} requires at least ${definition.minInputs} input(s), got ${inputs.length}`);
  }
  
  if (inputs.length > definition.maxInputs) {
    errors.push(`${definition.displayName} accepts at most ${definition.maxInputs} input(s), got ${inputs.length}`);
  }
  
  // Check data type compatibility
  inputs.forEach((input, index) => {
    const inputTypeInfo = input.typeInfo || detectDataTypeInfo(input.data);
    const acceptedTypes = definition.acceptedInputs;
    
    if (!acceptedTypes.includes(input.dataType) && !acceptedTypes.includes(DataType.ANY)) {
      errors.push(`Input ${index + 1}: Expected ${acceptedTypes.join(' or ')}, got ${input.dataType}`);
    }
    
    // Shape-specific warnings
    if (nodeType === 'postgres' && inputTypeInfo.shape === DataShape.SINGLE) {
      warnings.push('PostgreSQL sink mode works best with array of objects for bulk insertion');
    }
    
    if (nodeType === 'chartGenerator' && inputTypeInfo.shape === DataShape.SINGLE && input.dataType !== DataType.TEXT_DATA) {
      warnings.push('Chart generator may not be able to visualize single values effectively');
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Export default registry for easy access
export default {
  NODE_DEFINITIONS,
  DATA_COMPATIBILITY,
  registerNodeType,
  registerDataCompatibility,
  validateNodeConnection,
  validateNodeInputs,
  canAcceptDataType,
  isDataTypeCompatible,
  detectDataTypeInfo,
  getAvailableInputVariables,
  substituteInputVariables,
  generateColumnMappings
};