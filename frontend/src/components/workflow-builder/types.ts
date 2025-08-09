import { Node, Edge } from "reactflow";
import { WorkflowNodeData, NodeOutput, ExecutionStatus } from "./workflow-types";

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
  id: 'workflow' | 'dashboard';
  label: string;
  icon: React.ReactNode;
}

export interface SidebarSection {
  title: string;
  items: NodeType[];
}

// Export enhanced types for the new system
export type { WorkflowNodeData as EnhancedNodeData };
export type { NodeOutput, ExecutionStatus };