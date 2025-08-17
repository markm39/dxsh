import { 
  ExecutionContext, 
  ExecutionResult, 
  NodeOutput, 
  Node, 
  WorkflowNodeData,
  DataType,
  ExecutionStatus 
} from './types';
import { NODE_DEFINITIONS } from '../workflow-types';
import { WebSourceExecutor } from './WebSourceExecutor';
import { HTTPExecutor } from './HTTPExecutor';
import { DataProcessingExecutor } from './DataProcessingExecutor';
import { DatabaseExecutor } from './DatabaseExecutor';

export class WorkflowExecutionEngine {
  private outputCache = new Map<string, NodeOutput>();
  private executionQueue = new Set<string>();
  private executionHistory: NodeOutput[] = [];
  
  // Executors for different node types
  private webSourceExecutor: WebSourceExecutor;
  private httpExecutor: HTTPExecutor;
  private dataProcessingExecutor: DataProcessingExecutor;
  private databaseExecutor: DatabaseExecutor;

  constructor(private context: ExecutionContext) {
    // Use provided output cache if available, otherwise create new one
    if (context.outputCache) {
      this.outputCache = context.outputCache;
    }
    
    this.webSourceExecutor = new WebSourceExecutor(context);
    this.httpExecutor = new HTTPExecutor(context);
    this.dataProcessingExecutor = new DataProcessingExecutor(context);
    this.databaseExecutor = new DatabaseExecutor(context);
  }

  /**
   * Update the execution context (for compatibility with existing hooks)
   */
  updateContext(newContext: ExecutionContext): void {
    this.context = newContext;
    
    // Update output cache if provided
    if (newContext.outputCache) {
      this.outputCache = newContext.outputCache;
    }
    
    this.webSourceExecutor = new WebSourceExecutor(newContext);
    this.httpExecutor = new HTTPExecutor(newContext);
    this.dataProcessingExecutor = new DataProcessingExecutor(newContext);
    this.databaseExecutor = new DatabaseExecutor(newContext);
  }

  /**
   * Execute a subgraph starting from a specific node
   */
  async executeSubgraph(nodeId: string, forceStartingNode: boolean = false): Promise<ExecutionResult[]> {
    console.log(` Starting subgraph execution from node ${nodeId}`);
    
    const results: ExecutionResult[] = [];
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
      const currentNodeId = stack.pop()!;
      
      if (visited.has(currentNodeId)) {
        continue;
      }
      
      visited.add(currentNodeId);
      
      try {
        const result = await this.executeNode(currentNodeId, forceStartingNode && currentNodeId === nodeId);
        results.push(result);
        
        // Find downstream nodes
        const downstreamNodes = this.getDownstreamNodes(currentNodeId);
        stack.push(...downstreamNodes.reverse()); // Reverse to maintain order
        
      } catch (error: any) {
        console.error(` Node ${currentNodeId} execution failed:`, error);
        results.push({
          nodeId: currentNodeId,
          success: false,
          error: error.message || 'Unknown error'
        });
        
        // Continue with other nodes even if one fails
        const downstreamNodes = this.getDownstreamNodes(currentNodeId);
        stack.push(...downstreamNodes.reverse());
      }
    }

