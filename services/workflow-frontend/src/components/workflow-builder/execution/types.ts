import { Node } from 'reactflow';

// Core enums and interfaces (duplicated here to avoid circular imports)
export enum DataType {
  RAW_DATA = 'rawData',
  STRUCTURED_DATA = 'structuredData', 
  TEXT_DATA = 'textData',
  MODEL_DATA = 'modelData',
  PREDICTION_DATA = 'predictionData',
  CHART_DATA = 'chartData',
  IMAGE_DATA = 'imageData',
  AUDIO_DATA = 'audioData',
  VIDEO_DATA = 'videoData',
  BINARY_DATA = 'binaryData',
  STREAM_DATA = 'streamData',
  ANY = 'any',
  VOID = 'void'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running', 
  SUCCESS = 'success',
  ERROR = 'error',
  CACHED = 'cached'
}

export interface NodeOutput {
  nodeId: string;
  executionId: string;
  dataType: DataType;
  data: any;
  timestamp: string;
  inputSources: string[];
  executionStatus: ExecutionStatus;
  errorMessage?: string;
  metadata: {
    itemCount?: number;
    processingTime?: number;
    dataSize?: number;
    model?: any;
    [key: string]: any;
  };
}

// Import WorkflowNodeData separately to avoid circular dependency
export interface WorkflowNodeData {
  label: string;
  configured: boolean;
  isExecuting: boolean;
  lastExecuted?: string;
  executionStatus?: ExecutionStatus;
  executionId?: string;
  cachedOutput?: NodeOutput;
  inputSources: string[];
  monitoring?: any;
  processor?: any;
  chartGenerator?: any;
  model?: any;
  [key: string]: any;
  showPreview?: boolean;
  previewData?: any;
  onExecute?: () => void;
  onShowPreview?: () => void;
}

export interface ExecutionContext {
  agentId: number;
  authHeaders: Record<string, string>;
  nodes: Node[];
  edges: Array<{ source: string; target: string }>;
  onNodeUpdate?: (nodeId: string, update: any) => void;
  outputCache?: Map<string, NodeOutput>;
}

export interface ExecutionResult {
  nodeId: string;
  success: boolean;
  output?: NodeOutput;
  error?: string;
  executionTime?: number;
}

export interface ParameterCombination {
  [key: string]: any;
}

export interface BatchExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  url?: string;
  parameters?: ParameterCombination;
}

export interface LoopConfiguration {
  enabled: boolean;
  parameters: LoopParameter[];
  concurrency: number;
  delayBetweenRequests: number;
  aggregationMode: 'append' | 'merge';
  stopOnError: boolean;
}

export interface LoopParameter {
  id: string;
  name: string;
  type: 'range' | 'list' | 'input_variable';
  start?: number;
  end?: number;
  step?: number;
  values?: string[];
  inputVariable?: string;
  inputPath?: string;
}

// Re-export Node type from reactflow
export type { Node };