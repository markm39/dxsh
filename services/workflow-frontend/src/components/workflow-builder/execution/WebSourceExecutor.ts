import { ExecutionContext, NodeOutput, WorkflowNodeData, DataType } from './types';
import { ParameterGenerator } from './ParameterGenerator';
import { workflowService } from '../services';

export class WebSourceExecutor {
  private parameterGenerator: ParameterGenerator;

  constructor(private context: ExecutionContext) {
    this.parameterGenerator = new ParameterGenerator();
  }

  /**
   * Execute web source node
   */
  async execute(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const { monitoring } = nodeData;
    console.log('🔍 DEBUG: nodeData:', nodeData);
    console.log('🔍 DEBUG: monitoring config:', monitoring);
    
    if (!monitoring) {
      throw new Error('Web source not configured');
    }

    // Check for loop configuration
    if (monitoring.loopConfig?.enabled && monitoring.loopConfig.parameters.length > 0) {
      return await this.executeWithLoop(nodeId, monitoring, inputs);
    }

    return await this.executeSingle(nodeId, monitoring, inputs);
  }

  /**
   * Execute single web source extraction
   */
  private async executeSingle(nodeId: string, monitoring: any, inputs: NodeOutput[]): Promise<any> {
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
    
    // Use the imported workflowService
    
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
    
    // Send raw selector configuration directly to backend - let backend handle extraction logic
    console.log('🚀 WORKFLOW EXECUTION - SENDING RAW CONFIG TO BACKEND:', { 
      url: monitoring.url, 
      selectors: selectors
    });
    
    try {
      const result = await workflowService.extractData(
        monitoring.url,
        selectors,
        this.context.authHeaders
      );
      
      console.log('🎯 Workflow extraction result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to extract data');
      }
      
      const extractedData = result.result?.extracted_data || [];
      console.log('📥 WORKFLOW EXECUTION - EXTRACTED DATA:', extractedData);

      // Note: Node execution status updates temporarily disabled due to API method not supported
      // TODO: Implement proper execution tracking endpoint
      // await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes/${nodeExecutionId}`, {
      //   method: 'PATCH',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...this.context.authHeaders
      //   },
      //   body: JSON.stringify({
      //     status: 'completed',
      //     output_data: extractedData,
      //     completed_at: new Date().toISOString()
      //   })
      // });

      return extractedData;
    } catch (error: any) {
      console.error('🚨 Workflow extraction failed:', error);
      
      // Note: Node execution status updates temporarily disabled due to API method not supported
      // TODO: Implement proper execution tracking endpoint for errors
      // await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes/${nodeExecutionId}`, {
      //   method: 'PATCH',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...this.context.authHeaders
      //   },
      //   body: JSON.stringify({
      //     status: 'failed',
      //     error_message: error.message || 'Unknown error',
      //     completed_at: new Date().toISOString()
      //   })
      // });

      throw error;
    }
  }

  /**
   * Execute web source with parameter looping
   */
  private async executeWithLoop(nodeId: string, monitoring: any, inputs: NodeOutput[]): Promise<any> {
    const startTime = Date.now();
    console.log('🔄 Starting webSource loop execution');

    // Generate parameter combinations
    const parameterCombinations = await this.parameterGenerator.generateParameterCombinations(monitoring.loopConfig, inputs);
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
      throw new Error('Failed to create workflow execution for loop');
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
        parameters: parameterCombinations,
        status: 'running'
      })
    });

    if (!nodeExecutionResponse.ok) {
      throw new Error('Failed to create node execution record for loop');
    }

    const nodeExecutionData = await nodeExecutionResponse.json();
    const nodeExecutionId = nodeExecutionData.node_execution?.id;

    try {
      // Use the imported workflowService
      
      const results = [];
      const selectors = monitoring.originalSelectors || monitoring.selectors || [];

      console.log('🔄 Processing loop iterations...');
      
      // Execute requests in batches based on concurrency setting
      const batchSize = monitoring.loopConfig.concurrency || 1;
      const batches = [];
      
      for (let i = 0; i < parameterCombinations.length; i += batchSize) {
        batches.push(parameterCombinations.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);

        const batchPromises = batch.map(async (parameterSet, paramIndex) => {
          try {
            // Replace parameters in URL and selectors
            const processedUrl = this.parameterGenerator.replaceParametersInString(monitoring.url, parameterSet);
            const processedSelectors = this.parameterGenerator.replaceParametersInObject(selectors, parameterSet);

            console.log(`🔄 Iteration ${batchIndex * batchSize + paramIndex + 1}: URL=${processedUrl}, params=${JSON.stringify(parameterSet)}`);

            const result = await workflowService.extractData(
              processedUrl,
              processedSelectors,
              this.context.authHeaders
            );

            if (!result.success) {
              throw new Error(result.error || 'Failed to extract data');
            }
            
            const extractedData = result.result?.extracted_data || [];

            return {
              success: true,
              data: extractedData,
              parameters: parameterSet,
              url: processedUrl
            };
          } catch (error: any) {
            console.error(`🚨 Iteration ${batchIndex * batchSize + paramIndex + 1} failed:`, error);
            
            if (monitoring.loopConfig.stopOnError) {
              throw error;
            }
            
            return {
              success: false,
              error: error.message || 'Unknown error',
              parameters: parameterSet,
              url: this.parameterGenerator.replaceParametersInString(monitoring.url, parameterSet)
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches if configured
        if (batchIndex < batches.length - 1 && monitoring.loopConfig.delayBetweenRequests > 0) {
          console.log(`⏱️ Waiting ${monitoring.loopConfig.delayBetweenRequests}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, monitoring.loopConfig.delayBetweenRequests));
        }
      }

      // Aggregate results
      const aggregatedResults = this.aggregateLoopResults(results, monitoring.loopConfig);
      
      console.log(`✅ WebSource loop execution completed: ${results.length}/${parameterCombinations.length} iterations in ${Date.now() - startTime}ms`);

      // Update node execution status
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes/${nodeExecutionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          status: 'completed',
          output_data: aggregatedResults.data,
          completed_at: new Date().toISOString()
        })
      });

      return aggregatedResults.data;
    } catch (error: any) {
      console.error('🚨 WebSource loop execution failed:', error);
      
      // Note: Node execution status updates temporarily disabled due to API method not supported
      // TODO: Implement proper execution tracking endpoint for errors
      // await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes/${nodeExecutionId}`, {
      //   method: 'PATCH',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...this.context.authHeaders
      //   },
      //   body: JSON.stringify({
      //     status: 'failed',
      //     error_message: error.message || 'Unknown error',
      //     completed_at: new Date().toISOString()
      //   })
      // });

      throw error;
    }
  }

  /**
   * Process selectors for API call
   */
  // Removed processSelectors method - now sending raw config directly to backend

  /**
   * Aggregate loop execution results
   */
  private aggregateLoopResults(results: any[], loopConfig: any): { data: any } {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return { data: [] };
    }

    // For webSource, we need to return just the data array, not the wrapper object
    let finalData;
    
    if (loopConfig.aggregationMode === 'merge') {
      // For merge mode with webSource data, we need special handling for named tables
      const allDataArrays = successfulResults.map(r => r.data);
      console.log(`🔄 Merge mode: Processing ${allDataArrays.length} data arrays`);
      
      // Check if all results have the same structure (array with single object containing named tables)
      if (allDataArrays.every(arr => Array.isArray(arr) && arr.length === 1 && typeof arr[0] === 'object')) {
        const mergedTables: any = {};
        
        for (const dataArray of allDataArrays) {
          const dataObject = dataArray[0];
          for (const [tableName, tableData] of Object.entries(dataObject)) {
            if (!mergedTables[tableName]) {
              mergedTables[tableName] = [];
            }
            if (Array.isArray(tableData)) {
              mergedTables[tableName].push(...tableData);
            }
          }
        }
        
        finalData = [mergedTables];
        console.log(`🔗 Merge mode: Combined data into ${Object.keys(mergedTables).length} table(s)`);
      } else {
        // Fallback: just concatenate all data
        finalData = allDataArrays.flat();
        console.log(`🔗 Merge mode fallback: Flattened ${allDataArrays.length} arrays`);
      }
    } else {
      // Append mode: extract and flatten the data arrays
      finalData = successfulResults.map(r => r.data).flat();
      console.log(`📎 Append mode: Keeping ${finalData.length} separate results`);
    }
    
    console.log(`🎯 Final webSource data:`, {
      mode: loopConfig.aggregationMode,
      itemCount: Array.isArray(finalData) ? finalData.length : 'not array',
      sample: finalData?.[0]
    });

    return { data: finalData };
  }

  /**
   * Determine actual output data type for webSource nodes based on configuration
   */
  getDataType(nodeData: WorkflowNodeData): DataType {
    // Check monitoring config if present (this is where the actual config is stored)
    const monitoringConfig = nodeData.monitoring || nodeData;
    
    // Check if it's configured for table/structured output
    const selectors = monitoringConfig?.selectors || nodeData?.selectors;
    
    if (selectors?.some((s: any) => s.type === 'table' || s.type === 'repeating')) {
      console.log(`🔍 WebSource detected as STRUCTURED_DATA (table/repeating mode)`);
      return DataType.STRUCTURED_DATA;
    }
    
    // Check if it's configured and has multiple selectors (structured format)
    if (selectors?.length > 1) {
      console.log(`🔍 WebSource detected as STRUCTURED_DATA (multiple selectors)`);
      return DataType.STRUCTURED_DATA;
    }
    
    // Single text-based selectors output text data
    if (selectors?.length === 1) {
      const selector = selectors[0];
      if (selector.attribute === 'textContent' || selector.attribute === 'innerText') {
        console.log(`🔍 WebSource detected as TEXT_DATA (single text selector)`);
        return DataType.TEXT_DATA;
      }
    }
    
    // Check if configured
    if (selectors?.length > 0) {
      console.log(`🔍 WebSource detected as STRUCTURED_DATA (configured selectors)`);
      return DataType.STRUCTURED_DATA; // If configured, assume structured output
    }
    
    // Default to raw data if not specifically configured
    console.log(`🔍 WebSource detected as RAW_DATA (default/unconfigured)`);
    return DataType.RAW_DATA;
  }
}