    console.log(` Subgraph execution completed. ${results.length} nodes processed.`);
    return results;
  }

  /**
   * Execute a single node
   */
  async executeNode(nodeId: string, forceExecution: boolean = false): Promise<ExecutionResult> {
    console.log(` Executing node ${nodeId} (force: ${forceExecution})`);
    
    if (this.executionQueue.has(nodeId)) {
      throw new Error(`Circular dependency detected involving node ${nodeId}`);
    }

    this.executionQueue.add(nodeId);

    try {
      const node = this.getNode(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Check if we have cached output and don't need to force execution
      if (!forceExecution && this.outputCache.has(nodeId)) {
        console.log(` Using cached output for node ${nodeId}`);
        const cachedOutput = this.outputCache.get(nodeId)!;
        return {
          nodeId,
          success: true,
          output: cachedOutput
        };
      }

      // Gather inputs from upstream nodes
      const inputs = await this.gatherInputs(nodeId);
      
      // Execute the node logic
      const output = await this.executeNodeLogic(node, inputs);
      
      // Cache the output
      this.cacheOutput(nodeId, output);
      
      // Notify context about node update
      if (this.context.onNodeUpdate) {
        this.context.onNodeUpdate(nodeId, {
          executionResult: output.data,
          lastExecuted: output.timestamp,
          executionStatus: output.executionStatus
        });
      }

      return {
        nodeId,
        success: true,
        output
      };

    } catch (error: any) {
      console.error(` Node ${nodeId} execution failed:`, error);
      
      // Notify context about node error
      if (this.context.onNodeUpdate) {
        this.context.onNodeUpdate(nodeId, {
          executionStatus: ExecutionStatus.ERROR,
          error: error.message || 'Unknown error'
        });
      }

      return {
        nodeId,
        success: false,
        error: error.message || 'Unknown error'
      };
    } finally {
      this.executionQueue.delete(nodeId);
    }
  }

  /**
   * Gather inputs from upstream nodes
   */
  private async gatherInputs(nodeId: string): Promise<NodeOutput[]> {
    const upstreamNodeIds = this.getUpstreamNodes(nodeId);
    const inputs: NodeOutput[] = [];

    console.log(` Gathering inputs for node ${nodeId} from ${upstreamNodeIds.length} upstream nodes`);

    for (const upstreamNodeId of upstreamNodeIds) {
      let output = this.outputCache.get(upstreamNodeId);

      if (!output) {
        console.log(` No cached output for ${upstreamNodeId}, checking node data...`);
        
        const upstreamNode = this.getNode(upstreamNodeId);
        if (upstreamNode?.data?.executionResult) {
          // Create a NodeOutput object from existing execution result
          const executionResultData = upstreamNode.data.executionResult;
          console.log(` Raw executionResult data:`, {
            type: typeof executionResultData,
            isArray: Array.isArray(executionResultData),
            length: Array.isArray(executionResultData) ? executionResultData.length : 'N/A',
            sample: Array.isArray(executionResultData) ? executionResultData.slice(0, 2) : executionResultData
          });
          
          output = {
            nodeId: upstreamNodeId,
            executionId: `existing_${Date.now()}`,
            dataType: this.getNodeOutputDataType(upstreamNode),
            data: executionResultData,
            timestamp: upstreamNode.data.lastExecuted || new Date().toISOString(),
            inputSources: [],
            executionStatus: ExecutionStatus.SUCCESS,
            metadata: {
              itemCount: Array.isArray(executionResultData) ? executionResultData.length : 1,
              processingTime: 0
            }
          };
          
          // Cache this output for future use
          this.cacheOutput(upstreamNodeId, output);
        } else {
          // Try to fetch execution data from database
          console.log(` Checking database for execution data for node ${upstreamNodeId}`);
          try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/nodes/${upstreamNodeId}/output`, {
              headers: this.context.authHeaders
            });
            
            if (response.ok) {
              const dbData = await response.json();
              if (dbData.success && dbData.data) {
                console.log(` Found execution data in database for node ${upstreamNodeId}:`, dbData.data);
                
                const upstreamNode = this.getNode(upstreamNodeId);
                output = {
                  nodeId: upstreamNodeId,
                  executionId: dbData.metadata?.executionId || `db_${Date.now()}`,
                  dataType: upstreamNode ? this.getNodeOutputDataType(upstreamNode) : DataType.ANY,
                  data: dbData.data,
                  timestamp: dbData.metadata?.completedAt || new Date().toISOString(),
                  inputSources: [],
                  executionStatus: ExecutionStatus.SUCCESS,
                  metadata: {
                    itemCount: Array.isArray(dbData.data) ? dbData.data.length : 1,
                    processingTime: dbData.metadata?.processingTime || 0
                  }
                };
                
                // Cache this output
                this.cacheOutput(upstreamNodeId, output);
              }
            }
          } catch (error) {
            console.warn(` Failed to fetch database output for ${upstreamNodeId}:`, error);
          }
        }
      }

      if (output) {
        inputs.push(output);
        console.log(` Added input from ${upstreamNodeId}: ${Array.isArray(output.data) ? output.data.length : 'single'} items`);
      } else {
        console.warn(` No output available from upstream node ${upstreamNodeId}`);
      }
    }

    console.log(` Total inputs gathered: ${inputs.length}`);
    return inputs;
  }

  /**
   * Execute the specific logic for a node type
   */
  private async executeNodeLogic(node: Node, inputs: NodeOutput[]): Promise<NodeOutput> {
    const nodeData = node.data as WorkflowNodeData;
    const definition = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
    
    if (!definition) {
      throw new Error(`Unknown node type: ${node.type}`);
    }

    console.log(` Executing ${node.type} node logic`);
    
    let result: any;
    let dataType: DataType = definition.outputType;
    
    switch (node.type) {
      case 'webSource':
        result = await this.webSourceExecutor.execute(node.id, nodeData, inputs);
        dataType = this.webSourceExecutor.getDataType(nodeData);
        break;
        
      case 'dataStructuring':
        result = await this.dataProcessingExecutor.executeDataStructuring(nodeData, inputs);
        break;
        
      case 'aiProcessor':
        result = await this.dataProcessingExecutor.executeAIProcessor(node.id, nodeData, inputs);
        break;
        
      case 'linearRegression':
        result = await this.dataProcessingExecutor.executeLinearRegression(node.id, nodeData, inputs);
        break;
        
      case 'randomForest':
        result = await this.dataProcessingExecutor.executeRandomForest(node.id, nodeData, inputs);
        break;
        
      case 'chartGenerator':
        result = await this.dataProcessingExecutor.executeChartGenerator(node.id, nodeData, inputs);
        break;
        
      case 'postgres':
        result = await this.databaseExecutor.executePostgres(node.id, nodeData, inputs);
        break;
        
      case 'httpRequest':
        result = await this.httpExecutor.execute(node.id, nodeData, inputs);
        break;
        
      case 'fileNode':
        result = await this.databaseExecutor.executeFileNode(node.id, nodeData, inputs);
        break;
        
      default:
        throw new Error(`Execution not implemented for node type: ${node.type}`);
    }

    return {
      nodeId: node.id,
      executionId: this.generateExecutionId(),
      dataType,
      data: result,
      timestamp: new Date().toISOString(),
      inputSources: inputs.map(input => input.nodeId),
      executionStatus: ExecutionStatus.SUCCESS,
      metadata: {
        itemCount: Array.isArray(result) ? result.length : 1,
        processingTime: 0 // Could be calculated if needed
      }
    };
  }

  /**
   * Get the output data type for any node based on its type and configuration
   */
  private getNodeOutputDataType(node: Node): DataType {
    if (node.type === 'webSource') {
      return this.webSourceExecutor.getDataType(node.data as WorkflowNodeData);
    }
    
    // Use the default output type from node definitions
    const definition = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
    return definition?.outputType || DataType.RAW_DATA;
  }

  /**
   * Helper methods for graph traversal
   */
  private getNode(nodeId: string): Node | undefined {
    return this.context.nodes.find(node => node.id === nodeId);
  }

  private getUpstreamNodes(nodeId: string): string[] {
    return this.context.edges
      .filter(edge => edge.target === nodeId)
      .map(edge => edge.source);
  }

  private getDownstreamNodes(nodeId: string): string[] {
    return this.context.edges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target);
  }

  private cacheOutput(nodeId: string, output: NodeOutput): void {
    this.outputCache.set(nodeId, output);
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clear the output cache
   */
  clearCache(): void {
    this.outputCache.clear();
  }

  /**
   * Get cached output for a node
   */
  getCachedOutput(nodeId: string): NodeOutput | undefined {
    return this.outputCache.get(nodeId);
  }

  /**
   * Execute from a specific node (alias for executeSubgraph for hook compatibility)
   */
  async executeFromNode(nodeId: string, forceStartingNode: boolean = false): Promise<ExecutionResult> {
    const results = await this.executeSubgraph(nodeId, forceStartingNode);
    const primaryResult = results.find(r => r.nodeId === nodeId);
    
    if (!primaryResult) {
      throw new Error(`No result found for node ${nodeId}`);
    }

    // Store successful results in execution history
    if (primaryResult.success && primaryResult.output) {
      this.executionHistory.push(primaryResult.output);
    }

    return {
      ...primaryResult,
      executionTime: 0 // Could be calculated if needed
    };
  }

  /**
   * Execute the entire workflow
   */
  async executeWorkflow(): Promise<ExecutionResult[]> {
    console.log(' Starting full workflow execution');
    
    const allResults: ExecutionResult[] = [];
    const visited = new Set<string>();

    // Find all source nodes (nodes with no incoming edges)
    const sourceNodes = this.context.nodes.filter(node => 
      !this.context.edges.some(edge => edge.target === node.id)
    );

    console.log(` Found ${sourceNodes.length} source nodes:`, sourceNodes.map(n => n.id));

    // Execute from each source node
    for (const sourceNode of sourceNodes) {
      if (!visited.has(sourceNode.id)) {
        const subgraphResults = await this.executeSubgraph(sourceNode.id, true);
        
        // Mark all nodes in this subgraph as visited
        subgraphResults.forEach(result => visited.add(result.nodeId));
        
        allResults.push(...subgraphResults);
      }
    }

    // Store successful results in execution history
    allResults.forEach(result => {
      if (result.success && result.output) {
        this.executionHistory.push(result.output);
      }
    });

    console.log(` Full workflow execution completed. ${allResults.length} nodes processed.`);
    return allResults;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(nodeId?: string): NodeOutput[] {
    if (nodeId) {
      return this.executionHistory.filter(output => output.nodeId === nodeId);
    }
    return [...this.executionHistory];
  }
}