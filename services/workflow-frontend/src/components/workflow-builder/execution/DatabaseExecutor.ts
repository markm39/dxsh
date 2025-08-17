import { ExecutionContext, NodeOutput, WorkflowNodeData } from './types';

export class DatabaseExecutor {
  constructor(private context: ExecutionContext) {}

  /**
   * Execute PostgreSQL node (exact logic from old system)
   */
  async executePostgres(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const config = nodeData.postgres;
    console.log('🐘 Starting PostgreSQL execution', { nodeId, config });
    
    if (!config) {
      throw new Error('PostgreSQL not configured');
    }

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
          node_type: 'postgres',
          postgres_host: config.host,
          postgres_database: config.database,
          postgres_query: config.query
        })
      });

      if (!nodeExecutionResponse.ok) {
        throw new Error('Failed to create node execution record');
      }

      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution?.id;

      console.log(`✅ Created PostgreSQL execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Handle source mode (query execution) - exact logic from old system
      if (config.operationMode === 'source') {
        if (!config.query?.trim()) {
          throw new Error('Source query is required for PostgreSQL source mode');
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/postgres/query`, {
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

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `PostgreSQL query failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'PostgreSQL query failed');
        }

        console.log('🐘 PostgreSQL query completed successfully:', {
          rowCount: result.data?.length || 0
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
            output_data: result.data,
            completed_at: new Date().toISOString()
          })
        });

        return result.data;
      }
      
      // Handle sink mode (data insertion) - exact logic from old system
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
              console.log('🗂️ Multi-table structure detected:', keys);
              
              // Use the first table or a specified table
              const selectedTable = keys[0];
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

          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/postgres/create-table-and-insert`, {
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

          // Update node execution with results
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...this.context.authHeaders
            },
            body: JSON.stringify({
              status: 'completed',
              output_data: {
                success: true,
                table_created: true,
                table_name: result.table_name,
                rows_affected: result.rows_affected
              },
              completed_at: new Date().toISOString()
            })
          });

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

          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/postgres/insert`, {
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

          // Update node execution with results
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/executions/nodes/${nodeExecutionId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...this.context.authHeaders
            },
            body: JSON.stringify({
              status: 'completed',
              output_data: {
                success: true,
                rows_affected: result.rows_affected
              },
              completed_at: new Date().toISOString()
            })
          });

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
    } catch (error: any) {
      console.error('🚨 PostgreSQL execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute file node
   */
  async executeFileNode(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const config = nodeData.fileNode;
    console.log('📁 Starting file node execution', { nodeId, operationMode: config?.operationMode });
    
    if (!config) {
      throw new Error('File node not configured');
    }

    try {
      if (config.operationMode === 'source') {
        // Load file mode - source data from file
        return await this.handleFileSource(nodeId, config);
      } else if (config.operationMode === 'sink') {
        // Save file mode - write data to file
        return await this.handleFileSink(config, inputs);
      } else {
        throw new Error(`Unsupported file operation mode: ${config.operationMode}`);
      }
    } catch (error: any) {
      console.error('🚨 File node execution failed:', error);
      throw error;
    }
  }

  /**
   * Handle file source (load from file)
   */
  private async handleFileSource(nodeId: string, config: any): Promise<any> {
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

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/file-node/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `File load failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'File loading failed');
    }

    console.log('📁 File load completed successfully:', {
      rowCount: result.data?.length || 0
    });
    
    return result.data;
  }

  /**
   * Handle file sink (save to file)
   */
  private async handleFileSink(config: any, inputs: NodeOutput[]): Promise<any> {
    if (!config.filePath) {
      throw new Error('No file path specified for sink operation');
    }

    if (inputs.length === 0) {
      throw new Error('No input data to save to file');
    }

    const dataToWrite = inputs[0].data;

    const requestBody = {
      ...config,
      filePath: config.filePath,
      fileName: config.fileName,
      fileType: config.fileType,
      operationMode: 'sink',
      data: dataToWrite,
      format: config.format || 'json',
      encoding: config.encoding || 'utf-8',
      mode: config.mode || 'overwrite'
    };

    console.log('🔄 File save request body:', requestBody);

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/file-node/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.context.authHeaders
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `File save failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📁 File save completed successfully');
    
    return result;
  }
}