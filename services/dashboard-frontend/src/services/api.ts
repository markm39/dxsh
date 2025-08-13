/**
 * API Service
 * 
 * Handles all communication with the Workflow Engine backend
 */

import type { Dashboard, DashboardWidget } from '../shared/types';

// API Response wrapper interface
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:5000';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authHeaders: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - clear token and redirect to login
      if (response.status === 401) {
        // Clear auth tokens
        localStorage.removeItem('workflow-token');
        localStorage.removeItem('workflow_auth_user');
        
        // Redirect to login page
        window.location.href = '/login';
        
        throw new Error('Authentication expired. Please log in again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Dashboard operations
  async getDashboard(id: string, authHeaders: Record<string, string> = {}): Promise<Dashboard> {
    const response = await this.request<Dashboard>(`/dashboards/${id}`, {}, authHeaders);
    return response.data!;
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>, authHeaders: Record<string, string> = {}): Promise<Dashboard> {
    const response = await this.request<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(dashboard),
    }, authHeaders);
    return response.data!;
  }

  async updateDashboard(id: string, updates: Partial<Dashboard>, authHeaders: Record<string, string> = {}): Promise<Dashboard> {
    const response = await this.request<Dashboard>(`/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, authHeaders);
    return response.data!;
  }

  async deleteDashboard(id: string, authHeaders: Record<string, string> = {}): Promise<void> {
    await this.request(`/dashboards/${id}`, {
      method: 'DELETE',
    }, authHeaders);
  }

  // Widget data operations
  async getWidgetData(dashboardId: string, widgetId: string, authHeaders: Record<string, string> = {}): Promise<any> {
    const response = await this.request(`/dashboards/${dashboardId}/widgets/${widgetId}/data`, {}, authHeaders);
    return response.data;
  }

  async getNodeOutput(nodeId: string, authHeaders: Record<string, string> = {}): Promise<any> {
    const response = await this.request(`/nodes/${nodeId}/output`, {}, authHeaders);
    return response.data;
  }

  async getLatestExecution(agentId: number, authHeaders: Record<string, string> = {}): Promise<any> {
    const response = await this.request(`/agents/${agentId}/latest-execution`, {}, authHeaders);
    return response.data;
  }

  // Health check
  async healthCheck(authHeaders: Record<string, string> = {}): Promise<boolean> {
    try {
      await this.request('/health', {}, authHeaders);
      return true;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();
export default apiService;