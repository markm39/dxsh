import React, { useState, useCallback, useRef } from "react";
import { Play, Loader2, Calculator, Target, LogOut, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  Background,
  Controls,
  ReactFlowProvider,
  MarkerType,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

// Setup Components
import WebMonitoringSetup from "../components/node-configs/WebMonitoringSetup";
import DataStructuringSetup from "../components/node-configs/DataStructuringSetup";
import AIProcessorSetup from "../components/node-configs/AIProcessorSetup";
import ChartGeneratorSetup from "../components/node-configs/ChartGeneratorSetup";
import LinearRegressionSetup from "../components/node-configs/LinearRegressionSetup";
import RandomForestSetup from "../components/node-configs/RandomForestSetup";
import PostgresSetup from "../components/node-configs/PostgresSetup";
import HttpRequestSetup from "../components/node-configs/HttpRequestSetup";
import FileNodeSetup from "../components/node-configs/FileNodeSetup";
import clsx from "clsx";

// Workflow Builder Components
import {
  AgentSidebar,
  NodeLibrary,
  WorkflowTabs,
  ExecutionHistoryList,
  WebSourceNode,
  AIProcessorNode,
  ChartGeneratorNode,
  RandomForestNode,
  PostgresNode,
  HttpRequestNode,
  FileNode,
  useAgentManagement,
  useWorkflowExecution,
  Agent,
} from "../components/workflow-builder";

// Legacy node components (until migrated)
import DataStructuringNode from "../components/nodes/DataStructuringNode";
import LinearRegressionNode from "../components/nodes/LinearRegressionNode";

import { useEnhancedWorkflowExecution } from "../components/workflow-builder/hooks/useEnhancedWorkflowExecution";

import { SIDEBAR_SECTIONS, DASHBOARD_TABS } from "../components/workflow-builder/constants";
import { agentService } from "../components/workflow-builder/services";

// Create enhanced node wrapper components outside the main component
const createEnhancedNodeWrapper = (NodeComponent: React.ComponentType<any>) => {
  return React.memo((props: any) => {
    // Access enhancement data from props.data
    const { cachedOutput, isExecutingEnhanced, canRunFromHere, runFromHereReason, onRunFromHere, onDelete, ...originalData } = props.data;
    
    // Pass enhanced data along with original props
    return (
      <NodeComponent
        {...props}
        data={{
          ...originalData,
          cachedOutput,
          isExecutingEnhanced,
          canRunFromHere,
          runFromHereReason,
        }}
        onRunFromHere={onRunFromHere}
        onDelete={onDelete}
      />
    );
  });
};

// Prediction Interface Component
interface PredictionInterfaceProps {
  features: string[];
  targetName: string;
  modelId: number;
  authHeaders: Record<string, string>;
}

const PredictionInterface: React.FC<PredictionInterfaceProps> = ({ 
  features, 
  targetName, 
  modelId, 
  authHeaders 
}) => {
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [prediction, setPrediction] = useState<number | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFeatureChange = (feature: string, value: string) => {
    setFeatureValues(prev => ({ ...prev, [feature]: value }));
    // Clear previous prediction when inputs change
    setPrediction(null);
    setError(null);
  };

  const handlePredict = async () => {
    // Validate all features have values
    const missingFeatures = features.filter(feature => !featureValues[feature]?.trim());
    if (missingFeatures.length > 0) {
      setError(`Please provide values for: ${missingFeatures.join(', ')}`);
      return;
    }

    setPredicting(true);
    setError(null);

    try {
      // Convert string values to numbers
      const numericFeatures: Record<string, number> = {};
      for (const feature of features) {
        const value = featureValues[feature];
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          throw new Error(`Invalid number for ${feature}: ${value}`);
        }
        numericFeatures[feature] = numValue;
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ml/models/${modelId}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          input_data: [numericFeatures]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Prediction failed');
      }

      const result = await response.json();
      if (result.success && result.predictions && result.predictions.length > 0) {
        setPrediction(result.predictions[0]);
      } else {
        throw new Error('No prediction returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="border-t border-border-subtle/50 pt-3 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-primary" />
        <span className="font-medium text-text-primary text-sm">Make Prediction</span>
      </div>
      
      <div className="space-y-2">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2">
            <label className="text-xs text-text-muted min-w-[80px] truncate" title={feature}>
              {feature}:
            </label>
            <input
              type="number"
              step="any"
              value={featureValues[feature] || ''}
              onChange={(e) => handleFeatureChange(feature, e.target.value)}
              className="flex-1 text-xs bg-background border border-border-subtle rounded px-2 py-1 focus:border-primary focus:outline-none"
              placeholder="Enter value..."
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handlePredict}
          disabled={predicting || features.some(f => !featureValues[f]?.trim())}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
        >
          {predicting ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Predicting...
            </>
          ) : (
            <>
              <Target className="w-3 h-3" />
              Predict {targetName}
            </>
          )}
        </button>

        {prediction !== null && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-muted">Prediction:</span>
            <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-mono border border-green-500/30">
              {typeof prediction === 'number' ? prediction.toFixed(3) : prediction}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
};

// Define node types outside component to prevent recreation
const nodeTypes = {
  webSource: createEnhancedNodeWrapper(WebSourceNode),
  dataStructuring: createEnhancedNodeWrapper(DataStructuringNode),
  aiProcessor: createEnhancedNodeWrapper(AIProcessorNode),
  chartGenerator: createEnhancedNodeWrapper(ChartGeneratorNode),
  linearRegression: createEnhancedNodeWrapper(LinearRegressionNode),
  randomForest: createEnhancedNodeWrapper(RandomForestNode),
  postgres: createEnhancedNodeWrapper(PostgresNode),
  httpRequest: createEnhancedNodeWrapper(HttpRequestNode),
  fileNode: createEnhancedNodeWrapper(FileNode),
  // Legacy node types for backwards compatibility
  dimensions: createEnhancedNodeWrapper(DataStructuringNode),
};

const AgentsDashboard: React.FC = () => {
  const { authHeaders, logout } = useAuth();
  
  // State management through custom hooks
  const {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    nodes,
    setNodes,
    edges,
    setEdges,
    executionHistory,
    setWorkflowResults,
    loadAgents,
    saveWorkflow,
    initializeWorkflow,
  } = useAgentManagement(authHeaders || {});

  // Local state for UI components
  const [showWebMonitoringSetup, setShowWebMonitoringSetup] = useState(false);
  const [showDataStructuringSetup, setShowDataStructuringSetup] = useState(false);
  const [showAIProcessorSetup, setShowAIProcessorSetup] = useState(false);
  const [showChartGeneratorSetup, setShowChartGeneratorSetup] = useState(false);
  const [showLinearRegressionSetup, setShowLinearRegressionSetup] = useState(false);
  const [showRandomForestSetup, setShowRandomForestSetup] = useState(false);
  const [showPostgresSetup, setShowPostgresSetup] = useState(false);
  const [showHttpRequestSetup, setShowHttpRequestSetup] = useState(false);
  const [showFileNodeSetup, setShowFileNodeSetup] = useState(false);
  const [selectedNodeForConfig, setSelectedNodeForConfig] = useState<string | null>(null);

  // Use React Flow's built-in state management
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState(edges);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    executeNode: legacyExecuteNode, 
  } = useWorkflowExecution(
    reactFlowNodes,
    reactFlowEdges,
    setReactFlowNodes,
    selectedAgentId,
    authHeaders || {},
    setWorkflowResults,
    saveWorkflow
  );

  // Use enhanced capabilities for all workflow operations
  const { 
    executeNode,
    executeWorkflow,
    workflowExecuting,
    executeFromNode,
    getNodeOutput,
    canRunFromNode,
    validateNodeConnection,
    isNodeExecuting
  } = useEnhancedWorkflowExecution(
    reactFlowNodes,
    reactFlowEdges,
    setReactFlowNodes,
    selectedAgentId,
    authHeaders || {},
    setWorkflowResults,
    saveWorkflow
  );

  // Helper function to get input data for a node from connected predecessors
  const getNodeInputData = (nodeId: string | null): any[] => {
    if (!nodeId) return [];
    
    // Find edges that connect to this node
    const incomingEdges = reactFlowEdges.filter(edge => edge.target === nodeId);
    
    if (incomingEdges.length === 0) return [];
    
    // Get data from the first connected source node
    const sourceNodeId = incomingEdges[0].source;
    const sourceNode = reactFlowNodes.find(node => node.id === sourceNodeId);
    
    if (!sourceNode) return [];
    
    // Check if the source node has execution results
    const executionResult = sourceNode.data?.executionResult;
    if (executionResult && Array.isArray(executionResult)) {
      console.log(`📊 Found input data for ${nodeId}:`, executionResult.slice(0, 2));
      return executionResult;
    }
    
    // Check for cached output data
    const cachedData = sourceNode.data?.cachedOutput?.data;
    if (cachedData && Array.isArray(cachedData)) {
      console.log(`💾 Found cached input data for ${nodeId}:`, cachedData.slice(0, 2));
      return cachedData;
    }
    
    console.log(`❌ No input data found for ${nodeId}`);
    return [];
  };

  // Initialize workflow when agent changes
  React.useEffect(() => {
    if (selectedAgentId && executeNode) {
      initializeWorkflow(executeNode);
    }
  }, [selectedAgentId]); // Only depend on selectedAgentId change

  // Local state
  const [activeTab, setActiveTab] = useState<string>("workflow");

  // Sync external nodes/edges to React Flow when they change
  React.useEffect(() => {
    setReactFlowNodes(nodes);
  }, [nodes, setReactFlowNodes]);

  React.useEffect(() => {
    setReactFlowEdges(edges);
  }, [edges, setReactFlowEdges]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (selectedAgentId) {
        saveWorkflow(selectedAgentId, reactFlowNodes, reactFlowEdges);
      }
    }, 500);
  }, [selectedAgentId, saveWorkflow, reactFlowNodes, reactFlowEdges]);

  // Simple handlers that use React Flow's built-in state management
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      
      // Save after position changes complete (not during drag)
      const positionChangeComplete = changes.some((change: any) => 
        change.type === 'position' && change.dragging === false
      );
      
      if (positionChangeComplete) {
        debouncedSave();
      }
    },
    [onNodesChange, debouncedSave]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      debouncedSave();
    },
    [onEdgesChange, debouncedSave]
  );


  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const remainingNodes = reactFlowNodes.filter(
        node => !deleted.find(d => d.id === node.id)
      );
      setReactFlowNodes(remainingNodes);
      debouncedSave();
    },
    [reactFlowNodes, edges, debouncedSave, setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      console.log('🗑️ WorkflowDashboard: Attempting to delete node:', nodeId);
      console.log('🗑️ Available nodes:', reactFlowNodes.map(n => ({ id: n.id, type: n.type })));
      
      const nodeToDelete = reactFlowNodes.find(node => node.id === nodeId);
      if (nodeToDelete) {
        console.log('🗑️ Found node to delete:', nodeToDelete);
        onNodesDelete([nodeToDelete]);
        console.log('🗑️ Called onNodesDelete with node:', nodeToDelete.id);
      } else {
        console.error('🗑️ Node not found for deletion:', nodeId);
      }
    },
    [reactFlowNodes, onNodesDelete]
  );

  // Drag and drop handlers
  const onDragStart = useCallback((event: React.DragEvent, type: string) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");

      if (!type) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const nodeId = `${type}_${Date.now()}`;
      const newNode: Node = {
        id: nodeId,
        type,
        position,
        data: {
          label: `New ${type}`,
          configured: false,
          onExecute: () => executeNode(nodeId),
        },
      };

      const newNodes = [...reactFlowNodes, newNode];
      setReactFlowNodes(newNodes);
      debouncedSave();
    },
    [setReactFlowNodes, reactFlowNodes, debouncedSave, executeNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === "webSource") {
      setSelectedNodeForConfig(node.id);
      setShowWebMonitoringSetup(true);
    } else if (node.type === "dataStructuring") {
      setSelectedNodeForConfig(node.id);
      setShowDataStructuringSetup(true);
    } else if (node.type === "aiProcessor") {
      setSelectedNodeForConfig(node.id);
      setShowAIProcessorSetup(true);
    } else if (node.type === "chartGenerator") {
      setSelectedNodeForConfig(node.id);
      setShowChartGeneratorSetup(true);
    } else if (node.type === "linearRegression") {
      setSelectedNodeForConfig(node.id);
      setShowLinearRegressionSetup(true);
    } else if (node.type === "randomForest") {
      setSelectedNodeForConfig(node.id);
      setShowRandomForestSetup(true);
    } else if (node.type === "postgres") {
      setSelectedNodeForConfig(node.id);
      setShowPostgresSetup(true);
    } else if (node.type === "httpRequest") {
      setSelectedNodeForConfig(node.id);
      setShowHttpRequestSetup(true);
    } else if (node.type === "fileNode") {
      setSelectedNodeForConfig(node.id);
      setShowFileNodeSetup(true);
    }
  }, []);

  // Enhanced "run from here" handler
  const handleRunFromNode = useCallback(async (nodeId: string) => {
    try {
      console.log(`🎯 Running workflow from node: ${nodeId}`);
      const result = await executeFromNode(nodeId);
      
      if (result.success) {
        console.log(`✅ Successfully executed from node ${nodeId} in ${result.executionTime}ms`);
      } else {
        console.error(`❌ Failed to execute from node ${nodeId}: ${result.error}`);
      }
    } catch (error) {
      console.error('Run from node failed:', error);
    }
  }, [executeFromNode]);

  // Enhanced connection validation
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      // Validate connection compatibility
      const validation = validateNodeConnection(params.source, params.target);
      
      if (!validation.isValid) {
        console.warn('Invalid connection attempt:', validation.errors.join(', '));
        // TODO: Show user-friendly error message
        return;
      }
      
      const newEdges = addEdge(
        {
          ...params,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#6b7280',
          },
          style: {
            stroke: '#6b7280',
            strokeWidth: 2,
          },
        },
        reactFlowEdges
      );
      setReactFlowEdges(newEdges);
      debouncedSave();
    },
    [setReactFlowEdges, reactFlowEdges, debouncedSave, validateNodeConnection]
  );

  // Agent management handlers
  const handleCreateAgent = useCallback(async () => {
    const name = prompt("Enter agent name:");
    const description = prompt("Enter agent description:");
    
    if (name && description && authHeaders) {
      const newAgent = await agentService.createAgent(name, description, authHeaders);
      if (newAgent) {
        await loadAgents();
        setSelectedAgentId(newAgent.id);
      }
    }
  }, [authHeaders, loadAgents]);

  const handleEditAgent = useCallback(async (agent: Agent) => {
    const name = prompt("Enter new agent name:", agent.name);
    const description = prompt("Enter new agent description:", agent.description);
    
    if (name && description && authHeaders) {
      const success = await agentService.updateAgent(agent.id, { name, description }, authHeaders);
      if (success) {
        await loadAgents();
      }
    }
  }, [authHeaders, loadAgents]);

  const handleDeleteAgent = useCallback(async (agentId: number) => {
    if (confirm("Are you sure you want to delete this agent?") && authHeaders) {
      const success = await agentService.deleteAgent(agentId, authHeaders);
      if (success) {
        await loadAgents();
        if (selectedAgentId === agentId) {
          setSelectedAgentId(null);
        }
      }
    }
  }, [authHeaders, loadAgents, selectedAgentId]);


  // Enhance React Flow nodes with execution data
  const enhancedNodes = React.useMemo(() => {
    return reactFlowNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        cachedOutput: getNodeOutput(node.id),
        isExecutingEnhanced: isNodeExecuting(node.id),
        canRunFromHere: canRunFromNode(node.id).canRun,
        runFromHereReason: canRunFromNode(node.id).reason,
        onRunFromHere: () => handleRunFromNode(node.id),
        onDelete: () => handleDeleteNode(node.id),
      }
    }));
  }, [reactFlowNodes, getNodeOutput, isNodeExecuting, canRunFromNode, handleRunFromNode, handleDeleteNode]);

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  return (
    <div className="flex h-screen bg-background">
      {/* Agent Sidebar */}
      <AgentSidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onCreateAgent={handleCreateAgent}
        onEditAgent={handleEditAgent}
        onDeleteAgent={handleDeleteAgent}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedAgent && (
          <>
            {/* Header */}
            <div className="border-b border-border-subtle bg-background p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-text-primary">
                    {selectedAgent.name}
                  </h1>
                  <p className="text-text-muted">{selectedAgent.description}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={executeWorkflow}
                    disabled={workflowExecuting || nodes.length === 0}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      workflowExecuting
                        ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                        : "bg-primary hover:bg-primary-hover text-white"
                    )}
                  >
                    {workflowExecuting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run Workflow
                      </>
                    )}
                  </button>
                  
                  {/* User Menu */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors border border-border-subtle"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <WorkflowTabs
              tabs={DASHBOARD_TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === "workflow" ? (
                <div className="flex-1 flex overflow-hidden">
                  {/* Node Library */}
                  <NodeLibrary
                    sections={SIDEBAR_SECTIONS}
                    onDragStart={onDragStart}
                  />

                  {/* Workflow Canvas */}
                  <div className="flex-1 relative">
                    <ReactFlowProvider>
                      <ReactFlow
                        nodes={enhancedNodes}
                        edges={reactFlowEdges}
                        onNodesChange={handleNodesChange}
                        onEdgesChange={handleEdgesChange}
                        onConnect={onConnect}
                        onNodesDelete={onNodesDelete}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        style={{ background: "transparent" }}
                        className="bg-surface rounded-lg"
                      >
                        <Background
                          color="rgb(var(--color-border-subtle))"
                          gap={20}
                          size={1}
                        />
                        <Controls
                          className="react-flow__controls"
                          style={{
                            background: "rgb(var(--color-background))",
                            border: "1px solid rgb(var(--color-border-subtle))",
                          }}
                        />
                        {reactFlowNodes.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                              <p className="text-lg text-text-muted mb-2">
                                No workflow nodes yet
                              </p>
                              <p className="text-sm text-text-muted">
                                Drag nodes from the library to build your workflow
                              </p>
                            </div>
                          </div>
                        )}
                      </ReactFlow>
                    </ReactFlowProvider>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Results Content */}
                  <div className="flex-1 p-6 overflow-y-auto">
                    {/* Workflow Results */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-text-primary">
                        Workflow Results
                      </h3>
                      {reactFlowNodes.filter(node => node.data?.executionResult !== undefined || node.data?.executionError).length > 0 ? (
                        <div className="space-y-3">
                          {reactFlowNodes
                            .filter(node => node.data?.executionResult !== undefined || node.data?.executionError)
                            .map((node) => {
                              const hasError = node.data?.executionError;
                              const hasResult = node.data?.executionResult !== undefined;
                              
                              return (
                                <div key={node.id} className="bg-surface border border-border-subtle rounded-lg p-4 hover:bg-surface-secondary/30 transition-colors">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-text-primary">
                                      {node.data?.label || node.id}
                                    </h4>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                      hasError ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                      hasResult ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                                      'bg-surface-secondary text-text-muted border border-border-subtle'
                                    }`}>
                                      {node.type}
                                    </span>
                                  </div>
                                  
                                  {hasError && (
                                    <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                      <p className="text-sm text-red-400 font-medium">Execution Error:</p>
                                      <p className="text-sm text-red-300 mt-1">
                                        {node.data.executionError?.message || String(node.data.executionError)}
                                      </p>
                                    </div>
                                  )}

                                  {hasResult && (
                                    <div className="space-y-3">
                                      {/* Show data based on node type */}
                                      {node.type === 'webSource' && (
                                        <div>
                                          <p className="text-sm font-medium text-text-secondary mb-2">Extracted Data:</p>
                                          <div className="bg-background/50 p-3 rounded-lg border border-border-subtle">
                                            {Array.isArray(node.data.executionResult) && node.data.executionResult.length > 0 ? (
                                              <div className="space-y-2">
                                                <p className="font-medium text-text-primary text-sm">Found {node.data.executionResult.length} items:</p>
                                                <div className="max-h-40 overflow-y-auto space-y-1">
                                                  {node.data.executionResult.slice(0, 5).map((item: any, idx: number) => (
                                                    <div key={idx} className="text-xs bg-surface-secondary/50 p-2 rounded border border-border-subtle/50 text-text-secondary font-mono">
                                                      {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                                                    </div>
                                                  ))}
                                                  {node.data.executionResult.length > 5 && (
                                                    <p className="text-xs text-text-muted">... and {node.data.executionResult.length - 5} more</p>
                                                  )}
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="text-text-muted text-sm">No data extracted</p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {node.type === 'linearRegression' && (
                                        <div>
                                          <p className="text-sm font-medium text-text-secondary mb-2">Linear Regression Results:</p>
                                          <div className="bg-background/50 p-3 rounded-lg border border-border-subtle space-y-3">
                                            {/* Model Performance */}
                                            {node.data.executionResult?.r_squared !== undefined && (
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-text-primary text-sm">R² Score:</span>
                                                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-sm font-mono border border-green-500/30">
                                                  {node.data.executionResult.r_squared.toFixed(4)}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {/* Model Summary */}
                                            {node.data.executionResult?.summary && (
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="flex justify-between">
                                                  <span className="text-text-muted">Features:</span>
                                                  <span className="font-mono text-text-secondary">{node.data.executionResult.summary.features?.length || 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-text-muted">Samples:</span>
                                                  <span className="font-mono text-text-secondary">{node.data.executionResult.summary.samplesUsed}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-text-muted">MSE:</span>
                                                  <span className="font-mono text-text-secondary">{node.data.executionResult.summary.mse?.toFixed(3)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-text-muted">MAE:</span>
                                                  <span className="font-mono text-text-secondary">{node.data.executionResult.summary.mae?.toFixed(3)}</span>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Target and Features */}
                                            {node.data.executionResult?.summary?.target && (
                                              <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="font-medium text-text-primary text-sm">Target:</span>
                                                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded border border-primary/30">
                                                    {node.data.executionResult.summary.target}
                                                  </span>
                                                </div>
                                                {node.data.executionResult.summary.features && (
                                                  <div>
                                                    <span className="font-medium text-text-primary text-sm">Features:</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                      {node.data.executionResult.summary.features.map((feature: string, idx: number) => (
                                                        <span key={idx} className="text-xs bg-surface-secondary/50 text-text-muted px-2 py-1 rounded border border-border-subtle/50">
                                                          {feature}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            
                                            {/* Coefficients */}
                                            {node.data.executionResult?.coefficients && (
                                              <div>
                                                <span className="font-medium text-text-primary text-sm">Coefficients:</span>
                                                <div className="text-xs bg-surface-secondary/30 p-2 rounded mt-1 border border-border-subtle/50 text-text-secondary font-mono max-h-20 overflow-y-auto">
                                                  {JSON.stringify(node.data.executionResult.coefficients, null, 2)}
                                                </div>
                                              </div>
                                            )}

                                            {/* Training Info */}
                                            {node.data.executionResult?.training_data && (
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-text-primary text-sm">Training Data:</span>
                                                <span className="text-xs text-text-muted">
                                                  {node.data.executionResult.training_data.length} samples
                                                </span>
                                              </div>
                                            )}

                                            {/* Prediction Interface */}
                                            {node.data.executionResult?.summary?.features && node.data.executionResult.model && (
                                              <PredictionInterface 
                                                features={node.data.executionResult.summary.features}
                                                targetName={node.data.executionResult.summary.target}
                                                modelId={node.data.executionResult.model.id}
                                                authHeaders={authHeaders}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {(node.type === 'aiProcessor' || node.type === 'chartGenerator') && (
                                        <div>
                                          <p className="text-sm font-medium text-text-secondary mb-2">
                                            {node.type === 'aiProcessor' ? 'AI Processing Result:' : 'Chart Data:'}
                                          </p>
                                          <div className="bg-background/50 p-3 rounded-lg border border-border-subtle">
                                            <pre className="whitespace-pre-wrap text-xs text-text-secondary font-mono overflow-x-auto">
                                              {typeof node.data.executionResult === 'object' 
                                                ? JSON.stringify(node.data.executionResult, null, 2)
                                                : String(node.data.executionResult)
                                              }
                                            </pre>
                                          </div>
                                        </div>
                                      )}

                                      {node.data?.lastExecuted && (
                                        <p className="text-xs text-text-muted border-t border-border-subtle/50 pt-2 mt-3">
                                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-text-muted">No results yet</p>
                          <p className="text-sm text-text-muted mt-2">
                            Run your workflow to see results here
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Minimal Execution History at bottom */}
                  <div className="border-t border-border-subtle/50 bg-surface/30 p-3">
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-text-muted hover:text-text-secondary flex items-center gap-2 transition-colors">
                        <span>Execution History</span>
                        <span className="text-xs bg-surface-secondary/50 border border-border-subtle/50 px-2 py-1 rounded-full text-text-muted">
                          {executionHistory.length} runs
                        </span>
                      </summary>
                      <div className="mt-3 max-h-32 overflow-y-auto">
                        <ExecutionHistoryList history={executionHistory} />
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!selectedAgent && (
          <div className="flex-1 flex flex-col">
            {/* Header when no agent selected */}
            <div className="border-b border-border-subtle bg-background p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-text-primary">Dxsh Workflow Builder</h1>
                  <p className="text-text-muted">Visual workflow automation platform</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors border border-border-subtle"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg text-text-muted mb-4">No agent selected</p>
                <button
                  onClick={handleCreateAgent}
                  className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
                >
                  Create Your First Agent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Setup Modals */}
      {showWebMonitoringSetup && selectedNodeForConfig && (
        <WebMonitoringSetup
          onClose={() => {
            setShowWebMonitoringSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onMonitoringCreated={(config: any) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      monitoring: config,
                      // Set extracted data as node output immediately
                      executionResult: config.extractedData,
                      lastExecuted: config.extractedData ? new Date().toISOString() : null,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowWebMonitoringSetup(false);
            setSelectedNodeForConfig(null);
          }}
          agentId={selectedAgentId || undefined}
          nodeId={selectedNodeForConfig}
          existingMonitoring={(() => {
            const node = reactFlowNodes.find((n) => n.id === selectedNodeForConfig);
            if (!node) return undefined;
            
            const monitoring = node.data?.monitoring || {};
            
            // Ensure extractedData includes the current executionResult if available
            return {
              ...monitoring,
              extractedData: node.data?.executionResult || monitoring.extractedData || []
            };
          })()}
        />
      )}

      {showDataStructuringSetup && selectedNodeForConfig && (
        <DataStructuringSetup
          isOpen={true}
          onClose={() => {
            setShowDataStructuringSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onSave={(config) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      structuring: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowDataStructuringSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.structuring
          }
          inputData={[]}
          sourceNodeData={[]}
        />
      )}

      {showAIProcessorSetup && selectedNodeForConfig && (
        <AIProcessorSetup
          onClose={() => {
            setShowAIProcessorSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onProcessorCreated={(config: any) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      processor: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            
            // Save immediately with the updated nodes
            if (selectedAgentId) {
              saveWorkflow(selectedAgentId, updatedNodes, reactFlowEdges);
            }
            
            setShowAIProcessorSetup(false);
            setSelectedNodeForConfig(null);
          }}
          agentId={selectedAgentId}
          nodeId={selectedNodeForConfig}
          existingProcessor={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.processor
          }
          inputData={[]}
        />
      )}

      {showChartGeneratorSetup && selectedNodeForConfig && (
        <ChartGeneratorSetup
          onClose={() => {
            setShowChartGeneratorSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onSave={(config) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      chartGenerator: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowChartGeneratorSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.chartGenerator
          }
          inputData={[]}
          agentId={selectedAgentId || undefined}
          nodeId={selectedNodeForConfig}
        />
      )}

      {showLinearRegressionSetup && selectedNodeForConfig && (
        <LinearRegressionSetup
          onClose={() => {
            setShowLinearRegressionSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onSave={(config) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      model: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowLinearRegressionSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.model
          }
          inputData={(() => {
            // Get input data from connected nodes' execution results
            const currentNode = reactFlowNodes.find((n) => n.id === selectedNodeForConfig);
            if (!currentNode) return [];
            
            // Find edges that connect to this node
            const incomingEdges = reactFlowEdges.filter(edge => edge.target === selectedNodeForConfig);
            if (incomingEdges.length === 0) return [];
            
            // Get the source node's execution result
            const sourceEdge = incomingEdges[0]; // Take first input for now
            const sourceNode = reactFlowNodes.find(n => n.id === sourceEdge.source);
            
            if (sourceNode?.data?.executionResult) {
              console.log('🔗 Found input data for linear regression from connected node:', sourceNode.data.executionResult);
              
              // Handle different data structures
              const result = sourceNode.data.executionResult;
              
              // If it's already an array, use it directly
              if (Array.isArray(result)) {
                // Check if the array contains table objects (webSource format)
                if (result.length > 0 && typeof result[0] === 'object') {
                  // Look for table data within the objects
                  const flattenedData = [];
                  for (const item of result) {
                    if (typeof item === 'object' && item !== null) {
                      // Extract table data from webSource results
                      for (const [key, value] of Object.entries(item)) {
                        if (Array.isArray(value) && value.length > 0 && 
                            typeof value[0] === 'object' && 
                            !key.startsWith('_')) {
                          // This looks like table data
                          console.log(`📊 Found table data in key "${key}":`, value);
                          flattenedData.push(...value);
                        }
                      }
                    }
                  }
                  if (flattenedData.length > 0) {
                    console.log('📊 Using flattened table data:', flattenedData);
                    return flattenedData;
                  }
                }
                return result;
              }
              
              // If it has a .data property, use that
              if (result.data) {
                return Array.isArray(result.data) ? result.data : [result.data];
              }
              
              // Check if the result object contains table data
              if (typeof result === 'object' && result !== null) {
                for (const [key, value] of Object.entries(result)) {
                  if (Array.isArray(value) && value.length > 0 && 
                      typeof value[0] === 'object' && 
                      !key.startsWith('_')) {
                    console.log(`📊 Found table data in key "${key}":`, value);
                    return value;
                  }
                }
              }
              
              // Otherwise wrap the result in an array
              return [result];
            }
            
            console.log('🔗 No execution result found for connected node:', sourceNode?.data);
            return [];
          })()}
          agentId={selectedAgentId || undefined}
          nodeId={selectedNodeForConfig}
        />
      )}

      {showRandomForestSetup && selectedNodeForConfig && (
        <RandomForestSetup
          onClose={() => {
            setShowRandomForestSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onSave={(config) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      model: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowRandomForestSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.model
          }
          inputData={(() => {
            // Get input data from connected nodes (same logic as linear regression)
            const currentNode = reactFlowNodes.find((n) => n.id === selectedNodeForConfig);
            if (!currentNode) return [];
            
            const incomingEdges = reactFlowEdges.filter(edge => edge.target === selectedNodeForConfig);
            if (incomingEdges.length === 0) return [];
            
            const sourceEdge = incomingEdges[0];
            const sourceNode = reactFlowNodes.find(n => n.id === sourceEdge.source);
            
            if (sourceNode?.data?.executionResult) {
              const result = sourceNode.data.executionResult;
              
              if (Array.isArray(result)) {
                if (result.length > 0 && typeof result[0] === 'object') {
                  const flattenedData = [];
                  for (const item of result) {
                    if (typeof item === 'object' && item !== null) {
                      for (const [key, value] of Object.entries(item)) {
                        if (Array.isArray(value) && value.length > 0 && 
                            typeof value[0] === 'object' && !key.startsWith('_')) {
                          flattenedData.push(...value);
                        }
                      }
                    }
                  }
                  if (flattenedData.length > 0) return flattenedData;
                }
                return result;
              }
              
              if (result.data) {
                return Array.isArray(result.data) ? result.data : [result.data];
              }
              
              if (typeof result === 'object' && result !== null) {
                for (const [key, value] of Object.entries(result)) {
                  if (Array.isArray(value) && value.length > 0 && 
                      typeof value[0] === 'object' && !key.startsWith('_')) {
                    return value;
                  }
                }
              }
              
              return [result];
            }
            
            return [];
          })()}
          agentId={selectedAgentId || undefined}
          nodeId={selectedNodeForConfig}
        />
      )}

      {showPostgresSetup && selectedNodeForConfig && (
        <PostgresSetup
          onClose={() => {
            setShowPostgresSetup(false);
            setSelectedNodeForConfig(null);
          }}
          inputData={getNodeInputData(selectedNodeForConfig)}
          onSave={(config) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      postgres: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowPostgresSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.postgres
          }
        />
      )}

      {showHttpRequestSetup && selectedNodeForConfig && (
        <HttpRequestSetup
          onClose={() => {
            setShowHttpRequestSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onSave={(config) => {
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      httpRequest: config,
                      label: `HTTP ${config.method} (${new URL(config.url).hostname})`
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowHttpRequestSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.httpRequest
          }
          inputData={getNodeInputData(selectedNodeForConfig)}
          isConfigured={!!reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.configured}
          agentId={selectedAgentId || undefined}
          nodeId={selectedNodeForConfig}
        />
      )}

      {showFileNodeSetup && selectedNodeForConfig && (
        <FileNodeSetup
          onClose={() => {
            setShowFileNodeSetup(false);
            setSelectedNodeForConfig(null);
          }}
          onSave={(config) => {
            console.log('💾 Saving FileNode config to node data:', config);
            console.log('💾 FilePath in config:', config.filePath);
            
            const updatedNodes = reactFlowNodes.map((node) =>
              node.id === selectedNodeForConfig
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      configured: true,
                      fileNode: config,
                    },
                  }
                : node
            );
            setReactFlowNodes(updatedNodes);
            debouncedSave();
            
            setShowFileNodeSetup(false);
            setSelectedNodeForConfig(null);
          }}
          initialConfig={
            reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.fileNode
          }
          inputData={getNodeInputData(selectedNodeForConfig)}
          isConfigured={!!reactFlowNodes.find((n) => n.id === selectedNodeForConfig)?.data?.configured}
        />
      )}
    </div>
  );
};

export default AgentsDashboard;