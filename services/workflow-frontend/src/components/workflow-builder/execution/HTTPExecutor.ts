import { ExecutionContext, NodeOutput, WorkflowNodeData } from './types';

export class HTTPExecutor {
  constructor(private context: ExecutionContext) {}

  /**
   * Execute HTTP request node (exact logic from old system)
   */
  async execute(nodeId: string, nodeData: WorkflowNodeData, inputs: NodeOutput[]): Promise<any> {
    const config = nodeData.httpRequest;
    console.log('🌐 Starting HTTP request execution', { nodeId, url: config?.url });
    
    if (!config) {
      throw new Error('HTTP request not configured');
    }

    if (!config.url?.trim()) {
      throw new Error('URL is required for HTTP Request');
    }

    const startTime = Date.now();
    
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
          node_type: 'httpRequest',
          method: config.method || 'GET',
          url: config.url,
          auth_type: config.authentication?.type || 'none'
        })
      });

      if (!nodeExecutionResponse.ok) {
        throw new Error('Failed to create node execution record');
      }

      const nodeExecutionData = await nodeExecutionResponse.json();
      const nodeExecutionId = nodeExecutionData.node_execution?.id;
      
      console.log(`✅ Created HTTP request execution tracking: workflow=${executionId}, node=${nodeExecutionId}`);

      // Apply input variable substitutions to URL, headers, and body (exact logic from old system)
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

      // Build authentication headers (exact logic from old system)
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
      if (['POST', 'PUT', 'PATCH'].includes((config.method || 'GET').toUpperCase()) && processedBody) {
        if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
          finalHeaders['Content-Type'] = 'application/json';
        }
      }

      console.log('🌐 HTTP Request execution:', {
        method: config.method || 'GET',
        url: finalUrl,
        headers: Object.keys(finalHeaders),
        hasBody: !!processedBody
      });

      // Make HTTP request via backend (exact logic from old system)
      const requestPayload: any = {
        url: finalUrl,
        method: (config.method || 'GET').toUpperCase(),
        headers: finalHeaders,
        timeout: config.timeout || 30000
      };

      // Add body for methods that support it
      if (['POST', 'PUT', 'PATCH'].includes((config.method || 'GET').toUpperCase()) && processedBody) {
        if (typeof processedBody === 'string') {
          requestPayload.data = processedBody;
        } else {
          requestPayload.data = JSON.stringify(processedBody);
        }
      }

      console.log('🌐 Making HTTP request via backend proxy');
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/proxy/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.context.authHeaders
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Backend proxy request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'HTTP request failed');
      }

      const responseTime = Date.now() - startTime;
      const responseData = result.data;
      const responseHeaders = result.headers || {};
      const statusCode = result.status_code || 200;
      const responseSize = JSON.stringify(responseData).length;

      console.log('🌐 HTTP request completed successfully:', {
        status: statusCode,
        responseTime,
        responseSize
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
          output_data: responseData,
          status_code: statusCode,
          response_time: responseTime,
          response_size: responseSize,
          response_headers: responseHeaders,
          completed_at: new Date().toISOString()
        })
      });

      // Return structured response data (exact format from old system)
      return {
        status: statusCode,
        statusText: result.statusText || 'OK',
        data: responseData,
        headers: responseHeaders,
        url: finalUrl,
        method: (config.method || 'GET').toUpperCase(),
        success: true,
        responseTime,
        responseSize
      };

    } catch (error: any) {
      console.error('🚨 HTTP request execution failed:', error);
      
      if (error.name === 'AbortError') {
        throw new Error(`HTTP Request timeout after ${config.timeout || 30000}ms`);
      }
      
      throw new Error(`HTTP Request failed: ${error.message || 'Unknown error'}`);
    }
  }

}