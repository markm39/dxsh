/**
 * Dashboard Page Component
 * 
 * Main dashboard viewer page - displays functional dashboard with real data
 */

import React, { useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Settings, Maximize2, RefreshCw, AlertTriangle, LogOut, Home, Key } from 'lucide-react';
import { useDashboard } from '../providers/DashboardProvider';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth, useAuthHeaders } from '../providers/AuthProvider';
import DashboardGrid from '../components/grid/DashboardGrid';
import InlineEditableText from '../components/common/InlineEditableText';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';

const DashboardPage: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  const [searchParams] = useSearchParams();
  const { state, loadDashboard, refreshAllWidgets, updateDashboard } = useDashboard();
  const { user, logout } = useAuth();
  const authHeaders = useAuthHeaders();

  // Check if this is an embed view
  const isEmbed = searchParams.get('embed') === 'true' || searchParams.get('embed') === 'widget';
  const isWidgetEmbed = searchParams.get('embed') === 'widget';
  const embedWidgetId = searchParams.get('widgetId');

  // Health check to ensure backend is available
  const { data: isBackendHealthy } = useQuery({
    queryKey: ['backend-health'],
    queryFn: () => apiService.healthCheck(authHeaders),
    refetchInterval: 30000,
    retry: 1,
  });

  useEffect(() => {
    if (dashboardId) {
      loadDashboard(dashboardId);
    }
  }, [dashboardId, loadDashboard]);

  const handleRefreshAll = async () => {
    await refreshAllWidgets();
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const handleDashboardNameSave = (newName: string) => {
    if (state.currentDashboard) {
      updateDashboard(state.currentDashboard.id, { name: newName });
    }
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4" />
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="p-6 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <div className="font-medium text-text-primary mb-2">Dashboard Error</div>
            <div className="text-sm text-text-secondary mb-4">{state.error}</div>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <Link to="/" className="block px-3 py-1.5 bg-surface-secondary hover:bg-surface-secondary/70 text-text-primary text-sm rounded-lg transition-colors">
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Backend offline warning
  if (isBackendHealthy === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="p-6 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm">
            <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
            <div className="font-medium text-text-primary mb-2">Backend Unavailable</div>
            <div className="text-sm text-text-secondary mb-4">
              Cannot connect to the Dxsh backend. Please ensure it's running on{' '}
              <code className="bg-surface-secondary px-1 rounded text-text-primary">{state.settings.apiUrl}</code>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Welcome screen when no dashboard is loaded
  if (!state.currentDashboard) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with sign out */}
        <header className="bg-background border-b border-border-subtle px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">Dxsh Dashboards</h1>
              <p className="text-text-secondary text-sm">Dashboard Management</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors border border-border-subtle"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </header>

        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <div className="max-w-md w-full text-center">
            <div className="p-8 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm">
              <h1 className="text-3xl font-bold text-text-primary mb-4">
                Dxsh
              </h1>
              <p className="text-text-secondary mb-8">
                Create professional dashboards connected to your Dxsh data.
              </p>
              <div className="space-y-3">
                <Link 
                  to="/editor/new" 
                  className="block px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium"
                >
                  Create New Dashboard
                </Link>
              </div>
              
              {/* Demo dashboard link if available */}
              <div className="mt-8 pt-8 border-t border-border-subtle">
                <p className="text-sm text-text-muted mb-3">Try a demo dashboard:</p>
                <Link 
                  to="/dashboard/demo" 
                  className="px-3 py-1.5 bg-transparent hover:bg-surface-secondary/30 text-text-secondary rounded-lg transition-colors text-sm"
                >
                  View Demo Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Embed mode: show only the dashboard content
  if (isEmbed) {
    const widgetsToShow = isWidgetEmbed && embedWidgetId 
      ? state.currentDashboard.widgets.filter(w => w.id.toString() === embedWidgetId)
      : state.currentDashboard.widgets;

    return (
      <div className="min-h-screen bg-background" style={{ 
        margin: 0, 
        padding: isWidgetEmbed ? '8px' : '16px',
        overflow: 'hidden'
      }}>
        <DashboardGrid
          dashboardId={state.currentDashboard.id}
          widgets={widgetsToShow}
          isEditMode={false}
        />
      </div>
    );
  }

  // Normal mode: show full dashboard interface
  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <header className="bg-background border-b border-border-subtle px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <InlineEditableText
              value={state.currentDashboard.name}
              onSave={handleDashboardNameSave}
              placeholder="Dashboard Name"
              className="text-xl font-semibold text-text-primary"
              maxLength={100}
            />
            {state.currentDashboard.description && (
              <p className="text-sm text-text-secondary mt-1 truncate">
                {state.currentDashboard.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {/* Home */}
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors border border-border-subtle"
              title="All Dashboards"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm">Home</span>
            </Link>

            {/* Embed Tokens */}
            <Link
              to="/embed-tokens"
              className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors border border-border-subtle"
              title="Manage Embed Tokens"
            >
              <Key className="w-4 h-4" />
              <span className="text-sm">Embed</span>
            </Link>

            {/* Refresh all widgets */}
            <button
              onClick={handleRefreshAll}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-white text-sm font-medium border border-amber-500/50 hover:border-amber-400 transition-all duration-200 flex items-center gap-2 rounded-none relative overflow-hidden group before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-amber-500/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500"
              title="Refresh all widgets"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            
            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-white text-sm font-medium border border-indigo-500/50 hover:border-indigo-400 transition-all duration-200 flex items-center gap-2 rounded-none relative overflow-hidden group before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-indigo-500/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500"
              title="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </button>
            
            {/* Edit button */}
            <Link
              to={`/editor/${state.currentDashboard.id}`}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-white text-sm font-medium border border-lime-500/50 hover:border-lime-400 transition-all duration-200 flex items-center gap-2 rounded-none relative overflow-hidden group before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-lime-500/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500"
            >
              <Settings className="h-4 w-4" />
              Edit
            </Link>

            {/* Sign Out */}
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
      </header>

      {/* Dashboard Content */}
      <main className="p-6">
        <DashboardGrid
          dashboardId={state.currentDashboard.id}
          widgets={state.currentDashboard.widgets}
          isEditMode={false}
        />
      </main>

      {/* Footer with connection status */}
      <footer className="border-t border-border-subtle bg-surface px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm text-text-muted">
          <div className="flex items-center gap-4">
            <span>
              Connected to: {state.settings.apiUrl}
            </span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>{isBackendHealthy ? 'Online' : 'Offline'}</span>
            </div>
            {user?.email && (
              <span className="text-text-secondary">
                Signed in as: <span className="text-text-primary">{user.email}</span>
              </span>
            )}
          </div>
          <div>
            {state.currentDashboard.widgets.length} widget{state.currentDashboard.widgets.length !== 1 ? 's' : ''}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardPage;