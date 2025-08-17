import { ExecutionContext, NodeOutput, WorkflowNodeData } from './types';

export class DataProcessingExecutor {
  constructor(private context: ExecutionContext) {}

  /**
   * Execute data structuring node
   */
  async executeDataStructuring(nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const { structuringConfig } = nodeData;
    
    if (!structuringConfig) {
      throw new Error('Data structuring not configured');
    }

    // For now, return the input data as-is
    // This is a placeholder for future data structuring logic
    return inputs.length > 0 ? inputs[0].data : [];
  }

  /**
   * Execute AI processor node (exact logic from old system)
   */
  async executeAIProcessor(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    console.log(' Executing AI Processor node:', nodeId);
    
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
    console.log(' AI Processor input data:', {
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
      console.log(' Request payload:', requestPayload);
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
      
      console.log(` Created AI processor node execution record: ${nodeExecutionId}`);
      
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
      
      console.log(' AI processing completed successfully:', {
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
      console.error(' AI Processor execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute linear regression node (exact logic from old system)
   */
  async executeLinearRegression(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    if (inputs.length === 0) {
      throw new Error('Linear regression requires input data');
    }

    // Get the input data from the previous node (exact logic from old system)
    const rawInputData = inputs[0].data;
    console.log(' RAW INPUT DATA for linear regression:', {
      type: typeof rawInputData,
      isArray: Array.isArray(rawInputData),
      length: Array.isArray(rawInputData) ? rawInputData.length : 'N/A',
      sample: Array.isArray(rawInputData) ? rawInputData.slice(0, 2) : rawInputData,
      fullStructure: rawInputData
    });

    // Extract table data from webSource results (exact logic from old system)
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
                console.log(` Found table data in execution for key "${key}":`, value);
                flattenedData.push(...value);
              }
            }
          }
        }
        if (flattenedData.length > 0) {
          console.log(' Using flattened table data for execution:', flattenedData);
          inputData = flattenedData;
        }
      }
    } else if (typeof rawInputData === 'object' && rawInputData !== null) {
      // Check if the result object contains table data
      for (const [key, value] of Object.entries(rawInputData)) {
        if (Array.isArray(value) && value.length > 0 && 
            typeof value[0] === 'object' && 
            !key.startsWith('_')) {
          console.log(` Found table data in execution for key "${key}":`, value);
          inputData = value;
          break;
        }
      }
    }

    console.log(' PROCESSED INPUT DATA for linear regression:', {
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

    console.log(' Linear regression configuration:', {
      features,
      target,
      modelName,
      config
    });

    try {
      // Create execution tracking (exact logic from old system)
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

      console.log(` Created execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Call ML training API with exact payload from old system
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

      console.log(' Linear regression training completed:', {
        modelId: result.model.id,
        metrics: result.model.metrics,
        features: result.model.features,
        target: result.model.target
      });

      // Return exact format expected by dashboard (from old system)
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
      console.error(' Linear regression training failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Linear regression training failed: ${errorMessage}`);
    }
  }

  /**
   * Execute random forest node (exact logic from old system)
   */
  async executeRandomForest(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    if (inputs.length === 0) {
      throw new Error('Random Forest requires input data');
    }

    // Get the input data from the previous node (exact logic from old system)
    const rawInputData = inputs[0].data;
    console.log(' RAW INPUT DATA for random forest:', {
      type: typeof rawInputData,
      isArray: Array.isArray(rawInputData),
      length: Array.isArray(rawInputData) ? rawInputData.length : 'N/A',
      sample: Array.isArray(rawInputData) ? rawInputData.slice(0, 2) : rawInputData,
      fullStructure: rawInputData
    });

    // Extract table data from webSource results (exact logic from old system)
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
                console.log(` Found table data in execution for key "${key}":`, value);
                flattenedData.push(...value);
              }
            }
          }
        }
        if (flattenedData.length > 0) {
          console.log(' Using flattened table data for execution:', flattenedData);
          inputData = flattenedData;
        }
      }
    } else if (typeof rawInputData === 'object' && rawInputData !== null) {
      // Check if the result object contains table data
      for (const [key, value] of Object.entries(rawInputData)) {
        if (Array.isArray(value) && value.length > 0 && 
            typeof value[0] === 'object' && 
            !key.startsWith('_')) {
          console.log(` Found table data in execution for key "${key}":`, value);
          inputData = value;
          break;
        }
      }
    }

    console.log(' PROCESSED INPUT DATA for random forest:', {
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

    console.log(' Random Forest configuration:', {
      features,
      target,
      modelName,
      config
    });

    try {
      // Create execution tracking (exact logic from old system)
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

      console.log(` Created execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Call ML training API with exact payload from old system
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

      console.log(' Random Forest training completed:', {
        modelId: result.model.id,
        metrics: result.model.metrics,
        features: result.model.features,
        target: result.model.target,
        feature_importance: result.model.model_metadata?.feature_importance
      });

      // Return exact format expected by dashboard (from old system)
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
      console.error(' Random Forest training failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Random Forest training failed: ${errorMessage}`);
    }
  }

  /**
   * Execute chart generator node (exact logic from old system)
   */
  async executeChartGenerator(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    console.log(' Executing Chart Generator node:', nodeId);
    
    if (inputs.length === 0) {
      throw new Error('Chart generator requires input data');
    }

    // Get the input data from the previous node
    const rawInputData = inputs[0].data;
    console.log(' Chart Generator input data:', {
      type: typeof rawInputData,
      isArray: Array.isArray(rawInputData),
      length: Array.isArray(rawInputData) ? rawInputData.length : 'N/A',
      sample: Array.isArray(rawInputData) ? rawInputData.slice(0, 2) : rawInputData
    });

    // Extract table data from webSource results (same logic as ML nodes)
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
                console.log(` Found table data in execution for key "${key}":`, value);
                flattenedData.push(...value);
              }
            }
          }
        }
        if (flattenedData.length > 0) {
          console.log(' Using flattened table data for chart generation:', flattenedData);
          inputData = flattenedData;
        }
      }
    } else if (typeof rawInputData === 'object' && rawInputData !== null) {
      // Check if the result object contains table data
      for (const [key, value] of Object.entries(rawInputData)) {
        if (Array.isArray(value) && value.length > 0 && 
            typeof value[0] === 'object' && 
            !key.startsWith('_')) {
          console.log(` Found table data in execution for key "${key}":`, value);
          inputData = value;
          break;
        }
      }
    }

    console.log(' PROCESSED INPUT DATA for chart generation:', {
      type: typeof inputData,
      isArray: Array.isArray(inputData),
      length: Array.isArray(inputData) ? inputData.length : 'N/A',
      sample: Array.isArray(inputData) ? inputData.slice(0, 2) : inputData
    });

    try {
      // Create execution tracking (exact logic from old system)
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
      const executionId = executionData.execution?.id;

      // Create node execution record
      const nodeExecutionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/${executionId}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          node_id: nodeId,
          node_type: 'chartGenerator',
          input_config: {
            data_type: typeof inputData,
            is_array: Array.isArray(inputData),
            length: Array.isArray(inputData) ? inputData.length : 1
          }
        })
      });

      if (!nodeExecutionResponse.ok) {
        throw new Error('Failed to create node execution record');
      }

      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution?.id;

      console.log(` Created Chart Generator execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Simple chart generation logic (like the old system)
      const chartResult = {
        chartType: 'bar', // Default chart type
        data: inputData,
        title: 'Generated Chart',
        timestamp: new Date().toISOString(),
        dataPoints: Array.isArray(inputData) ? inputData.length : 1
      };

      console.log(' Chart generation completed successfully:', {
        chartType: chartResult.chartType,
        dataPoints: chartResult.dataPoints
      });

      // Update node execution with results
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify({
          status: 'completed',
          output_data: chartResult,
          completed_at: new Date().toISOString()
        })
      });

      return chartResult;

    } catch (error) {
      console.error(' Chart Generator execution failed:', error);
      throw error;
    }
  }

  /**
   * Prepare input data for AI processing
   */
  private prepareInputData(inputs: NodeOutput[]): any {
    if (inputs.length === 1) {
      return inputs[0].data;
    }
    
    // Multiple inputs - combine them
    return inputs.map(input => input.data);
  }

  /**
   * Extract table data from inputs for ML operations
   */
  private extractTableData(inputs: NodeOutput[]): any[] {
    const rawInputData = inputs.length > 0 ? inputs[0].data : [];
    
    console.log(' ML Input data analysis:', {
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
                console.log(` Found table data in key '${key}' with ${value.length} rows`);
                flattenedData.push(...value);
              }
            }
          }
        }
        
        if (flattenedData.length > 0) {
          console.log(` Extracted ${flattenedData.length} rows from table data`);
          inputData = flattenedData;
        }
      }
    }
    
    console.log(' Final ML input data:', {
      type: typeof inputData,
      isArray: Array.isArray(inputData),
      length: Array.isArray(inputData) ? inputData.length : 'N/A',
      sample: Array.isArray(inputData) ? inputData.slice(0, 2) : inputData
    });
    
    return Array.isArray(inputData) ? inputData : [inputData];
  }
}