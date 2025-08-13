/**
 * Dashboard Service API Client for Builder Service
 * 
 * Handles communication with the dashboard-service through API Gateway
 * Maintains all functionality while using microservices architecture
 */

// Use API Gateway as the single entry point for all microservices
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Helper to handle 401 errors
const handleAuthError = () => {
  // Clear auth token
  localStorage.removeItem('workflow-token');
  // Reload page to trigger auth check
  window.location.reload();
};

export interface Dashboard {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  display_settings: {
    showWidgetHeaders: boolean;
    showWidgetFooters: boolean;
    compactMode: boolean;
    theme: string;
  };
  created_at: string;
  updated_at: string;
  widgets: Widget[];
}

export interface Widget {
  id: number;
  dashboard_id: number;
  type: string;
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  showHeader: boolean;
  showFooter: boolean;
  dataSource?: {
    agentId: number;
    nodeId: string;
    refreshOnWorkflowComplete: boolean;
    refreshInterval?: number;
  };
  config: Record<string, any>;
  cachedData?: any;
  lastUpdated?: string;
  created_at: string;
  updated_at: string;
}

export const dashboardService = {
  /**
   * Get all dashboards for the current user
   */
  async getDashboards(authHeaders: Record<string, string>): Promise<Dashboard[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/dashboards`, {
        headers: authHeaders,
      });

      if (response.status === 401) {
        handleAuthError();
        return [];
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
      return [];
    } catch (error) {
      console.error('Failed to load dashboards:', error);
      return [];
    }
  },

  /**
   * Create a new dashboard
   */
  async createDashboard(
    name: string,
    description: string,
    authHeaders: Record<string, string>
  ): Promise<Dashboard | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/dashboards`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          display_settings: {
            showWidgetHeaders: true,
            showWidgetFooters: true,
            compactMode: false,
            theme: 'default'
          }
        }),
      });

      if (response.status === 401) {
        handleAuthError();
        return null;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      return null;
    }
  },

  /**
   * Get a specific dashboard by ID
   */
  async getDashboard(
    dashboardId: number,
    authHeaders: Record<string, string>
  ): Promise<Dashboard | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/dashboards/${dashboardId}`, {
        headers: authHeaders,
      });

      if (response.status === 401) {
        handleAuthError();
        return null;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      return null;
    }
  },

  /**
   * Create a widget in a dashboard
   */
  async createWidget(
    dashboardId: number,
    widgetData: {
      type: string;
      title: string;
      description?: string;
      position: { x: number; y: number; w: number; h: number };
      agent_id?: number;
      node_id?: string;
      config?: Record<string, any>;
    },
    authHeaders: Record<string, string>
  ): Promise<Widget | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/dashboards/${dashboardId}/widgets`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(widgetData),
      });

      if (response.status === 401) {
        handleAuthError();
        return null;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to create widget:', error);
      return null;
    }
  },

  /**
   * Get widget data (for display purposes)
   */
  async getWidgetData(
    widgetId: number,
    authHeaders: Record<string, string>
  ): Promise<any | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/widgets/${widgetId}`, {
        headers: authHeaders,
      });

      if (response.status === 401) {
        handleAuthError();
        return null;
      }

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get widget data:', error);
      return null;
    }
  },

  /**
   * Update a widget
   */
  async updateWidget(
    widgetId: number,
    updates: Partial<{
      title: string;
      description: string;
      position: { x: number; y: number; w: number; h: number };
      config: Record<string, any>;
    }>,
    authHeaders: Record<string, string>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/widgets/${widgetId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.status === 401) {
        handleAuthError();
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Failed to update widget:', error);
      return false;
    }
  },

  /**
   * Delete a widget
   */
  async deleteWidget(
    widgetId: number,
    authHeaders: Record<string, string>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/widgets/${widgetId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (response.status === 401) {
        handleAuthError();
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Failed to delete widget:', error);
      return false;
    }
  },

  /**
   * Delete a dashboard
   */
  async deleteDashboard(
    dashboardId: number,
    authHeaders: Record<string, string>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/dashboards/${dashboardId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (response.status === 401) {
        handleAuthError();
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      return false;
    }
  },
};