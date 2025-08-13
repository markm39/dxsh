/**
 * Legacy Workflow Execution Hook (Enhanced)
 * 
 * This hook maintains backward compatibility while internally using the new
 * WorkflowExecutionEngine for improved performance and type safety.
 */

import { Node, Edge } from "reactflow";
import { WorkflowResults } from "../types";
import { useEnhancedWorkflowExecution } from "./useEnhancedWorkflowExecution";

export const useWorkflowExecution = (
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void,
  selectedAgentId: number | null,
  authHeaders: Record<string, string>,
  setWorkflowResults: (results: WorkflowResults | ((prev: WorkflowResults) => WorkflowResults)) => void,
  saveWorkflow: (agentId: number, nodes: Node[], edges: Edge[]) => Promise<void>
) => {
  // Use the enhanced hook internally but only expose legacy interface
  const enhanced = useEnhancedWorkflowExecution(
    nodes,
    edges,
    setNodes,
    selectedAgentId,
    authHeaders,
    setWorkflowResults,
    saveWorkflow
  );

  // Return only the legacy interface for backward compatibility
  return {
    executeNode: enhanced.executeNode,
    executeWorkflow: enhanced.executeWorkflow,
    workflowExecuting: enhanced.workflowExecuting,
  };
};