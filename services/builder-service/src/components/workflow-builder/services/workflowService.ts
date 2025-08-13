import { Node, Edge } from "reactflow";
import { ExecutionHistory } from "../types";

// Use API Gateway as the single entry point for all microservices
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Helper to handle 401 errors
const handleAuthError = () => {
  // Clear auth token
  localStorage.removeItem('workflow-token');
  // Reload page to trigger auth check
  window.location.reload();
};

export const workflowService = {
  async loadWorkflow(
    agentId: number,
    authHeaders: Record<string, string>
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const response = await fetch(
      `${API_BASE_URL}/v1/workflows/${agentId}`,
      {
        headers: authHeaders,
      }
    );
    
    if (response.status === 401) {
      handleAuthError();
      return { nodes: [], edges: [] };
    }
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.workflow) {
        return {
          nodes: data.workflow.nodes || [],
          edges: data.workflow.edges || [],
        };
      }
    }
    return { nodes: [], edges: [] };
  },

  async saveWorkflow(
    agentId: number,
    nodes: Node[],
    edges: Edge[],
    authHeaders: Record<string, string>
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/workflows/${agentId}`,
        {
          method: "PUT",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nodes,
            edges,
          }),
        }
      );
      
      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401) {
          handleAuthError();
          return false;
        }
        
        const errorData = await response.json().catch(() => null);
        console.error("Workflow save failed:", response.status, errorData);
        
        // If it's a temporary error (like duplicate key), retry once after a short delay
        if (response.status === 500 && errorData?.error?.includes('duplicate key')) {
          console.log("Retrying workflow save after duplicate key error...");
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const retryResponse = await fetch(
            `${API_BASE_URL}/v1/workflows/${agentId}`,
            {
              method: "PUT",
              headers: {
                ...authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                nodes,
                edges,
              }),
            }
          );
          
          if (retryResponse.status === 401) {
            handleAuthError();
            return false;
          }
          
          return retryResponse.ok;
        }
      }
      
      return response.ok;
    } catch (error) {
      console.error("Failed to save workflow:", error);
      return false;
    }
  },

  async loadExecutionHistory(
    agentId: number,
    authHeaders: Record<string, string>
  ): Promise<ExecutionHistory[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/executions?agent_id=${agentId}`,
        {
          headers: authHeaders,
        }
      );
      
      if (response.status === 401) {
        handleAuthError();
        return [];
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.executions) {
          return data.executions;
        }
      }
    } catch (error) {
      console.error("Failed to load execution history:", error);
    }
    return [];
  },

  async extractData(
    url: string,
    selectors: any[],
    authHeaders: Record<string, string>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/v1/nodes/web-source/extract`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        selectors,
      }),
    });

    if (response.status === 401) {
      handleAuthError();
      return { success: false, error: "Authentication expired" };
    }

    return await response.json();
  },
};