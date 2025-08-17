import { Node, Edge } from "reactflow";

export interface Agent {
  id: number;
  name: string;
  description: string;
  agentType: string;
  status: string;
  isActive: boolean;
  naturalLanguageConfig: string;
  lastExecution?: string;
  lastSuccess?: string;
  executionCountToday: number;
  totalExecutions: number;
  successRate: number;
  consecutiveFailures: number;
  triggers: any[];
  actions: any[];
}

export interface NodeType {
  id: string;
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export interface ExecutionHistory {
  id: number;
  started_at: string;
  completed_at?: string;
  status: string;
  error_message?: string;
  workflow_nodes: Node[];
  workflow_edges: Edge[];
}

export interface WorkflowResults {
  [nodeId: string]: any;
}

// Legacy interface for backward compatibility
export interface NodeData {
  label: string;
  configured: boolean;
  onExecute?: () => void;
  isExecuting?: boolean;
  executionResult?: any;
  lastExecuted?: string;
  executionError?: any;
  monitoring?: any;
  model?: any;
  processor?: any;
  chartGenerator?: any;
}

export interface DashboardTab {
  id: 'workflow' | 'results';
  label: string;
  icon: React.ReactNode;
}

export interface SidebarSection {
  title: string;
  items: NodeType[];
}

// Legacy exports - these types are now available in ./execution/types.ts