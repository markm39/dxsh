import { useState, useEffect, useCallback } from "react";
import { Node, Edge } from "reactflow";
import { Agent, ExecutionHistory, WorkflowResults } from "../types";
import { agentService, workflowService } from "../services";

export const useAgentManagement = (authHeaders: Record<string, string>) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [workflowResults, setWorkflowResults] = useState<WorkflowResults>({});

  const loadAgents = useCallback(async () => {
    try {
      const loadedAgents = await agentService.loadAgents(authHeaders);
      setAgents(loadedAgents);
      // Only set selected agent if none is currently selected
      setSelectedAgentId(prev => {
        if (!prev && loadedAgents.length > 0) {
          return loadedAgents[0].id;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  }, [authHeaders]);

  const loadWorkflow = useCallback(async (agentId: number, executeNodeFn?: (nodeId: string) => Promise<void>) => {
    try {
      const { nodes: loadedNodes, edges: loadedEdges } = await workflowService.loadWorkflow(agentId, authHeaders);
      
      // Valid node types for React Flow
      const validNodeTypes = new Set(['webSource', 'dataStructuring', 'aiProcessor', 'chartGenerator', 'linearRegression', 'randomForest', 'postgres', 'httpRequest', 'fileNode']);
      
      // Clean up and ensure all loaded nodes have valid types and handlers
      const nodesWithHandlers = loadedNodes
        .map((node: Node) => {
          // Debug node data
          console.log(`Loading node ${node.id}:`, {
            type: node.type,
            position: node.position,
            hasData: !!node.data
          });
          
          // Only migrate truly invalid types, be very conservative
          let nodeType = node.type;
          if (!node.type || (node.type && !validNodeTypes.has(node.type))) {
            // Only warn and migrate if type is actually invalid
            if (node.type !== 'webSource' && node.type !== 'aiProcessor' && node.type !== 'chartGenerator' && node.type !== 'linearRegression' && node.type !== 'randomForest' && node.type !== 'dataStructuring' && node.type !== 'postgres' && node.type !== 'httpRequest') {
              console.warn(`Found truly invalid node type "${node.type}" for node ${node.id}, migrating to dataStructuring`);
              nodeType = 'dataStructuring';
            } else {
              // Keep the original type if it's one of our known types
              nodeType = node.type;
            }
          }
          
          const processedNode = {
            ...node,
            type: nodeType,
            // Ensure position exists with valid numbers
            position: (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') 
              ? node.position 
              : { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
            data: {
              ...node.data,
              onExecute: executeNodeFn ? () => executeNodeFn(node.id) : undefined,
            }
          };
          
          if (node.type !== processedNode.type) {
            console.log(`Migrated node ${node.id}: ${node.type} -> ${processedNode.type}`);
          }
          
          return processedNode;
        });
      
      setNodes(nodesWithHandlers);
      setEdges(loadedEdges);
    } catch (error) {
      console.error("Failed to load workflow:", error);
    }
  }, [authHeaders, setNodes, setEdges]);

  const loadExecutionHistory = useCallback(async () => {
    if (!selectedAgentId) return;
    
    try {
      const history = await workflowService.loadExecutionHistory(selectedAgentId, authHeaders);
      setExecutionHistory(history);
    } catch (error) {
      console.error("Failed to load execution history:", error);
    }
  }, [selectedAgentId, authHeaders]);

  const saveWorkflow = useCallback(async (agentId: number, nodesToSave: Node[], edgesToSave: Edge[]) => {
    try {
      await workflowService.saveWorkflow(agentId, nodesToSave, edgesToSave, authHeaders);
    } catch (error) {
      console.error("Failed to save workflow:", error);
    }
  }, [authHeaders]);

  const deleteNode = useCallback(async (agentId: number, nodeId: string) => {
    try {
      const success = await workflowService.deleteNode(agentId, nodeId, authHeaders);
      if (!success) {
        console.error("Failed to delete node from database:", nodeId);
      }
      return success;
    } catch (error) {
      console.error("Failed to delete node:", error);
      return false;
    }
  }, [authHeaders]);


  useEffect(() => {
    loadAgents();
  }, []); // Run only once on mount

  // This will be called from the main component with the executeNode function
  const initializeWorkflow = useCallback((executeNodeFn: (nodeId: string) => Promise<void>) => {
    if (selectedAgentId) {
      loadWorkflow(selectedAgentId, executeNodeFn);
      loadExecutionHistory();
    }
  }, [selectedAgentId]); // Simplified dependencies

  return {
    agents,
    setAgents,
    selectedAgentId,
    setSelectedAgentId,
    nodes,
    setNodes,
    edges,
    setEdges,
    executionHistory,
    workflowResults,
    setWorkflowResults,
    loadAgents,
    loadWorkflow,
    loadExecutionHistory,
    saveWorkflow,
    deleteNode,
    initializeWorkflow,
  };
};