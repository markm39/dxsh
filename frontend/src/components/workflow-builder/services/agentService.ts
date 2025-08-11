import { Agent } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper to handle 401 errors
const handleAuthError = () => {
  // Clear auth token
  localStorage.removeItem('workflow-token');
  // Reload page to trigger auth check
  window.location.reload();
};

export const agentService = {
  async loadAgents(authHeaders: Record<string, string>): Promise<Agent[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/agents`, {
      headers: authHeaders,
    });
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      handleAuthError();
      return [];
    }
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.agents) {
        return data.agents;
      }
    }
    return [];
  },

  async updateAgent(
    agentId: number,
    updates: Partial<Agent>,
    authHeaders: Record<string, string>
  ): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/api/v1/agents/${agentId}`, {
      method: "PUT",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (response.status === 401) {
      handleAuthError();
      return false;
    }

    return response.ok;
  },

  async deleteAgent(agentId: number, authHeaders: Record<string, string>): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/api/v1/agents/${agentId}`, {
      method: "DELETE",
      headers: authHeaders,
    });

    if (response.status === 401) {
      handleAuthError();
      return false;
    }

    return response.ok;
  },

  async createAgent(
    name: string,
    description: string,
    authHeaders: Record<string, string>
  ): Promise<Agent | null> {
    const response = await fetch(`${API_BASE_URL}/api/v1/agents`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        agentType: "workflow",
        naturalLanguageConfig: "AI-powered sports data monitoring and analysis",
      }),
    });

    if (response.status === 401) {
      handleAuthError();
      return null;
    }

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.agent;
      }
    }
    return null;
  },
};