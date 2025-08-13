/**
 * Extensible Workflow Execution Engine
 * 
 * This engine handles the execution of typed workflow nodes with caching,
 * validation, and support for "run from any node" functionality.
 */

import { Node, Edge } from 'reactflow';
import { 
  NodeOutput, 
  NodeDefinition, 
  ExecutionStatus, 
  DataType, 
  ValidationResult,
  WorkflowNodeData,
  NODE_DEFINITIONS,
  validateNodeConnection,
  isDataTypeCompatible
} from './workflow-types';

export interface ExecutionContext {
  agentId: number;
  authHeaders: Record<string, string>;
  nodes: Node[];
  edges: Edge[];
  outputCache: Map<string, NodeOutput>;
}

export interface ExecutionResult {
  success: boolean;
  output?: NodeOutput;
  error?: string;
  executionTime: number;
}

export class WorkflowExecutionEngine {
  private context: ExecutionContext;
  private executionHistory: Map<string, NodeOutput[]> = new Map();

  constructor(context: ExecutionContext) {
    this.context = context;
  }

  /**
   * Execute a single node from any point in the workflow
   */
  async executeFromNode(nodeId: string, forceExecution: boolean = false): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting execution from node: ${nodeId}`);
      
      // Get the node and validate
      const node = this.getNode(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Gather inputs from connected predecessor nodes
      const inputs = await this.gatherInputs(nodeId);
      console.log(`📥 Gathered ${inputs.length} inputs for node ${nodeId}`);
      
      // Validate inputs against node requirements
      const validation = this.validateInputs(node, inputs);
      if (!validation.isValid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if we can use cached output (but not if forced execution)
      if (!forceExecution && this.canUseCachedOutput(nodeId, inputs)) {
        const cachedOutput = this.context.outputCache.get(nodeId)!;
        console.log(`💾 Using cached output for node ${nodeId}`);
        
        return {
          success: true,
          output: { ...cachedOutput, executionStatus: ExecutionStatus.CACHED },
          executionTime: Date.now() - startTime
        };
      }
      
      if (forceExecution) {
        console.log(`🔥 Force executing node ${nodeId} (no cache)`);
      }

      // Execute the node
      console.log(`⚡ Executing node ${nodeId} with ${inputs.length} inputs`);
      const output = await this.executeNodeLogic(node, inputs);
      
      // Store output in cache
      this.cacheOutput(nodeId, output);
      
      // Update execution history
      this.addToExecutionHistory(nodeId, output);

      console.log(`✅ Successfully executed node ${nodeId}`);
      
      return {
        success: true,
        output,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`❌ Execution failed for node ${nodeId}:`, error);
      
      // Create error output
      const errorOutput: NodeOutput = {
        nodeId,
        executionId: this.generateExecutionId(),
        dataType: DataType.VOID,
        data: null,
        timestamp: new Date().toISOString(),
        inputSources: [],
        executionStatus: ExecutionStatus.ERROR,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: { processingTime: Date.now() - startTime }
      };
      
      this.cacheOutput(nodeId, errorOutput);
      
      return {
        success: false,
        error: errorOutput.errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute the entire workflow from source nodes
   */
  async executeWorkflow(): Promise<ExecutionResult[]> {
    console.log('🏁 Starting full workflow execution');
    
    const sourceNodes = this.getSourceNodes();
    const results: ExecutionResult[] = [];
    
    for (const node of sourceNodes) {
      const result = await this.executeSubgraph(node.id);
      results.push(...result);
    }
    
    return results;
  }

  /**
   * Execute a subgraph starting from a specific node
   */
  private async executeSubgraph(nodeId: string, forceStartingNode: boolean = false): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const visited = new Set<string>();
    const executing = new Set<string>();
    const startingNodeId = nodeId;
    
    const executeRecursive = async (currentNodeId: string): Promise<void> => {
      if (visited.has(currentNodeId) || executing.has(currentNodeId)) {
        return;
      }
      
      executing.add(currentNodeId);
      
      // Force execution for the starting node, allow caching for downstream nodes
      const shouldForceExecution = forceStartingNode && currentNodeId === startingNodeId;
      const result = await this.executeFromNode(currentNodeId, shouldForceExecution);
      results.push(result);
      
      executing.delete(currentNodeId);
      visited.add(currentNodeId);
      
      // Execute downstream nodes if current node succeeded
      if (result.success) {
        const downstreamNodes = this.getDownstreamNodes(currentNodeId);
        
        for (const downstreamNodeId of downstreamNodes) {
          await executeRecursive(downstreamNodeId);
        }
      }
    };
    
    await executeRecursive(nodeId);
    return results;
  }

  /**
   * Gather inputs from all connected predecessor nodes
   */
  private async gatherInputs(nodeId: string): Promise<NodeOutput[]> {
    const upstreamNodeIds = this.getUpstreamNodes(nodeId);
    const inputs: NodeOutput[] = [];
    
    for (const upstreamNodeId of upstreamNodeIds) {
      // Check cache first
      let output = this.context.outputCache.get(upstreamNodeId);
      
      if (!output || output.executionStatus === ExecutionStatus.ERROR) {
        // Check if the node already has execution result data (e.g., from configuration)
        const upstreamNode = this.getNode(upstreamNodeId);
        if (upstreamNode && upstreamNode.data.executionResult !== undefined) {
          console.log(`📋 Using existing execution result for node ${upstreamNodeId}:`, upstreamNode.data.executionResult);
          
          // Create a NodeOutput object from the existing execution result
          // Use the EXACT same data that the UI displays
          const executionResultData = upstreamNode.data.executionResult;
          console.log(`🔍 Raw executionResult data:`, {
            type: typeof executionResultData,
            isArray: Array.isArray(executionResultData),
            length: Array.isArray(executionResultData) ? executionResultData.length : 'N/A',
            sample: Array.isArray(executionResultData) ? executionResultData.slice(0, 2) : executionResultData
          });
          
          output = {
            nodeId: upstreamNodeId,
            executionId: `existing_${Date.now()}`,
            dataType: this.getNodeOutputDataType(upstreamNode),
            data: executionResultData, // Use the exact same data the UI shows
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
          console.log(`🔍 Checking database for execution data for node ${upstreamNodeId}`);
          try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/nodes/${upstreamNodeId}/output`, {
              headers: this.context.authHeaders
            });
            
            if (response.ok) {
              const dbData = await response.json();
              if (dbData.success && dbData.data) {
                console.log(`✅ Found execution data in database for node ${upstreamNodeId}:`, dbData.data);
                
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
                    processingTime: 0,
                    fromDatabase: true
                  }
                };
                
                // Cache this output for future use
                this.cacheOutput(upstreamNodeId, output);
              } else {
                console.log(`❌ No execution data found in database for node ${upstreamNodeId}`);
              }
            }
          } catch (dbError) {
            console.log(`❌ Failed to fetch execution data from database for node ${upstreamNodeId}:`, dbError);
          }
          
          // If still no data, execute upstream node
          if (!output) {
            console.log(`🔄 Executing upstream node ${upstreamNodeId} to get input`);
            const result = await this.executeFromNode(upstreamNodeId);
            
            if (result.success && result.output) {
              output = result.output;
            } else {
              throw new Error(`Failed to get input from upstream node ${upstreamNodeId}: ${result.error}`);
            }
          }
        }
      }
      
      if (output && output.executionStatus === ExecutionStatus.SUCCESS) {
        inputs.push(output);
      }
    }
    
    return inputs;
  }

  /**
   * Validate inputs against node requirements
   */
  private validateInputs(node: Node, inputs: NodeOutput[]): ValidationResult {
    const nodeData = node.data as WorkflowNodeData;
    const definition = nodeData.nodeDefinition || NODE_DEFINITIONS[node.type];
    
    if (!definition) {
      return {
        isValid: false,
        errors: [`Unknown node type: ${node.type}`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check input count
    if (inputs.length < definition.minInputs) {
      errors.push(`${definition.displayName} requires at least ${definition.minInputs} inputs, got ${inputs.length}`);
    }
    
    if (inputs.length > definition.maxInputs) {
      errors.push(`${definition.displayName} accepts at most ${definition.maxInputs} inputs, got ${inputs.length}`);
    }

    // Check input types
    for (const input of inputs) {
      const isCompatible = definition.acceptedInputs.includes(input.dataType) ||
                          definition.acceptedInputs.includes(DataType.ANY);
      
      if (!isCompatible) {
        errors.push(`${definition.displayName} cannot accept ${input.dataType} data from node ${input.nodeId}`);
      }
    }

    // Custom validation if defined
    if (definition.customValidation) {
      const customResult = definition.customValidation(inputs);
      errors.push(...customResult.errors);
      warnings.push(...customResult.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Execute the actual node logic based on node type
   */
  private async executeNodeLogic(node: Node, inputs: NodeOutput[]): Promise<NodeOutput> {
    const nodeData = node.data as WorkflowNodeData;
    const definition = nodeData.nodeDefinition || NODE_DEFINITIONS[node.type];
    const executionId = this.generateExecutionId();
    
    let result: any;
    let dataType: DataType = definition.outputType;
    
    switch (node.type) {
      case 'webSource':
        result = await this.executeWebSource(node.id, nodeData, inputs);
        dataType = this.getWebSourceDataType(nodeData);
        break;
        
      case 'dataStructuring':
        result = await this.executeDataStructuring(nodeData, inputs);
        dataType = DataType.STRUCTURED_DATA;
        break;
        
      case 'aiProcessor':
        result = await this.executeAIProcessor(node.id, nodeData, inputs);
        dataType = DataType.TEXT_DATA;
        break;
        
      case 'linearRegression':
        result = await this.executeLinearRegression(node.id, nodeData, inputs);
        dataType = DataType.PREDICTION_DATA;
        break;

      case 'randomForest':
        result = await this.executeRandomForest(node.id, nodeData, inputs);
        dataType = DataType.PREDICTION_DATA;
        break;
        
      case 'chartGenerator':
        result = await this.executeChartGenerator(nodeData, inputs);
        dataType = DataType.CHART_DATA;
        break;
        
      case 'postgres':
        result = await this.executePostgres(nodeData, inputs);
        dataType = DataType.STRUCTURED_DATA;
        break;
        
      case 'httpRequest':
        result = await this.executeHttpRequest(node.id, nodeData, inputs);
        dataType = DataType.STRUCTURED_DATA;
        break;
        
      case 'fileNode':
        result = await this.executeFileNode(node.id, nodeData, inputs);
        dataType = DataType.STRUCTURED_DATA;
        break;
        
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }

    return {
      nodeId: node.id,
      executionId,
      dataType,
      data: result,
      timestamp: new Date().toISOString(),
      inputSources: inputs.map(input => input.nodeId),
      executionStatus: ExecutionStatus.SUCCESS,
      metadata: {
        itemCount: Array.isArray(result) ? result.length : 1,
        processingTime: 0 // Will be calculated by caller
      }
    };
  }

  /**
   * Get the output data type for any node based on its type and configuration
   */
  private getNodeOutputDataType(node: Node): DataType {
    if (node.type === 'webSource') {
      return this.getWebSourceDataType(node.data as WorkflowNodeData);
    }
    
    // Use the default output type from node definitions
    const definition = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
    return definition?.outputType || DataType.RAW_DATA;
  }

  /**
   * Determine actual output data type for webSource nodes based on configuration
   */
  private getWebSourceDataType(nodeData: WorkflowNodeData): DataType {
    // Check monitoring config if present (this is where the actual config is stored)
    const monitoringConfig = nodeData.monitoring || nodeData;
    
    // Check if it's configured for table/structured output
    const selectors = monitoringConfig?.selectors || nodeData?.selectors;
    
    if (selectors?.some((s: any) => s.type === 'table' || s.type === 'repeating')) {
      console.log(`🔍 WebSource detected as STRUCTURED_DATA (table/repeating mode)`);
      return DataType.STRUCTURED_DATA;
    }
    
    // Check if it's configured and has multiple selectors (structured format)
    if (monitoringConfig?.configured && selectors && selectors.length > 1) {
      console.log(`🔍 WebSource detected as STRUCTURED_DATA (multiple selectors)`);
      return DataType.STRUCTURED_DATA;
    }
    
    // Single text-based selectors output text data
    if (monitoringConfig?.configured && selectors && selectors.length === 1) {
      const selector = selectors[0];
      if (selector.attribute === 'textContent' || selector.attribute === 'innerText') {
        console.log(`🔍 WebSource detected as TEXT_DATA (single text selector)`);
        return DataType.TEXT_DATA;
      }
    }
    
    // Check if configured but no specific type detected
    if (monitoringConfig?.configured) {
      console.log(`🔍 WebSource detected as STRUCTURED_DATA (configured fallback)`);
      return DataType.STRUCTURED_DATA; // If configured, assume structured output
    }
    
    // Default to raw data if not specifically configured
    console.log(`🔍 WebSource detected as RAW_DATA (unconfigured)`);
    return DataType.RAW_DATA;
  }

  // Node-specific execution methods (extensible)
  private async executeWebSource(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const { monitoring } = nodeData;
    console.log('🔍 DEBUG: nodeData:', nodeData);
    console.log('🔍 DEBUG: monitoring config:', monitoring);
    
    if (!monitoring) {
      throw new Error('Web source not configured');
    }

    // Check for loop configuration
    if (monitoring.loopConfig?.enabled && monitoring.loopConfig.parameters.length > 0) {
      return await this.executeWebSourceWithLoop(nodeId, monitoring, inputs);
    }

    // Create workflow execution if it doesn't exist
    const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${this.context.agentId}/executions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify({
        workflow_nodes: this.context.nodes,
        workflow_edges: this.context.edges
      })
    });

    if (!executionResponse.ok) {
      throw new Error('Failed to create workflow execution');
    }

    const executionData = await executionResponse.json();
    const executionId = executionData.execution?.id;

    // Create node execution record for tracking
    const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify({
        node_id: nodeId,
        node_type: 'webSource',
        input_config: {
          nodeType: 'webSource',
          url: monitoring.url,
          selectors: monitoring.selectors
        },
        input_data: inputs.map(input => input.data),
        status: 'running'
      })
    });

    if (!nodeExecutionResponse.ok) {
      throw new Error('Failed to create node execution record');
    }

    const nodeExecutionData = await nodeExecutionResponse.json();
    const nodeExecutionId = nodeExecutionData.node_execution?.id;
    
    // Import the actual web extraction logic
    const { workflowService } = await import('./services');
    
    // Always prefer originalSelectors if available - they have the correct structure
    const selectors = monitoring.originalSelectors || monitoring.selectors || [];
    
    console.log('🔍 SELECTOR SOURCE:', monitoring.originalSelectors ? 'Using originalSelectors' : 'Using selectors');
    console.log('🔍 MONITORING OBJECT:', JSON.stringify(monitoring, null, 2));
    console.log('🔍 SELECTORS:', JSON.stringify(selectors, null, 2));
    
    console.log('🔍 DETAILED SELECTORS DEBUG:', JSON.stringify(selectors, null, 2));
    
    // Enhanced format detection logging
    if (selectors.length > 0) {
      const firstSelector = selectors[0];
      console.log('🔍 FORMAT DETECTION ANALYSIS:');
      console.log('  - First selector has .selector:', !!firstSelector.selector);
      console.log('  - First selector has .id:', !!firstSelector.id);
      console.log('  - Detection condition (selector && !id):', !!(firstSelector.selector && !firstSelector.id));
      console.log('  - First selector type:', firstSelector.type);
      
      // Check for repeating selectors specifically
      const repeatingSelector = selectors.find((sel: any) => sel.type === 'repeating');
      if (repeatingSelector) {
        console.log('🔍 REPEATING SELECTOR ANALYSIS:');
        console.log('  - Found repeating selector:', !!repeatingSelector);
        console.log('  - Has fields property:', !!repeatingSelector.fields);
        console.log('  - Fields count:', repeatingSelector.fields?.length || 0);
        if (repeatingSelector.fields?.length > 0) {
          console.log('  - Sample field structure:', JSON.stringify(repeatingSelector.fields[0], null, 2));
          repeatingSelector.fields.forEach((field: any, idx: number) => {
            console.log(`  - Field ${idx}: name="${field.name}", sub_selector="${field.sub_selector}"`);
          });
        }
      }
    }
    
    // Check if selectors are already in the processed format (from new saves)
    // vs need to be converted from original format (from old saves)
    let selectorsPayload;
    
    if (selectors.length > 0 && selectors[0].selector && !selectors[0].id) {
      // Already in processed format, use directly
      console.log('✅ USING PRE-PROCESSED FORMAT: selectors have .selector but no .id');
      selectorsPayload = selectors;
    } else {
      // Original format, need to convert
      console.log('🔄 USING ORIGINAL FORMAT: converting selectors to payload format');
      const repeatingSelector = selectors.find((sel: any) => sel.type === 'repeating');
      
      if (repeatingSelector && repeatingSelector.fields) {
        selectorsPayload = [{
          selector: repeatingSelector.selector,
          name: repeatingSelector.name || 'container',
          type: 'repeating',
          fields: repeatingSelector.fields.map((field: any) => ({
            name: field.name,
            sub_selector: field.sub_selector,
            attribute: 'textContent'
          }))
        }];
      } else {
        selectorsPayload = selectors.map((sel: any) => ({
          selector: sel.selector,
          label: sel.label,
          name: sel.name,
          attribute: sel.attribute === "all" ? "all" : (sel.attribute === "table_data" ? "table_data" : "textContent"),
          type: sel.type
        }));
      }
    }
    
    console.log('🚀 WORKFLOW EXECUTION - SENDING TO BACKEND:', { 
      url: monitoring.url, 
      selectors: selectorsPayload.map(sel => ({
        ...sel,
        fields: sel.fields?.map((f: any) => ({ name: f.name, sub_selector: f.sub_selector }))
      }))
    });
    
    // Additional logging to show exact payload structure
    console.log('🔍 FINAL SELECTORS PAYLOAD ANALYSIS:');
    selectorsPayload.forEach((sel: any, idx: number) => {
      console.log(`  Selector ${idx}:`, {
        type: sel.type,
        selector: sel.selector,
        hasFields: !!sel.fields,
        fieldsCount: sel.fields?.length || 0
      });
      if (sel.fields && sel.fields.length > 0) {
        sel.fields.forEach((field: any, fieldIdx: number) => {
          console.log(`    Field ${fieldIdx}: name="${field.name}", sub_selector="${field.sub_selector}", attribute="${field.attribute}"`);
        });
      }
    });

    try {
      const data = await workflowService.extractData(
        monitoring.url,
        selectorsPayload,
        this.context.authHeaders
      );

      console.log('📥 WORKFLOW EXECUTION - RECEIVED FROM BACKEND:', data);
      
      if (!data.success) {
        // Update node execution with error
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify({
            status: 'failed',
            error_message: data.error || 'Failed to extract data',
            completed_at: new Date().toISOString()
          })
        });
        throw new Error(data.error || 'Failed to extract data');
      }
      
      const extractedData = data.result.extracted_data || [];
      
      // Update node execution with successful results
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          status: 'completed',
          output_data: extractedData,
          completed_at: new Date().toISOString()
        })
      });
      
      return extractedData;
    } catch (error) {
      // Update node execution with error if not already updated
      try {
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
        });
      } catch (updateError) {
        console.error('Failed to update node execution with error:', updateError);
      }
      throw error;
    }
  }

  /**
   * Execute webSource with parameter looping
   */
  private async executeWebSourceWithLoop(nodeId: string, monitoring: any, inputs: NodeOutput[]): Promise<any> {
    const startTime = Date.now();
    console.log('🔄 Starting webSource loop execution');

    // Generate parameter combinations
    const parameterCombinations = await this.generateParameterCombinations(monitoring.loopConfig, inputs);
    console.log(`🔄 Generated ${parameterCombinations.length} parameter combinations`);

    // Create workflow execution if it doesn't exist
    const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${this.context.agentId}/executions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify({
        workflow_nodes: this.context.nodes,
        workflow_edges: this.context.edges
      })
    });

    if (!executionResponse.ok) {
      throw new Error('Failed to create workflow execution');
    }

    const executionData = await executionResponse.json();
    const executionId = executionData.execution?.id;

    // Create node execution record for tracking
    const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify({
        node_id: nodeId,
        node_type: 'webSource',
        input_config: {
          nodeType: 'webSource',
          url: monitoring.url,
          loopConfig: monitoring.loopConfig
        },
        url: monitoring.url,
        selectors: monitoring.originalSelectors || monitoring.selectors,
        loopConfig: monitoring.loopConfig
      })
    });

    if (!nodeExecutionResponse.ok) {
      throw new Error('Failed to create node execution');
    }

    const nodeExecutionData = await nodeExecutionResponse.json();
    const nodeExecutionId = nodeExecutionData.node_execution?.id;

    const results: any[] = [];
    const iterations: any[] = [];
    let totalProcessed = 0;

    // Execute in batches with concurrency control
    const batchSize = monitoring.loopConfig.concurrency || 1;
    for (let i = 0; i < parameterCombinations.length; i += batchSize) {
      const batch = parameterCombinations.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (combination, batchIndex) => {
        const globalIndex = i + batchIndex;
        const iterationStart = Date.now();
        
        try {
          // Substitute variables in URL
          const processedUrl = this.substituteVariables(monitoring.url, combination);
          
          console.log(`🔄 Iteration ${globalIndex + 1}/${parameterCombinations.length}: ${processedUrl}`);
          console.log('  Variables:', combination);

          // Import the web extraction logic
          const { workflowService } = await import('./services');
          
          // Prepare selectors (reuse existing logic from executeWebSource)
          const selectors = monitoring.originalSelectors || monitoring.selectors || [];
          console.log(`🔍 Loop iteration ${globalIndex + 1}: Raw selectors:`, JSON.stringify(selectors, null, 2));
          console.log(`🔍 Loop iteration ${globalIndex + 1}: Using ${monitoring.originalSelectors ? 'originalSelectors' : 'selectors'}`);
          
          let selectorsPayload;
          
          if (selectors.length > 0 && selectors[0].selector && !selectors[0].id) {
            // Already in processed format, use directly
            console.log(`✅ Loop iteration ${globalIndex + 1}: USING PRE-PROCESSED FORMAT: selectors have .selector but no .id`);
            selectorsPayload = selectors;
          } else {
            // Original format, need to convert
            console.log(`🔄 Loop iteration ${globalIndex + 1}: USING ORIGINAL FORMAT: converting selectors to payload format`);
            const repeatingSelector = selectors.find((sel: any) => sel.type === 'repeating');
            
            if (repeatingSelector && repeatingSelector.fields) {
              console.log(`🔄 Loop iteration ${globalIndex + 1}: Found repeating selector with ${repeatingSelector.fields.length} fields`);
              selectorsPayload = [{
                selector: repeatingSelector.selector,
                name: repeatingSelector.name || 'container',
                type: 'repeating',
                fields: repeatingSelector.fields.map((field: any) => ({
                  name: field.name,
                  sub_selector: field.sub_selector,
                  attribute: 'textContent'
                }))
              }];
            } else {
              console.log(`🔄 Loop iteration ${globalIndex + 1}: Using individual selectors (${selectors.length} total)`);
              selectorsPayload = selectors.map((sel: any) => ({
                selector: sel.selector,
                label: sel.label,
                name: sel.name,
                attribute: sel.attribute === "all" ? "all" : (sel.attribute === "table_data" ? "table_data" : "textContent"),
                type: sel.type
              }));
            }
          }

          // Execute the web extraction
          console.log(`🔍 Loop iteration ${globalIndex + 1}: Extracting data from ${processedUrl}`);
          console.log(`🔍 Using selectors:`, JSON.stringify(selectorsPayload, null, 2));
          
          const data = await workflowService.extractData(
            processedUrl,
            selectorsPayload,
            this.context.authHeaders
          );

          console.log(`📥 Loop iteration ${globalIndex + 1}: Extraction result:`, {
            success: data.success,
            error: data.error,
            resultCount: data.result?.extracted_data?.length || 0,
            result: data.result
          });

          if (!data.success) {
            throw new Error(data.error || 'Failed to extract data');
          }

          const iterationResult = data.result.extracted_data || [];
          console.log(`📊 Loop iteration ${globalIndex + 1}: Final result has ${Array.isArray(iterationResult) ? iterationResult.length : 'non-array'} items`);
          const iterationEnd = Date.now();

          // Log iteration details
          const iterationLog = {
            iteration: globalIndex + 1,
            url: processedUrl,
            variables: combination,
            resultCount: Array.isArray(iterationResult) ? iterationResult.length : 1,
            duration: iterationEnd - iterationStart,
            status: 'success',
            timestamp: new Date().toISOString()
          };

          iterations.push(iterationLog);
          
          console.log(`✅ Iteration ${globalIndex + 1} completed: ${iterationLog.resultCount} items in ${iterationLog.duration}ms`);
          
          // Return in format expected by aggregateLoopResults
          return {
            success: true,
            data: iterationResult,
            parameters: combination,
            responseTime: iterationEnd - iterationStart
          };

        } catch (error) {
          const iterationEnd = Date.now();
          const errorLog = {
            iteration: globalIndex + 1,
            url: this.substituteVariables(monitoring.url, combination),
            variables: combination,
            error: error instanceof Error ? error.message : String(error),
            duration: iterationEnd - iterationStart,
            status: 'error',
            timestamp: new Date().toISOString()
          };

          iterations.push(errorLog);
          console.error(`❌ Iteration ${globalIndex + 1} failed:`, error);

          if (monitoring.loopConfig.stopOnError) {
            throw error;
          }

          // Return error in format expected by aggregateLoopResults
          return {
            success: false,
            data: null,
            parameters: combination,
            responseTime: iterationEnd - iterationStart,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
      
      totalProcessed += batch.length;
      console.log(`🔄 Batch completed: ${totalProcessed}/${parameterCombinations.length} iterations processed`);

      // Add delay between batches if configured
      if (monitoring.loopConfig.delayBetweenRequests > 0 && i + batchSize < parameterCombinations.length) {
        await new Promise(resolve => setTimeout(resolve, monitoring.loopConfig.delayBetweenRequests));
      }
    }

    // Aggregate results based on configuration
    console.log(`🔄 Pre-aggregation results:`, {
      count: results.length,
      firstResult: results[0],
      resultsStructure: results.map(r => ({
        isArray: Array.isArray(r),
        length: Array.isArray(r) ? r.length : 'not array',
        keys: r && typeof r === 'object' ? Object.keys(r) : 'not object'
      }))
    });
    
    const aggregatedResults = this.aggregateLoopResults(results, monitoring.loopConfig.aggregationMode);
    const totalTime = Date.now() - startTime;
    
    console.log(`📦 Aggregated results:`, aggregatedResults);

    console.log(`✅ WebSource loop execution completed: ${results.length}/${parameterCombinations.length} successful iterations in ${totalTime}ms`);

    // For webSource, we need to return just the data array, not the wrapper object
    let finalData;
    
    if (monitoring.loopConfig.aggregationMode === 'merge') {
      // For merge mode with webSource data, we need special handling for named tables
      const allDataArrays = results.filter(r => r.success).map(r => r.data);
      console.log(`🔄 Merge mode: Processing ${allDataArrays.length} data arrays`);
      
      // Check if all results have the same structure (array with single object containing named tables)
      if (allDataArrays.every(arr => Array.isArray(arr) && arr.length === 1 && typeof arr[0] === 'object')) {
        // Merge tables with the same name
        const mergedData: any = {};
        
        for (const dataArray of allDataArrays) {
          const dataObj = dataArray[0];
          for (const [tableName, tableData] of Object.entries(dataObj)) {
            if (Array.isArray(tableData)) {
              // If table exists, concatenate rows; otherwise, create new entry
              if (mergedData[tableName]) {
                console.log(`📊 Merging ${tableData.length} rows into existing table '${tableName}' (current: ${mergedData[tableName].length} rows)`);
                mergedData[tableName] = mergedData[tableName].concat(tableData);
              } else {
                console.log(`📊 Creating new table '${tableName}' with ${tableData.length} rows`);
                mergedData[tableName] = tableData;
              }
            } else {
              // Non-array data, just assign
              mergedData[tableName] = tableData;
            }
          }
        }
        
        // Return as single-element array to match expected format
        finalData = [mergedData];
        console.log(`✅ Merged data: ${Object.keys(mergedData).length} tables, total rows:`, 
          Object.entries(mergedData).map(([name, data]) => `${name}: ${Array.isArray(data) ? data.length : 'non-array'}`));
      } else {
        // Fallback to simple concatenation if structure doesn't match
        console.log(`⚠️ Data structure doesn't match expected format for merge, using concatenation`);
        finalData = aggregatedResults.data;
      }
    } else {
      // Append mode: extract and flatten the data arrays
      finalData = aggregatedResults.data.map((item: any) => item.data).flat();
      console.log(`📎 Append mode: Keeping ${finalData.length} separate results`);
    }
    
    console.log(`🎯 Final webSource data:`, {
      mode: monitoring.loopConfig.aggregationMode,
      itemCount: Array.isArray(finalData) ? finalData.length : 'not array',
      sample: finalData?.[0]
    });

    // Update node execution with results
    const updateResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify({
        status: 'completed',
        output_data: finalData,
        extracted_data: finalData,
        iteration_logs: iterations,
        aggregated_results: aggregatedResults // Keep full results for debugging
      })
    });

    if (!updateResponse.ok) {
      console.warn('Failed to update node execution, but continuing with results');
    }

    return finalData;
  }

  private async executeDataStructuring(nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    // TODO: Implement data structuring logic
    // For now, pass through the input data
    if (inputs.length === 0) {
      throw new Error('Data structuring requires input data');
    }
    
    return inputs[0].data;
  }

  private async executeAIProcessor(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    console.log('🤖 Executing AI Processor node:', nodeId);
    
    if (inputs.length === 0) {
      throw new Error('AI processor requires input data');
    }
    
    const processor = nodeData.processor || {};
    const prompt = processor.prompt || processor.customPrompt;
    
    if (!prompt) {
      throw new Error('AI processor requires a prompt to be configured');
    }
    
    // Get the input data from the previous node
    const inputData = inputs[0].data;
    console.log('🤖 AI Processor input data:', {
      type: typeof inputData,
      isArray: Array.isArray(inputData),
      length: Array.isArray(inputData) ? inputData.length : 'N/A',
      sample: Array.isArray(inputData) ? inputData.slice(0, 2) : inputData
    });
    
    try {
      // Create workflow execution if it doesn't exist
      const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${this.context.agentId}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          workflow_nodes: this.context.nodes,
          workflow_edges: this.context.edges
        })
      });

      if (!executionResponse.ok) {
        throw new Error('Failed to create workflow execution');
      }

      const executionData = await executionResponse.json();
      const executionId = executionData.execution?.id;

      // Create node execution record
      const requestPayload = {
        node_id: nodeId,
        node_type: 'aiProcessor',
        ai_prompt: prompt,
        ai_model: processor.model || 'gpt-4o-mini',
        input_config: {
          inputs_length: inputs.length,
          data_type: typeof inputData,
          is_array: Array.isArray(inputData)
        }
      };
      console.log('🤖 Request payload:', requestPayload);
      const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify(requestPayload)
      });
      
      if (!nodeExecutionResponse.ok) {
        throw new Error(`Failed to create node execution record: ${nodeExecutionResponse.statusText}`);
      }
      
      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution.id;
      
      console.log(`🤖 Created AI processor node execution record: ${nodeExecutionId}`);
      
      // Call AI processing API
      const aiResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ai/process`, {
        method: 'POST',
        headers: {
          ...this.context.authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          data: inputData,
          preview: false
        })
      });
      
      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        throw new Error(errorData.error || `AI processing failed: ${aiResponse.statusText}`);
      }
      
      const aiResult = await aiResponse.json();
      
      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI processing failed');
      }
      
      console.log('🤖 AI processing completed successfully:', {
        model: aiResult.model_used,
        tokens: aiResult.tokens_used,
        outputLength: aiResult.output?.length || 0
      });
      
      // Update node execution record with results
      const updateResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
        method: 'PUT',
        headers: {
          ...this.context.authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          output_data: aiResult.output,
          ai_output: aiResult.output,
          ai_tokens_used: aiResult.tokens_used
        })
      });
      
      if (!updateResponse.ok) {
        console.warn(`Failed to update node execution record: ${updateResponse.statusText}`);
      }
      
      return aiResult.output;
      
    } catch (error) {
      console.error('🤖 AI Processor execution failed:', error);
      throw error;
    }
  }

  private async executeLinearRegression(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    if (inputs.length === 0) {
      throw new Error('Linear regression requires input data');
    }

    // Get the input data from the previous node
    const rawInputData = inputs[0].data;
    console.log('🤖 RAW INPUT DATA for linear regression:', {
      type: typeof rawInputData,
      isArray: Array.isArray(rawInputData),
      length: Array.isArray(rawInputData) ? rawInputData.length : 'N/A',
      sample: Array.isArray(rawInputData) ? rawInputData.slice(0, 2) : rawInputData,
      fullStructure: rawInputData
    });

    // Extract table data from webSource results (same logic as configuration)
    let inputData = rawInputData;
    
    if (Array.isArray(rawInputData)) {
      // Check if the array contains table objects (webSource format)
      if (rawInputData.length > 0 && typeof rawInputData[0] === 'object') {
        // Look for table data within the objects
        const flattenedData = [];
        for (const item of rawInputData) {
          if (typeof item === 'object' && item !== null) {
            // Extract table data from webSource results
            for (const [key, value] of Object.entries(item)) {
              if (Array.isArray(value) && value.length > 0 && 
                  typeof value[0] === 'object' && 
                  !key.startsWith('_')) {
                // This looks like table data
                console.log(`📊 Found table data in execution for key "${key}":`, value);
                flattenedData.push(...value);
              }
            }
          }
        }
        if (flattenedData.length > 0) {
          console.log('📊 Using flattened table data for execution:', flattenedData);
          inputData = flattenedData;
        }
      }
    } else if (typeof rawInputData === 'object' && rawInputData !== null) {
      // Check if the result object contains table data
      for (const [key, value] of Object.entries(rawInputData)) {
        if (Array.isArray(value) && value.length > 0 && 
            typeof value[0] === 'object' && 
            !key.startsWith('_')) {
          console.log(`📊 Found table data in execution for key "${key}":`, value);
          inputData = value;
          break;
        }
      }
    }

    console.log('🤖 PROCESSED INPUT DATA for linear regression:', {
      type: typeof inputData,
      isArray: Array.isArray(inputData),
      length: Array.isArray(inputData) ? inputData.length : 'N/A',
      sample: Array.isArray(inputData) ? inputData.slice(0, 2) : inputData,
      firstRecordKeys: Array.isArray(inputData) && inputData.length > 0 ? Object.keys(inputData[0]) : 'N/A'
    });

    // Extract configuration from node data
    const config = nodeData.model || {};
    const modelName = config.modelName || 'Workflow Linear Regression Model';
    const features = config.features || [];
    const target = config.target || '';

    // Validate configuration
    if (features.length === 0) {
      throw new Error('No feature columns selected. Please configure the linear regression node.');
    }
    if (!target) {
      throw new Error('No target column selected. Please configure the linear regression node.');
    }

    console.log('🎯 Linear regression configuration:', {
      features,
      target,
      modelName,
      config
    });

    try {
      // First, create a proper workflow execution and node execution
      const agentId = this.context.agentId;
      if (!agentId) {
        throw new Error('No agent ID available for execution tracking');
      }

      // Create workflow execution
      const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${agentId}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          workflow_nodes: this.context.nodes,
          workflow_edges: this.context.edges
        })
      });

      if (!executionResponse.ok) {
        throw new Error('Failed to create workflow execution');
      }

      const executionData = await executionResponse.json();
      const executionId = executionData.execution.id;

      // Create node execution
      const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          node_id: nodeId,
          node_type: 'linearRegression',
          model_type: 'linear_regression',
          model_name: modelName,
          features: features,
          target: target,
          training_config: config
        })
      });

      if (!nodeExecutionResponse.ok) {
        throw new Error('Failed to create node execution');
      }

      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution.id;

      console.log(`✅ Created execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Now call the ML training API with proper execution ID
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ml/models/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          input_data: inputData,
          model_type: 'linear_regression',
          node_execution_id: nodeExecutionId,
          model_name: modelName,
          features: features,
          target: target,
          config: config,
          manual_selection: true  // Flag to skip AI preprocessing
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Training failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Training failed');
      }

      console.log('✅ Linear regression training completed:', {
        modelId: result.model.id,
        metrics: result.model.metrics,
        features: result.model.features,
        target: result.model.target
      });

      // Return the training results for display in the format the dashboard expects
      return {
        success: true,
        training_data: result.training_data,
        // Dashboard display fields
        r_squared: result.model.metrics?.r2_score,
        mse: result.model.metrics?.mse,
        coefficients: result.model.model_metadata?.coefficients,
        intercept: result.model.model_metadata?.intercept,
        // Additional training info
        model: result.model,
        preprocessing: result.preprocessing,
        summary: {
          modelType: 'Linear Regression',
          modelName: result.model.name,
          features: result.model.features,
          target: result.model.target,
          samplesUsed: result.training_data?.total_samples,
          trainingSamples: result.training_data?.training_samples,
          testSamples: result.training_data?.test_samples,
          r2Score: result.model.metrics?.r2_score,
          mse: result.model.metrics?.mse
        }
      };

    } catch (error) {
      console.error('❌ Linear regression training failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Linear regression training failed: ${errorMessage}`);
    }
  }

  private async executeRandomForest(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    if (inputs.length === 0) {
      throw new Error('Random Forest requires input data');
    }

    // Get the input data from the previous node (same logic as linear regression)
    const rawInputData = inputs[0].data;
    console.log('🌲 RAW INPUT DATA for random forest:', {
      type: typeof rawInputData,
      isArray: Array.isArray(rawInputData),
      length: Array.isArray(rawInputData) ? rawInputData.length : 'N/A',
      sample: Array.isArray(rawInputData) ? rawInputData.slice(0, 2) : rawInputData,
      fullStructure: rawInputData
    });

    // Extract table data from webSource results (same logic as linear regression)
    let inputData = rawInputData;
    
    if (Array.isArray(rawInputData)) {
      // Check if the array contains table objects (webSource format)
      if (rawInputData.length > 0 && typeof rawInputData[0] === 'object') {
        // Look for table data within the objects
        const flattenedData = [];
        for (const item of rawInputData) {
          if (typeof item === 'object' && item !== null) {
            // Extract table data from webSource results
            for (const [key, value] of Object.entries(item)) {
              if (Array.isArray(value) && value.length > 0 && 
                  typeof value[0] === 'object' && 
                  !key.startsWith('_')) {
                // This looks like table data
                console.log(`📊 Found table data in execution for key "${key}":`, value);
                flattenedData.push(...value);
              }
            }
          }
        }
        if (flattenedData.length > 0) {
          console.log('📊 Using flattened table data for execution:', flattenedData);
          inputData = flattenedData;
        }
      }
    } else if (typeof rawInputData === 'object' && rawInputData !== null) {
      // Check if the result object contains table data
      for (const [key, value] of Object.entries(rawInputData)) {
        if (Array.isArray(value) && value.length > 0 && 
            typeof value[0] === 'object' && 
            !key.startsWith('_')) {
          console.log(`📊 Found table data in execution for key "${key}":`, value);
          inputData = value;
          break;
        }
      }
    }

    console.log('🌲 PROCESSED INPUT DATA for random forest:', {
      type: typeof inputData,
      isArray: Array.isArray(inputData),
      length: Array.isArray(inputData) ? inputData.length : 'N/A',
      sample: Array.isArray(inputData) ? inputData.slice(0, 2) : inputData,
      firstRecordKeys: Array.isArray(inputData) && inputData.length > 0 ? Object.keys(inputData[0]) : 'N/A'
    });

    // Extract configuration from node data
    const config = nodeData.model || {};
    const modelName = config.modelName || 'Workflow Random Forest Model';
    const features = config.features || [];
    const target = config.target || '';

    // Validate configuration
    if (features.length === 0) {
      throw new Error('No feature columns selected. Please configure the Random Forest node.');
    }
    if (!target) {
      throw new Error('No target column selected. Please configure the Random Forest node.');
    }

    console.log('🎯 Random Forest configuration:', {
      features,
      target,
      modelName,
      config
    });

    try {
      // First, create a proper workflow execution and node execution
      const agentId = this.context.agentId;
      if (!agentId) {
        throw new Error('No agent ID available for execution tracking');
      }

      // Create workflow execution
      const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${agentId}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          workflow_nodes: this.context.nodes,
          workflow_edges: this.context.edges
        })
      });

      if (!executionResponse.ok) {
        throw new Error('Failed to create workflow execution');
      }

      const executionData = await executionResponse.json();
      const executionId = executionData.execution.id;

      // Create node execution
      const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          node_id: nodeId,
          node_type: 'randomForest',
          model_type: 'random_forest',
          model_name: modelName,
          features: features,
          target: target,
          training_config: config
        })
      });

      if (!nodeExecutionResponse.ok) {
        throw new Error('Failed to create node execution');
      }

      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution.id;

      console.log(`✅ Created execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Now call the ML training API with proper execution ID
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ml/models/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          input_data: inputData,
          model_type: 'random_forest',
          node_execution_id: nodeExecutionId,
          model_name: modelName,
          features: features,
          target: target,
          config: config,
          manual_selection: true  // Flag to skip AI preprocessing
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Training failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Training failed');
      }

      console.log('✅ Random Forest training completed:', {
        modelId: result.model.id,
        metrics: result.model.metrics,
        features: result.model.features,
        target: result.model.target,
        feature_importance: result.model.model_metadata?.feature_importance
      });

      // Return the training results for display in the format the dashboard expects
      return {
        success: true,
        training_data: result.training_data,
        // Dashboard display fields
        r_squared: result.model.metrics?.r2_score,
        mse: result.model.metrics?.mse,
        feature_importance: result.model.model_metadata?.feature_importance,
        // Additional training info
        model: result.model,
        preprocessing: result.preprocessing,
        summary: {
          modelType: 'Random Forest',
          modelName: result.model.name,
          features: result.model.features,
          target: result.model.target,
          samplesUsed: result.training_data?.total_samples,
          trainingSamples: result.training_data?.training_samples,
          testSamples: result.training_data?.test_samples,
          nEstimators: result.model.model_metadata?.n_estimators,
          r2Score: result.model.metrics?.r2_score,
          mse: result.model.metrics?.mse,
          featureImportance: result.model.model_metadata?.feature_importance
        }
      };
    } catch (error) {
      console.error('❌ Random Forest training failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Random Forest training failed: ${errorMessage}`);
    }
  }

  private async executeChartGenerator(nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    // TODO: Implement chart generation logic
    if (inputs.length === 0) {
      throw new Error('Chart generator requires input data');
    }
    
    return {
      chartType: 'bar',
      data: inputs[0].data,
      title: 'Generated Chart'
    };
  }

  private async executePostgres(nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const config = nodeData.postgres;
    
    if (!config) {
      throw new Error('PostgreSQL node is not configured');
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

    try {
      // Handle source mode (query execution)
      if (config.operationMode === 'source') {
        if (!config.query?.trim()) {
          throw new Error('Source query is required for PostgreSQL source mode');
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/postgres/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify({
            host: config.host,
            port: config.port || 5432,
            database: config.database,
            username: config.username,
            password: config.password,
            query: config.query,
            limit: 1000
          })
        });

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'PostgreSQL query failed');
        }

        return result.data;
      }
      
      // Handle sink mode (data insertion)
      else if (config.operationMode === 'sink') {
        if (inputs.length === 0) {
          throw new Error('PostgreSQL sink mode requires input data');
        }

        let inputData = inputs[0].data;
        
        // Handle multi-table structure from web source
        if (Array.isArray(inputData) && inputData.length > 0) {
          const firstItem = inputData[0];
          if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
            const keys = Object.keys(firstItem);
            const isMultiTableStructure = keys.every(key => Array.isArray(firstItem[key]));
            
            if (isMultiTableStructure) {
              console.log('🗂️ Multi-table structure detected in execution engine:', keys);
              
              // For now, use the first table or a specified table
              // TODO: In the future, we could process multiple tables
              const selectedTable = keys[0]; // Use first table for now
              inputData = firstItem[selectedTable];
              console.log(`📊 Using table '${selectedTable}' with ${inputData.length} rows`);
            }
          }
        }
        
        if (!Array.isArray(inputData) || inputData.length === 0) {
          throw new Error('PostgreSQL sink mode requires array of objects as input');
        }

        // Dynamic table creation mode
        if (config.createTableDynamically) {
          if (!config.dynamicTableName?.trim()) {
            throw new Error('Dynamic table name is required for dynamic table creation');
          }

          const response = await fetch(`${apiBaseUrl}/api/v1/postgres/create-table-and-insert`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.context.authHeaders
            },
            body: JSON.stringify({
              host: config.host,
              port: config.port || 5432,
              database: config.database,
              username: config.username,
              password: config.password,
              table_name: config.dynamicTableName,
              data: inputData,
              schema: 'public',
              column_types: config.selectedColumnTypes || null
            })
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Dynamic table creation failed');
          }

          return {
            success: true,
            table_created: true,
            table_name: result.table_name,
            rows_affected: result.rows_affected,
            message: result.message
          };
        }
        
        // Regular insertion mode
        else {
          if (!config.tableName?.trim()) {
            throw new Error('Table name is required for PostgreSQL sink mode');
          }

          const response = await fetch(`${apiBaseUrl}/api/v1/postgres/insert`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.context.authHeaders
            },
            body: JSON.stringify({
              host: config.host,
              port: config.port || 5432,
              database: config.database,
              username: config.username,
              password: config.password,
              table_name: config.tableName,
              data: inputData,
              schema: 'public',
              insert_mode: config.insertMode || 'insert',
              conflict_columns: config.conflictColumns || [],
              column_mappings: config.columnMappings || []
            })
          });

          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'PostgreSQL insertion failed');
          }

          return {
            success: true,
            rows_affected: result.rows_affected,
            message: result.message
          };
        }
      }
      
      else {
        throw new Error('Invalid PostgreSQL operation mode. Must be "source" or "sink"');
      }
      
    } catch (error) {
      throw new Error(`PostgreSQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeHttpRequest(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const config = nodeData.httpRequest;
    
    if (!config) {
      throw new Error('HTTP Request node is not configured');
    }

    if (!config.url?.trim()) {
      throw new Error('URL is required for HTTP Request');
    }

    const startTime = Date.now();
    let nodeExecutionId: number | undefined;
    
    console.log('🔍 HTTP Request execution - nodeId:', nodeId, 'nodeData:', nodeData);
    console.log('🔍 Loop config:', config.loopConfig);

    // Check if looping is enabled
    if (config.loopConfig?.enabled && config.loopConfig.parameters.length > 0) {
      return await this.executeHttpRequestWithLoop(nodeId, config, inputs, startTime);
    } else {
      return await this.executeHttpRequestSingle(nodeId, config, inputs, startTime);
    }
  }

  private async executeHttpRequestSingle(nodeId: string, config: any, inputs: NodeOutput[], startTime: number): Promise<any> {
    let nodeExecutionId: number | undefined;
    
    try {
      // Create execution tracking first
      const agentId = this.context.agentId;
      if (!agentId) {
        throw new Error('No agent ID available for execution tracking');
      }

      // Create workflow execution if not exists (simplified for now)
      const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${agentId}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          workflow_nodes: this.context.nodes,
          workflow_edges: this.context.edges
        })
      });

      const executionData = await executionResponse.json();
      const executionId = executionData.execution?.id;
      
      // Create node execution record
      const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          node_id: nodeId,  // Use actual node ID for execution tracking
          node_type: 'httpRequest',
          method: config.method,
          url: config.url,
          auth_type: config.authentication?.type || 'none'
        })
      });

      const nodeExecutionData = await nodeExecutionResponse.json();
      nodeExecutionId = nodeExecutionData.node_execution?.id;
      
      console.log('🔍 Node execution creation response:', nodeExecutionData);
      console.log('🔍 Node execution ID:', nodeExecutionId);
      
      // Apply input variable substitutions to URL, headers, and body
      let processedUrl = config.url;
      let processedHeaders = config.headers ? { ...config.headers } : {};
      let processedQueryParams = config.queryParams ? { ...config.queryParams } : {};
      let processedBody = config.body;

      // If we have input data, make it available for variable substitution
      if (inputs.length > 0) {
        const inputData = inputs[0].data;
        
        // Simple variable substitution - replace {{variable}} patterns
        const substituteVariables = (text: string): string => {
          return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
            // Try to extract the variable from input data
            if (typeof inputData === 'object' && inputData !== null) {
              const value = inputData[variable.trim()];
              return value !== undefined ? String(value) : match;
            }
            return match;
          });
        };

        // Apply substitutions
        processedUrl = substituteVariables(processedUrl);
        
        // Process headers
        Object.keys(processedHeaders).forEach(key => {
          if (typeof processedHeaders[key] === 'string') {
            processedHeaders[key] = substituteVariables(processedHeaders[key]);
          }
        });

        // Process query parameters
        Object.keys(processedQueryParams).forEach(key => {
          if (typeof processedQueryParams[key] === 'string') {
            processedQueryParams[key] = substituteVariables(processedQueryParams[key]);
          }
        });

        // Process body if it's a string
        if (typeof processedBody === 'string') {
          processedBody = substituteVariables(processedBody);
        }
      }

      // Build authentication headers
      const authHeaders: Record<string, string> = {};
      
      if (config.authentication?.enabled) {
        const auth = config.authentication;
        
        switch (auth.type) {
          case 'apiKey':
            if (auth.apiKey?.key && auth.apiKey?.value) {
              if (auth.apiKey.location === 'header') {
                authHeaders[auth.apiKey.key] = auth.apiKey.value;
              }
              // Query parameter handling would be done in URL construction
            }
            break;
            
          case 'bearer':
            if (auth.bearerToken?.token) {
              authHeaders['Authorization'] = `Bearer ${auth.bearerToken.token}`;
            }
            break;
            
          case 'basic':
            if (auth.basicAuth?.username && auth.basicAuth?.password) {
              const credentials = btoa(`${auth.basicAuth.username}:${auth.basicAuth.password}`);
              authHeaders['Authorization'] = `Basic ${credentials}`;
            }
            break;
            
          case 'oauth2':
            if (auth.oauth2?.accessToken) {
              authHeaders['Authorization'] = `Bearer ${auth.oauth2.accessToken}`;
            }
            break;
            
          case 'custom':
            if (auth.customHeaders) {
              Object.entries(auth.customHeaders).forEach(([key, value]) => {
                if (key && value && typeof value === 'string') {
                  authHeaders[key] = value;
                }
              });
            }
            break;
        }
      }

      // Build query string for API key in query params
      const urlParams = new URLSearchParams();
      
      // Add regular query parameters
      Object.entries(processedQueryParams).forEach(([key, value]) => {
        if (key && value && typeof value === 'string') {
          urlParams.append(key, value);
        }
      });
      
      // Add API key to query params if configured
      if (config.authentication?.enabled && 
          config.authentication.type === 'apiKey' && 
          config.authentication.apiKey?.location === 'query' &&
          config.authentication.apiKey?.key && 
          config.authentication.apiKey?.value) {
        urlParams.append(config.authentication.apiKey.key, config.authentication.apiKey.value);
      }

      // Construct final URL
      const finalUrl = urlParams.toString() 
        ? `${processedUrl}${processedUrl.includes('?') ? '&' : '?'}${urlParams.toString()}`
        : processedUrl;

      // Build final headers
      const finalHeaders = {
        ...processedHeaders,
        ...authHeaders,
        ...this.context.authHeaders // Include workflow auth headers
      };

      // Set content type for POST/PUT/PATCH with body
      if (['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase()) && processedBody) {
        if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
          finalHeaders['Content-Type'] = 'application/json';
        }
      }

      console.log('🌐 HTTP Request execution:', {
        method: config.method,
        url: finalUrl,
        headers: Object.keys(finalHeaders),
        hasBody: !!processedBody
      });

      // Make the HTTP request - use proxy if configured
      let responseData: any;
      let responseHeaders: Record<string, string> = {};
      let responseStatus: number;
      let responseOk: boolean;
      let responseTime: number;
      
      if (config.useProxy) {
        // Use server-side CORS proxy
        console.log('🌐 Using server-side CORS proxy for request');
        
        const proxyData: any = {
          url: finalUrl,
          method: config.method.toUpperCase(),
          headers: finalHeaders,
          timeout: config.timeout || 30000
        };
        
        // Add body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase()) && processedBody) {
          proxyData.data = processedBody;
        }
        
        // Make request to our proxy endpoint
        const proxyResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/proxy/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify(proxyData),
          signal: AbortSignal.timeout(config.timeout || 30000)
        });
        
        if (!proxyResponse.ok) {
          throw new Error(`Proxy request failed: ${proxyResponse.status} ${proxyResponse.statusText}`);
        }
        
        const proxyResult = await proxyResponse.json();
        
        if (!proxyResult.success) {
          throw new Error(`Proxy request failed: ${proxyResult.error || 'Unknown error'}`);
        }
        
        // Extract data from proxy result
        responseData = proxyResult.data;
        responseHeaders = proxyResult.headers || {};
        responseStatus = proxyResult.status_code;
        responseOk = proxyResult.status_code >= 200 && proxyResult.status_code < 300;
        responseTime = proxyResult.elapsed_ms || 0;
        
      } else {
        // Direct request (original behavior)
        const requestConfig: RequestInit = {
          method: config.method.toUpperCase(),
          headers: finalHeaders,
          // Add timeout handling
          signal: AbortSignal.timeout(config.timeout || 30000)
        };

        // Add body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase()) && processedBody) {
          if (typeof processedBody === 'string') {
            requestConfig.body = processedBody;
          } else {
            requestConfig.body = JSON.stringify(processedBody);
          }
        }

        const response = await fetch(finalUrl, requestConfig);
        
        // Get response headers
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Parse response body
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          try {
            responseData = await response.json();
          } catch {
            responseData = await response.text();
          }
        } else {
          responseData = await response.text();
        }
        
        responseStatus = response.status;
        responseOk = response.ok;
        responseTime = Date.now() - startTime;
      }
      
      // Calculate response size
      const responseSize = JSON.stringify(responseData).length;
      
      // Update node execution with results
      if (nodeExecutionId) {
        console.log('🔍 Updating node execution', nodeExecutionId, 'with results');
        const updateResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify({
            status: responseOk ? 'completed' : 'failed',
            error_message: responseOk ? null : `HTTP ${responseStatus}`,
            output_data: responseData,
            status_code: responseStatus,
            response_time: responseTime,
            response_size: responseSize,
            response_headers: responseHeaders
          })
        });
        
        const updateData = await updateResponse.json();
        console.log('🔍 Node execution update response:', updateData);
      } else {
        console.error('🔍 No nodeExecutionId available for updating results');
      }

      // Return structured response data
      return {
        status: responseStatus,
        statusText: '',
        data: responseData,
        headers: responseHeaders,
        url: finalUrl,
        method: config.method.toUpperCase(),
        success: responseOk,
        responseTime,
        responseSize
      };

    } catch (error) {
      // Update node execution with error if we have the ID
      if (nodeExecutionId) {
        try {
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...this.context.authHeaders
            },
            body: JSON.stringify({
              status: 'failed',
              error_message: error instanceof Error ? error.message : String(error),
              response_time: Date.now() - startTime
            })
          });
        } catch (updateError) {
          console.error('Failed to update node execution with error:', updateError);
        }
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`HTTP Request timeout after ${config.timeout || 30000}ms`);
      }
      
      throw new Error(`HTTP Request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeHttpRequestWithLoop(nodeId: string, config: any, inputs: NodeOutput[], startTime: number): Promise<any> {
    console.log('🔄 Starting HTTP request loop execution');
    
    try {
      // Generate parameter combinations for looping
      const parameterCombinations = await this.generateParameterCombinations(config.loopConfig, inputs);
      console.log(`🔄 Generated ${parameterCombinations.length} parameter combinations`);
      
      if (parameterCombinations.length === 0) {
        throw new Error('No parameter combinations generated for loop execution');
      }

      // Create execution tracking
      const agentId = this.context.agentId;
      if (!agentId) {
        throw new Error('No agent ID available for execution tracking');
      }

      // Create workflow execution
      const executionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/agents/${agentId}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          workflow_nodes: this.context.nodes,
          workflow_edges: this.context.edges
        })
      });

      const executionData = await executionResponse.json();
      const executionId = executionData.execution?.id;
      
      // Create main node execution record for the loop
      const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          node_id: nodeId,
          node_type: 'httpRequest',
          method: config.method,
          url: config.url,
          auth_type: config.authentication?.type || 'none',
          // Store loop configuration in node-specific data
          loop_enabled: true,
          loop_total_iterations: parameterCombinations.length,
          loop_concurrency: config.loopConfig.concurrency,
          loop_aggregation_mode: config.loopConfig.aggregationMode
        })
      });

      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution?.id;
      
      console.log('🔄 Created loop execution with ID:', nodeExecutionId);

      // Execute requests with controlled concurrency
      const results = await this.executeRequestsInBatches(
        nodeId,
        config,
        inputs,
        parameterCombinations,
        nodeExecutionId,
        startTime
      );

      // Aggregate results based on configuration
      const aggregatedResults = this.aggregateLoopResults(results, config.loopConfig.aggregationMode);
      
      // Update main execution with final results
      if (nodeExecutionId) {
        const totalTime = Date.now() - startTime;
        const successfulRequests = results.filter(r => r.success).length;
        const failedRequests = results.filter(r => !r.success).length;
        
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify({
            status: failedRequests === 0 ? 'completed' : 'completed_with_errors',
            output_data: aggregatedResults,
            response_time: totalTime,
            // Loop-specific metrics
            loop_successful_iterations: successfulRequests,
            loop_failed_iterations: failedRequests,
            loop_total_time: totalTime,
            iterations: results.map(r => ({
              parameters: r.parameters,
              success: r.success,
              status_code: r.statusCode,
              response_time: r.responseTime,
              error: r.error
            }))
          })
        });
      }

      console.log(`🔄 Loop execution completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return aggregatedResults;
      
    } catch (error) {
      console.error('🔄 Loop execution failed:', error);
      throw new Error(`HTTP Request loop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateParameterCombinations(loopConfig: any, inputs: NodeOutput[]): Promise<any[]> {
    const combinations: any[] = [];
    
    // Generate values for each parameter
    const parameterValues: { [key: string]: any[] } = {};
    
    for (const param of loopConfig.parameters) {
      let values: any[] = [];
      
      switch (param.type) {
        case 'range':
          // Generate numeric range
          const start = param.start ?? 1;
          const end = param.end ?? 10;
          const step = param.step ?? 1;
          
          for (let i = start; i <= end; i += step) {
            values.push(i);
          }
          break;
          
        case 'list':
          // Use provided list of values
          values = param.values || [];
          break;
          
        case 'input_variable':
          // Extract values from input data using JSONPath
          if (inputs.length > 0 && param.inputPath) {
            values = this.extractValuesFromInputPath(inputs[0].data, param.inputPath);
          }
          break;
      }
      
      parameterValues[param.name] = values;
      console.log(`🔄 Parameter '${param.name}' has ${values.length} values:`, values.slice(0, 5));
    }
    
    // Generate all combinations (Cartesian product)
    const paramNames = Object.keys(parameterValues);
    if (paramNames.length === 0) return [];
    
    const generateCombinations = (names: string[], index: number, current: any): any[] => {
      if (index === names.length) {
        return [{ ...current }];
      }
      
      const results: any[] = [];
      const paramName = names[index];
      const values = parameterValues[paramName];
      
      for (const value of values) {
        results.push(...generateCombinations(names, index + 1, { ...current, [paramName]: value }));
      }
      
      return results;
    };
    
    const allCombinations = generateCombinations(paramNames, 0, {});
    console.log(`🔄 Generated ${allCombinations.length} total combinations`);
    
    return allCombinations;
  }

  private extractValuesFromInputPath(data: any, path: string): any[] {
    try {
      // Simple JSONPath implementation - supports basic dot notation and array indexing
      const parts = path.split('.');
      let current = data;
      
      for (const part of parts) {
        if (part.includes('[*]')) {
          // Handle array expansion like "users[*].id"
          const arrayPath = part.replace('[*]', '');
          if (Array.isArray(current[arrayPath])) {
            return current[arrayPath].map((item: any) => item);
          }
        } else if (current && typeof current === 'object') {
          current = current[part];
        } else {
          return [];
        }
      }
      
      return Array.isArray(current) ? current : [current];
    } catch (error) {
      console.error('Error extracting values from input path:', error);
      return [];
    }
  }

  private async executeRequestsInBatches(
    nodeId: string,
    config: any,
    inputs: NodeOutput[],
    parameterCombinations: any[],
    nodeExecutionId: number,
    startTime: number
  ): Promise<any[]> {
    const results: any[] = [];
    const concurrency = config.loopConfig.concurrency || 1;
    const delay = config.loopConfig.delayBetweenRequests || 100;
    const stopOnError = config.loopConfig.stopOnError ?? true;
    
    console.log(`🔄 Executing ${parameterCombinations.length} requests with concurrency ${concurrency}`);
    
    // Process in batches for controlled concurrency
    for (let i = 0; i < parameterCombinations.length; i += concurrency) {
      const batch = parameterCombinations.slice(i, i + concurrency);
      
      // Execute batch in parallel
      const batchPromises = batch.map(async (parameters, batchIndex) => {
        const iterationIndex = i + batchIndex;
        console.log(`🔄 Executing iteration ${iterationIndex + 1}/${parameterCombinations.length}`);
        
        try {
          const result = await this.executeHttpRequestIteration(
            config,
            inputs,
            parameters,
            iterationIndex,
            startTime
          );
          
          return {
            iteration: iterationIndex,
            parameters,
            success: true,
            ...result
          };
        } catch (error) {
          console.error(`🔄 Iteration ${iterationIndex + 1} failed:`, error);
          
          return {
            iteration: iterationIndex,
            parameters,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            statusCode: 0,
            responseTime: 0,
            data: null
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Check for early termination on error
      if (stopOnError && batchResults.some(r => !r.success)) {
        console.log('🔄 Stopping loop execution due to error (stopOnError=true)');
        break;
      }
      
      // Add delay between batches (except for the last batch)
      if (i + concurrency < parameterCombinations.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }

  private async executeHttpRequestIteration(
    config: any,
    inputs: NodeOutput[],
    parameters: any,
    iterationIndex: number,
    startTime: number
  ): Promise<any> {
    const iterationStartTime = Date.now();
    
    // Apply parameter substitutions to URL, headers, and body
    let processedUrl = config.url;
    let processedHeaders = config.headers ? { ...config.headers } : {};
    let processedQueryParams = config.queryParams ? { ...config.queryParams } : {};
    let processedBody = config.body;

    // Substitute loop parameters and input variables
    const substituteVariables = (text: string): string => {
      return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        const trimmedVar = variable.trim();
        
        // First try loop parameters
        if (parameters[trimmedVar] !== undefined) {
          return String(parameters[trimmedVar]);
        }
        
        // Then try input data
        if (inputs.length > 0) {
          const inputData = inputs[0].data;
          if (typeof inputData === 'object' && inputData !== null) {
            const value = inputData[trimmedVar];
            return value !== undefined ? String(value) : match;
          }
        }
        
        return match;
      });
    };

    // Apply substitutions
    processedUrl = substituteVariables(processedUrl);
    
    Object.keys(processedHeaders).forEach(key => {
      if (typeof processedHeaders[key] === 'string') {
        processedHeaders[key] = substituteVariables(processedHeaders[key]);
      }
    });

    Object.keys(processedQueryParams).forEach(key => {
      if (typeof processedQueryParams[key] === 'string') {
        processedQueryParams[key] = substituteVariables(processedQueryParams[key]);
      }
    });

    if (typeof processedBody === 'string') {
      processedBody = substituteVariables(processedBody);
    }

    // Build final URL with query parameters
    if (Object.keys(processedQueryParams).length > 0) {
      const params = new URLSearchParams();
      Object.entries(processedQueryParams).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          params.append(key, value);
        }
      });
      processedUrl += (processedUrl.includes('?') ? '&' : '?') + params.toString();
    }

    // Build authentication headers (reusing existing logic)
    const authHeaders: Record<string, string> = {};
    
    if (config.authentication?.enabled) {
      const auth = config.authentication;
      
      switch (auth.type) {
        case 'apiKey':
          if (auth.apiKey?.key && auth.apiKey?.value) {
            if (auth.apiKey.location === 'header') {
              authHeaders[auth.apiKey.key] = auth.apiKey.value;
            }
          }
          break;
          
        case 'bearer':
          if (auth.bearerToken?.token) {
            authHeaders['Authorization'] = `Bearer ${auth.bearerToken.token}`;
          }
          break;
          
        case 'basic':
          if (auth.basicAuth?.username && auth.basicAuth?.password) {
            const credentials = btoa(`${auth.basicAuth.username}:${auth.basicAuth.password}`);
            authHeaders['Authorization'] = `Basic ${credentials}`;
          }
          break;
          
        case 'oauth2':
          if (auth.oauth2?.accessToken) {
            authHeaders['Authorization'] = `Bearer ${auth.oauth2.accessToken}`;
          }
          break;
          
        case 'custom':
          if (auth.customHeaders) {
            Object.entries(auth.customHeaders).forEach(([key, value]) => {
              if (key && value && typeof value === 'string') {
                authHeaders[key] = value;
              }
            });
          }
          break;
      }
    }

    // Combine all headers
    const finalHeaders = {
      ...processedHeaders,
      ...authHeaders,
      ...this.context.authHeaders
    };

    // Set content type for POST/PUT/PATCH with body
    if (['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase()) && processedBody) {
      if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    }

    console.log(`🔄 Iteration ${iterationIndex + 1} - Request:`, {
      method: config.method,
      url: processedUrl,
      parameters,
      headers: Object.keys(finalHeaders)
    });

    // Make the HTTP request
    const requestConfig: RequestInit = {
      method: config.method.toUpperCase(),
      headers: finalHeaders,
      signal: AbortSignal.timeout(config.timeout || 30000)
    };

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase()) && processedBody) {
      if (typeof processedBody === 'string') {
        requestConfig.body = processedBody;
      } else {
        requestConfig.body = JSON.stringify(processedBody);
      }
    }

    const response = await fetch(processedUrl, requestConfig);
    
    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Parse response body
    let responseData: any;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    const responseTime = Date.now() - iterationStartTime;
    const responseSize = JSON.stringify(responseData).length;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      statusCode: response.status,
      responseTime,
      responseSize,
      responseHeaders,
      data: responseData
    };
  }

  private async executeFileNode(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const config = nodeData.fileNode;
    
    console.log('🔄 Raw nodeData received:', nodeData);
    console.log('🔄 FileNode config extracted:', config);
    
    if (!config) {
      throw new Error('File node is not configured');
    }

    // Use the same API base URL as other components for consistency
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

    console.log('🔄 Executing FileNode with config:', config);
    console.log('🔄 FilePath from config:', config.filePath);
    console.log('🔄 Auth headers:', this.context.authHeaders);

    try {
      if (config.operationMode === 'source') {
        // Validate required fields for source mode
        if (!config.filePath) {
          throw new Error('File path is missing. Please upload a file in the node configuration.');
        }
        
        if (!config.fileName) {
          throw new Error('File name is missing. Please reconfigure the file node.');
        }
        
        // Load file mode - ensure we have proper file configuration
        const requestBody = {
          ...config,
          // Ensure required fields are present
          filePath: config.filePath,
          fileName: config.fileName,
          fileType: config.fileType,
          operationMode: 'source',
          // Add execution tracking parameters
          nodeId: nodeId,
          agentId: this.context.agentId,
          // Include file parsing options with defaults
          hasHeaders: config.hasHeaders ?? true,
          delimiter: config.delimiter || ',',
          encoding: config.encoding || 'utf-8',
          // Include limits if specified
          maxRows: config.maxRows,
          skipRows: config.skipRows || 0,
          // Include field selection if specified
          selectedFields: config.selectedFields
        };

        console.log('🔄 File load request body:', requestBody);

        const response = await fetch(`${apiBaseUrl}/api/v1/file-node/load`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ File load execution failed:', response.status, errorText);
          throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ File load execution successful:', result);
        
        if (!result.success) {
          throw new Error(result.error || 'File loading failed');
        }

        return result.data;
      } else if (config.operationMode === 'sink') {
        // Save file mode
        const inputData = inputs.length > 0 ? inputs[0].data : [];

        const requestBody = {
          ...config,
          inputData,
          // Ensure we have required sink mode fields
          outputFileName: config.outputFileName,
          outputPath: config.outputPath,
          operationMode: 'sink',
          // Include field mappings if specified
          fieldMappings: config.fieldMappings,
          // Include format options
          overwriteExisting: config.overwriteExisting ?? false,
          createDirectories: config.createDirectories ?? true
        };

        console.log('🔄 File save request body:', requestBody);

        const response = await fetch(`${apiBaseUrl}/api/v1/file-node/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.context.authHeaders
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ File save execution failed:', response.status, errorText);
          throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ File save execution successful:', result);
        
        if (!result.success) {
          throw new Error(result.error || 'File saving failed');
        }

        return {
          success: true,
          fileName: result.fileName,
          filePath: result.filePath,
          recordsSaved: result.records_saved || 0,
          message: `Successfully saved ${result.records_saved || 0} records to ${result.fileName}`
        };
      } else {
        throw new Error('File node operation mode must be either "source" or "sink"');
      }
    } catch (error) {
      throw new Error(`File node execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private aggregateLoopResults(results: any[], aggregationMode: string): any {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return {
        results: [],
        summary: {
          total_iterations: results.length,
          successful_iterations: 0,
          failed_iterations: results.length,
          total_response_time: results.reduce((sum, r) => sum + (r.responseTime || 0), 0)
        }
      };
    }

    let aggregatedData: any;
    
    switch (aggregationMode) {
      case 'append':
        // Create array of all responses
        aggregatedData = successfulResults.map(r => ({
          parameters: r.parameters,
          data: r.data,
          statusCode: r.statusCode,
          responseTime: r.responseTime
        }));
        break;
        
      case 'merge':
        // Try to merge responses intelligently
        const allData = successfulResults.map(r => r.data);
        
        // If all responses are arrays, concatenate them
        if (allData.every(d => Array.isArray(d))) {
          aggregatedData = allData.flat();
        }
        // If all responses are objects, merge them
        else if (allData.every(d => typeof d === 'object' && d !== null && !Array.isArray(d))) {
          aggregatedData = Object.assign({}, ...allData);
        }
        // Otherwise, just append them
        else {
          aggregatedData = allData;
        }
        break;
        
      default:
        aggregatedData = successfulResults.map(r => r.data);
    }

    return {
      data: aggregatedData,
      summary: {
        total_iterations: results.length,
        successful_iterations: successfulResults.length,
        failed_iterations: results.length - successfulResults.length,
        total_response_time: results.reduce((sum, r) => sum + (r.responseTime || 0), 0),
        average_response_time: successfulResults.length > 0 
          ? Math.round(successfulResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / successfulResults.length)
          : 0
      },
      iterations: results.map(r => ({
        parameters: r.parameters,
        success: r.success,
        status_code: r.statusCode || 0,
        response_time: r.responseTime || 0,
        error: r.error
      }))
    };
  }

  // Utility methods
  private getNode(nodeId: string): Node | undefined {
    return this.context.nodes.find(n => n.id === nodeId);
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

  private getSourceNodes(): Node[] {
    const targetNodeIds = new Set(this.context.edges.map(e => e.target));
    return this.context.nodes.filter(n => !targetNodeIds.has(n.id));
  }

  private canUseCachedOutput(nodeId: string, inputs: NodeOutput[]): boolean {
    const cachedOutput = this.context.outputCache.get(nodeId);
    
    if (!cachedOutput || cachedOutput.executionStatus !== ExecutionStatus.SUCCESS) {
      return false;
    }
    
    // Check if inputs have changed
    const currentInputSources = inputs.map(input => input.nodeId).sort();
    const cachedInputSources = cachedOutput.inputSources.sort();
    
    if (currentInputSources.length !== cachedInputSources.length) {
      return false;
    }
    
    for (let i = 0; i < currentInputSources.length; i++) {
      if (currentInputSources[i] !== cachedInputSources[i]) {
        return false;
      }
    }
    
    // TODO: Add more sophisticated cache invalidation logic
    // (e.g., check if input data has actually changed)
    
    return true;
  }

  private cacheOutput(nodeId: string, output: NodeOutput): void {
    this.context.outputCache.set(nodeId, output);
  }

  private addToExecutionHistory(nodeId: string, output: NodeOutput): void {
    if (!this.executionHistory.has(nodeId)) {
      this.executionHistory.set(nodeId, []);
    }
    
    const history = this.executionHistory.get(nodeId)!;
    history.push(output);
    
    // Keep only last 10 executions per node
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }


  /**
   * Substitute variables in text using {{variable}} syntax
   */
  private substituteVariables(text: string, variables: Record<string, any>): string {
    let result = text;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Public getters for external access
  public getOutputCache(): Map<string, NodeOutput> {
    return this.context.outputCache;
  }

  public getExecutionHistory(nodeId?: string): NodeOutput[] {
    if (nodeId) {
      return this.executionHistory.get(nodeId) || [];
    }
    
    const allHistory: NodeOutput[] = [];
    for (const history of this.executionHistory.values()) {
      allHistory.push(...history);
    }
    
    return allHistory.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Update context (for when nodes/edges change)
  public updateContext(context: Partial<ExecutionContext>): void {
    this.context = { ...this.context, ...context };
  }
}