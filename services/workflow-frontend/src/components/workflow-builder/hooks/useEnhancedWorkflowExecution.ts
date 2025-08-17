/**
 * Enhanced Workflow Execution Hook
 * 
 * This hook integrates the new WorkflowExecutionEngine with the existing React
 * workflow system, providing typed execution, caching, and "run from any node" support.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Node, Edge } from "reactflow";
import { WorkflowExecutionEngine, ExecutionContext, ExecutionResult } from "../workflow-execution-engine";
import { WorkflowResults, NodeData } from "../types";
import { 
  NodeOutput, 
  ExecutionStatus, 
  WorkflowNodeData, 
  NODE_DEFINITIONS,
  DataType
} from "../workflow-types";

export interface EnhancedWorkflowExecutionHook {
  // Legacy compatibility
  executeNode: (nodeId: string) => Promise<void>;
  executeWorkflow: () => Promise<void>;
  workflowExecuting: boolean;
  
  // New enhanced functionality
  executeFromNode: (nodeId: string) => Promise<ExecutionResult>;
  getNodeOutput: (nodeId: string) => NodeOutput | undefined;
  getExecutionHistory: (nodeId?: string) => NodeOutput[];
  isNodeExecuting: (nodeId: string) => boolean;
  canRunFromNode: (nodeId: string) => { canRun: boolean; reason?: string };
  
  // Data flow analysis
  getUpstreamNodes: (nodeId: string) => string[];
  getDownstreamNodes: (nodeId: string) => string[];
  validateNodeConnection: (sourceId: string, targetId: string) => { isValid: boolean; errors: string[] };
}

export const useEnhancedWorkflowExecution = (
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void,
  selectedAgentId: number | null,
  authHeaders: Record<string, string>,
  setWorkflowResults: (results: WorkflowResults | ((prev: WorkflowResults) => WorkflowResults)) => void,
  saveWorkflow: (agentId: number, nodes: Node[], edges: Edge[]) => Promise<void>
): EnhancedWorkflowExecutionHook => {

  const [workflowExecuting, setWorkflowExecuting] = useState(false);
  const [executingNodes, setExecutingNodes] = useState<Set<string>>(new Set());
  
  // Persistent cache across hook re-renders
  const outputCacheRef = useRef<Map<string, NodeOutput>>(new Map());
  const executionEngineRef = useRef<WorkflowExecutionEngine | null>(null);

  // Initialize or update execution engine when context changes
  useEffect(() => {
    if (!selectedAgentId) {
      executionEngineRef.current = null;
      return;
    }

    const context: ExecutionContext = {
      agentId: selectedAgentId,
      authHeaders,
      nodes: enhanceNodesWithTypes(nodes),
      edges,
      outputCache: outputCacheRef.current,
      onNodeUpdate: (nodeId: string, updates: any) => {
        // Update the node data with execution results
        setNodes(currentNodes => 
          currentNodes.map(node => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          )
        );
      }
    };

    if (executionEngineRef.current) {
      executionEngineRef.current.updateContext(context);
    } else {
      executionEngineRef.current = new WorkflowExecutionEngine(context);
    }
  }, [nodes, edges, selectedAgentId, authHeaders]);

  /**
   * Enhance legacy nodes with type information for backward compatibility
   */
  const enhanceNodesWithTypes = useCallback((nodes: Node[]): Node[] => {
    return nodes.map(node => {
      const nodeData = node.data as NodeData;
      const definition = NODE_DEFINITIONS[node.type];
      
      if (!definition) {
        console.warn(`Unknown node type: ${node.type}, using default definition`);
      }

      const enhancedData: WorkflowNodeData = {
        ...nodeData,
        isExecuting: nodeData.isExecuting || false,
        nodeDefinition: definition || {
          nodeType: node.type,
          category: 'processing' as any,
          acceptedInputs: [DataType.ANY],
          outputType: DataType.ANY,
          minInputs: 0,
          maxInputs: 1,
          displayName: node.type,
          description: `Legacy ${node.type} node`
        },
        inputSources: getUpstreamNodes(node.id),
        executionStatus: nodeData.executionError ? ExecutionStatus.ERROR : 
                        nodeData.executionResult ? ExecutionStatus.SUCCESS : 
                        nodeData.isExecuting ? ExecutionStatus.RUNNING : 
                        ExecutionStatus.PENDING,
        executionId: nodeData.lastExecuted ? `legacy_${nodeData.lastExecuted}` : undefined
      };

      return {
        ...node,
        data: enhancedData
      };
    });
  }, [edges]);

  /**
   * Get upstream node IDs for a given node
   */
  const getUpstreamNodes = useCallback((nodeId: string): string[] => {
    return edges.filter(edge => edge.target === nodeId).map(edge => edge.source);
  }, [edges]);

  /**
   * Get downstream node IDs for a given node  
   */
  const getDownstreamNodes = useCallback((nodeId: string): string[] => {
    return edges.filter(edge => edge.source === nodeId).map(edge => edge.target);
  }, [edges]);

  /**
   * Enhanced execute from node with full typing and caching
   */
  const executeFromNode = useCallback(async (nodeId: string): Promise<ExecutionResult> => {
    if (!executionEngineRef.current) {
      throw new Error('Execution engine not initialized');
    }

    console.log(`🎯 Enhanced execution from node: ${nodeId}`);
    
    // Mark node as executing
    setExecutingNodes(prev => new Set([...prev, nodeId]));
    setNodes(prevNodes => 
      prevNodes.map(n => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, isExecuting: true, executionError: null } }
          : n
      )
    );

    try {
      const result = await executionEngineRef.current.executeFromNode(nodeId, true); // Force execution, no caching
      
      if (result.success && result.output) {
        // Update node state with successful result
        setNodes(prevNodes => 
          prevNodes.map(n => 
            n.id === nodeId 
              ? { 
                  ...n, 
                  data: { 
                    ...n.data, 
                    isExecuting: false,
                    executionResult: result.output!.data,
                    lastExecuted: result.output!.timestamp,
                    executionStatus: result.output!.executionStatus
                  } 
                }
              : n
          )
        );

        // Update workflow results for dashboard display
        setWorkflowResults(prev => ({
          ...prev,
          [nodeId]: result.output!.data
        }));

        // Save updated workflow state
        if (selectedAgentId) {
          const updatedNodes = nodes.map(n => 
            n.id === nodeId 
              ? { ...n, data: { ...n.data, executionResult: result.output!.data } }
              : n
          );
          await saveWorkflow(selectedAgentId, updatedNodes, edges);
        }

        console.log(`✅ Enhanced execution completed for ${nodeId} in ${result.executionTime}ms`);
      } else {
        // Handle execution error
        console.error(`❌ Enhanced execution failed for ${nodeId}: ${result.error}`);
        
        setNodes(prevNodes => 
          prevNodes.map(n => 
            n.id === nodeId 
              ? { 
                  ...n, 
                  data: { 
                    ...n.data, 
                    isExecuting: false,
                    executionError: new Error(result.error || 'Unknown error'),
                    executionStatus: ExecutionStatus.ERROR
                  } 
                }
              : n
          )
        );
      }

      return result;
      
    } finally {
      setExecutingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [nodes, edges, selectedAgentId, setNodes, setWorkflowResults, saveWorkflow]);

  /**
   * Legacy executeNode for backward compatibility
   */
  const executeNode = useCallback(async (nodeId: string): Promise<void> => {
    const result = await executeFromNode(nodeId);
    
    if (!result.success) {
      throw new Error(result.error || 'Node execution failed');
    }
  }, [executeFromNode]);

  /**
   * Enhanced workflow execution
   */
  const executeWorkflow = useCallback(async (): Promise<void> => {
    if (!executionEngineRef.current || !selectedAgentId) return;

    console.log('🏁 Starting enhanced workflow execution');
    setWorkflowExecuting(true);
    setWorkflowResults({});

    try {
      const results = await executionEngineRef.current.executeWorkflow();
      
      console.log(`🎉 Workflow execution completed: ${results.length} nodes executed`);
      
      // Update node states with execution results
      setNodes(prevNodes => 
        prevNodes.map(node => {
          const result = results.find(r => r.output?.nodeId === node.id);
          if (result && result.output) {
            return {
              ...node,
              data: {
                ...node.data,
                isExecuting: false,
                executionResult: result.output.data,
                lastExecuted: result.output.timestamp,
                executionStatus: result.output.executionStatus,
                executionError: result.success ? null : new Error(result.error || 'Execution failed')
              }
            };
          }
          return node;
        })
      );

      // Update workflow results for dashboard display
      const workflowResultsUpdate: WorkflowResults = {};
      results.forEach(result => {
        if (result.success && result.output) {
          workflowResultsUpdate[result.output.nodeId] = result.output.data;
        }
      });
      setWorkflowResults(prev => ({ ...prev, ...workflowResultsUpdate }));

      // Save updated workflow state
      if (selectedAgentId) {
        const updatedNodes = nodes.map(node => {
          const result = results.find(r => r.output?.nodeId === node.id);
          if (result && result.output) {
            return { 
              ...node, 
              data: { 
                ...node.data, 
                executionResult: result.output.data,
                executionError: result.success ? null : new Error(result.error || 'Execution failed')
              } 
            };
          }
          return node;
        });
        await saveWorkflow(selectedAgentId, updatedNodes, edges);
      }
      
      // Log results summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`📊 Results: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      throw error;
    } finally {
      setWorkflowExecuting(false);
    }
  }, [selectedAgentId, setWorkflowResults]);

  /**
   * Get cached output for a node
   */
  const getNodeOutput = useCallback((nodeId: string): NodeOutput | undefined => {
    return outputCacheRef.current.get(nodeId);
  }, []);

  /**
   * Get execution history
   */
  const getExecutionHistory = useCallback((nodeId?: string): NodeOutput[] => {
    if (!executionEngineRef.current) return [];
    return executionEngineRef.current.getExecutionHistory(nodeId);
  }, []);

  /**
   * Check if a node is currently executing
   */
  const isNodeExecuting = useCallback((nodeId: string): boolean => {
    return executingNodes.has(nodeId);
  }, [executingNodes]);

  /**
   * Check if we can run from a specific node
   */
  const canRunFromNode = useCallback((nodeId: string): { canRun: boolean; reason?: string } => {
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) {
      return { canRun: false, reason: 'Node not found' };
    }

    if (!node.data.configured) {
      return { canRun: false, reason: 'Node not configured' };
    }

    if (executingNodes.has(nodeId)) {
      return { canRun: false, reason: 'Node is currently executing' };
    }

    if (!selectedAgentId) {
      return { canRun: false, reason: 'No agent selected' };
    }

    // Check if upstream nodes have valid outputs (for processing/sink nodes)
    const definition = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
    if (definition && definition.minInputs > 0) {
      const upstreamNodeIds = getUpstreamNodes(nodeId);
      
      if (upstreamNodeIds.length < definition.minInputs) {
        return { 
          canRun: false, 
          reason: `Requires at least ${definition.minInputs} input connection(s)` 
        };
      }

      // Check if upstream nodes have outputs or can be executed
      for (const upstreamId of upstreamNodeIds) {
        const output = getNodeOutput(upstreamId);
        const upstreamNode = nodes.find(n => n.id === upstreamId);
        
        if (!output && (!upstreamNode?.data.configured)) {
          return { 
            canRun: false, 
            reason: `Upstream node ${upstreamId} is not configured` 
          };
        }
      }
    }

    return { canRun: true };
  }, [nodes, executingNodes, selectedAgentId, getUpstreamNodes, getNodeOutput]);

  /**
   * Validate a potential node connection
   */
  // Helper function to determine actual output data type based on node configuration
  const getActualOutputType = useCallback((node: Node): DataType => {
    const baseDef = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
    if (!baseDef) return DataType.RAW_DATA;

    // Handle Web Source dynamic output type
    if (node.type === 'webSource') {
      const config = node.data;
      
      // Check monitoring config if present (this is where the actual config is stored)
      const monitoringConfig = config?.monitoring || config;
      
      // Check if it's configured for table/structured output
      // Table mode selectors have type: 'table'
      // Repeating mode selectors have type: 'repeating' and also produce structured data
      const selectors = monitoringConfig?.selectors || config?.selectors;
      
      if (selectors?.some((s: any) => s.type === 'table' || s.type === 'repeating')) {
        return DataType.STRUCTURED_DATA;
      }
      
      // Check if it's configured and has multiple selectors (structured format)
      if (monitoringConfig?.configured && selectors && selectors.length > 1) {
        return DataType.STRUCTURED_DATA;
      }
      
      // Single text-based selectors output text data
      if (monitoringConfig?.configured && selectors && selectors.length === 1) {
        const selector = selectors[0];
        if (selector.attribute === 'textContent' || selector.attribute === 'innerText') {
          return DataType.TEXT_DATA;
        }
      }
      
      // Check if configured but no specific type detected
      if (monitoringConfig?.configured) {
        return DataType.STRUCTURED_DATA; // If configured, assume structured output
      }
      
      // Default to raw data if not specifically configured
      return DataType.RAW_DATA;
    }

    // Handle other node types with dynamic output
    if (node.type === 'aiProcessor') {
      // AI processors can output different types based on their prompt
      const config = node.data;
      if (config?.outputType) {
        return config.outputType;
      }
      return DataType.TEXT_DATA; // Default for AI processor
    }

    // Use the base definition for other node types
    return baseDef.outputType;
  }, []);

  const validateNodeConnection = useCallback((sourceId: string, targetId: string): { isValid: boolean; errors: string[] } => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) {
      return { isValid: false, errors: ['Source or target node not found'] };
    }

    const sourceDef = NODE_DEFINITIONS[sourceNode.type as keyof typeof NODE_DEFINITIONS];
    const targetDef = NODE_DEFINITIONS[targetNode.type as keyof typeof NODE_DEFINITIONS];

    if (!sourceDef || !targetDef) {
      return { isValid: false, errors: ['Unknown node type'] };
    }

    // Get the actual output type based on node configuration
    const actualOutputType = getActualOutputType(sourceNode);

    // Check data type compatibility using actual output type
    const isCompatible = targetDef.acceptedInputs.includes(actualOutputType) ||
                        targetDef.acceptedInputs.includes(DataType.ANY);

    if (!isCompatible) {
      return {
        isValid: false,
        errors: [`${sourceDef.displayName} outputs ${actualOutputType} but ${targetDef.displayName} requires ${targetDef.acceptedInputs.join(' or ')}`]
      };
    }

    // Check input limits
    const currentInputs = getUpstreamNodes(targetId).length;
    if (currentInputs >= targetDef.maxInputs) {
      return {
        isValid: false,
        errors: [`${targetDef.displayName} accepts maximum ${targetDef.maxInputs} inputs`]
      };
    }

    return { isValid: true, errors: [] };
  }, [nodes, getUpstreamNodes, getActualOutputType]);

  return {
    // Legacy compatibility
    executeNode,
    executeWorkflow, 
    workflowExecuting,
    
    // Enhanced functionality
    executeFromNode,
    getNodeOutput,
    getExecutionHistory,
    isNodeExecuting,
    canRunFromNode,
    
    // Data flow analysis
    getUpstreamNodes,
    getDownstreamNodes,
    validateNodeConnection
  };
};