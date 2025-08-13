/**
 * Dashboard List Page Component
 * 
 * Landing page that shows all dashboards for the user
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Calendar, ExternalLink, Settings, Trash2, LogOut } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthHeaders, useAuth } from '../providers/AuthProvider';
import { apiService } from '../services/api';
import InlineEditableText from '../components/common/InlineEditableText';

interface Dashboard {
  id: number;
  name: string;
  description?: string;
  widgets: Array<{
    id: number;
    title: string;
    type: string;
  }>;
  created_at: string;
  updated_at: string;
}

const DashboardListPage: React.FC = () => {
  const authHeaders = useAuthHeaders();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all dashboards
  const { data: dashboards, isLoading, error } = useQuery<Dashboard[]>({
    queryKey: ['dashboards'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:5000'}/api/v1/dashboards`, {
        headers: authHeaders
      });
      
      // Handle 401 Unauthorized
      if (response.status === 401) {
        // Clear auth tokens
        localStorage.removeItem('workflow-token');
        localStorage.removeItem('workflow_auth_user');
        
        // Force logout
        logout();
        
        throw new Error('Authentication expired. Please log in again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboards');
      }
      
      const result = await response.json();
      return result.data;
    }
  });

  // Update dashboard mutation
  const updateMutation = useMutation({
    mutationFn: async ({ dashboardId, updates }: { dashboardId: number; updates: { name?: string; description?: string } }) => {
      const response = await fetch(`${import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:5000'}/api/v1/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update dashboard');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    }
  });

  // Delete dashboard mutation
  const deleteMutation = useMutation({
    mutationFn: async (dashboardId: number) => {
      const response = await fetch(`${import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:5000'}/api/v1/dashboards/${dashboardId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete dashboard');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    }
  });

  const handleUpdateName = (dashboardId: number, newName: string) => {
    updateMutation.mutate({
      dashboardId,
      updates: { name: newName }
    });
  };

  const handleUpdateDescription = (dashboardId: number, newDescription: string) => {
    updateMutation.mutate({
      dashboardId,
      updates: { description: newDescription }
    });
  };

  const handleDelete = async (dashboardId: number, dashboardName: string) => {
    if (window.confirm(`Are you sure you want to delete "${dashboardName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(dashboardId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4" />
          <p className="text-text-secondary">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's an authentication error
    const isAuthError = error instanceof Error && 
      (error.message.includes('Authentication expired') || error.message.includes('401'));

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="p-6 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm">
            <BarChart3 className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <div className="font-medium text-text-primary mb-2">
              {isAuthError ? 'Session Expired' : 'Error Loading Dashboards'}
            </div>
            <div className="text-sm text-text-secondary mb-4">
              {error instanceof Error ? error.message : 'Failed to load dashboards'}
            </div>
            <div className="flex gap-2 justify-center">
              {isAuthError ? (
                <Link
                  to="/login"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors"
                >
                  Go to Login
                </Link>
              ) : (
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border-subtle px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Dashboards</h1>
              <p className="text-text-secondary mt-1">
                Manage and view your data visualization dashboards
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/editor/new"
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Dashboard
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors border border-border-subtle"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {!dashboards || dashboards.length === 0 ? (
            // Empty state
            <div className="text-center py-16">
              <div className="p-8 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm max-w-md mx-auto">
                <BarChart3 className="h-12 w-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  No Dashboards Yet
                </h3>
                <p className="text-text-secondary mb-6">
                  Get started by creating your first dashboard to visualize your workflow data.
                </p>
                <Link
                  to="/editor/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Dashboard
                </Link>
              </div>
            </div>
          ) : (
            // Dashboard grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboards.map((dashboard) => (
                <div
                  key={dashboard.id}
                  className="bg-surface border border-border-subtle rounded-xl shadow-lg backdrop-blur-sm overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Dashboard Card Header */}
                  <div className="p-6 border-b border-border-subtle">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <InlineEditableText
                          value={dashboard.name}
                          onSave={(newName) => handleUpdateName(dashboard.id, newName)}
                          placeholder="Dashboard Name"
                          className="text-lg font-semibold text-text-primary"
                          maxLength={100}
                          disabled={updateMutation.isPending}
                        />
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <Link
                          to={`/dashboard/${dashboard.id}`}
                          className="p-1.5 hover:bg-surface-secondary rounded-lg transition-colors"
                          title="View Dashboard"
                        >
                          <ExternalLink className="h-4 w-4 text-text-muted" />
                        </Link>
                        <Link
                          to={`/editor/${dashboard.id}`}
                          className="p-1.5 hover:bg-surface-secondary rounded-lg transition-colors"
                          title="Edit Dashboard"
                        >
                          <Settings className="h-4 w-4 text-text-muted" />
                        </Link>
                        <button
                          onClick={() => handleDelete(dashboard.id, dashboard.name)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Dashboard"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <InlineEditableText
                        value={dashboard.description || ''}
                        onSave={(newDescription) => handleUpdateDescription(dashboard.id, newDescription)}
                        placeholder="Add a description..."
                        className="text-sm text-text-secondary"
                        maxLength={200}
                        disabled={updateMutation.isPending}
                      />
                    </div>

                    {/* Widgets count */}
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <BarChart3 className="h-4 w-4" />
                      <span>
                        {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Dashboard Card Footer */}
                  <div className="p-4 bg-surface-secondary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Calendar className="h-3 w-3" />
                        <span>Updated {formatDate(dashboard.updated_at)}</span>
                      </div>
                      <Link
                        to={`/dashboard/${dashboard.id}`}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors font-medium"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardListPage;