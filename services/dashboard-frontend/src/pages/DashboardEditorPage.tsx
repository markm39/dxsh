/**
 * Dashboard Editor Page Component
 * 
 * Full-featured dashboard editor with widget management
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Save, 
  Eye, 
  Plus, 
  Grid, 
  Settings, 
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Activity,
  Type,
  Brain,
  LogOut,
  Home,
  Key
} from 'lucide-react';
import { useDashboard } from '../providers/DashboardProvider';
import { useAuth } from '../providers/AuthProvider';
import DashboardGrid from '../components/grid/DashboardGrid';
import DashboardSettingsModal from '../components/settings/DashboardSettingsModal';
import type { DashboardWidget } from '@shared/types';

const DashboardEditorPage: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  const { logout } = useAuth();
  const { 
    state, 
    loadDashboard, 
    saveDashboard, 
    addWidget, 
    setEditMode,
    refreshAllWidgets 
  } = useDashboard();
  
  const [showWidgetPalette, setShowWidgetPalette] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    setEditMode(true);
    
    if (dashboardId) {
      loadDashboard(dashboardId);
    }

    // Cleanup on unmount
    return () => {
      setEditMode(false);
    };
  }, [dashboardId, loadDashboard, setEditMode]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveDashboard();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWidget = async (type: DashboardWidget['type']) => {
    const newWidget: Omit<DashboardWidget, 'id'> = {
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Widget`,
      position: {
        x: 0,
        y: 0,
        w: type === 'metric' ? 3 : 6,
        h: type === 'metric' ? 3 : 4,
      },
      dataSource: undefined, // Will be configured later
      config: getDefaultConfig(type),
    };

    await addWidget(newWidget);
    setShowWidgetPalette(false);
  };

  const getDefaultConfig = (type: DashboardWidget['type']): any => {
    switch (type) {
      case 'chart':
        return {
          chartType: 'line' as const,
          xAxis: 'date',
          yAxis: 'value',
          showLegend: true,
          showGrid: true,
          showTooltip: true,
        };
      case 'metric':
        return {
          valueKey: 'total',
          format: 'number' as const,
          precision: 0,
          showTrend: true,
        };
      case 'text':
        return {
          content: '',
          format: 'markdown' as const,
          fontSize: 14,
          fontWeight: 'normal' as const,
          textAlign: 'left' as const,
          templateVariables: {},
        };
      case 'model':
        return {
          showPredictionForm: true,
          showPerformance: true,
          showVisualizations: true,
          showExplanation: false,
          defaultTab: 'predict' as const,
          compact: false,
        };
      default:
        return {};
    }
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4" />
          <p className="text-text-secondary">Loading dashboard editor...</p>
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
            <div className="font-medium text-text-primary mb-2">Editor Error</div>
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

  const currentDashboard = state.currentDashboard;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Editor Header */}
      <header className="bg-background border-b border-border-subtle px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-text-primary">
                {currentDashboard?.name || 'New Dashboard'}
              </h1>
              <span className="px-3 py-1 bg-slate-900 text-cyan-400 text-xs font-medium border border-cyan-500/50 uppercase tracking-wide">
                Edit Mode
              </span>
            </div>
            {currentDashboard?.description && (
              <p className="text-sm text-text-secondary mt-1">
                {currentDashboard.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {/* Add Widget */}
            <div className="relative">
              <button
                onClick={() => setShowWidgetPalette(!showWidgetPalette)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-white text-sm font-medium border border-cyan-500/50 hover:border-cyan-400 transition-all duration-200 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Widget
              </button>
              
              {/* Widget Palette Dropdown */}
              {showWidgetPalette && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-surface-elevated border border-border-accent rounded-lg shadow-widget-hover backdrop-blur-sm z-[9999]">
                  <div className="p-2">
                    <div className="text-xs font-medium text-text-muted px-2 py-1 uppercase tracking-wide">
                      Available Widgets
                    </div>
                    <button
                      onClick={() => handleAddWidget('chart')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-secondary/50 rounded-md transition-all duration-200 text-text-primary border border-transparent hover:border-border-subtle"
                    >
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">Chart Widget</div>
                        <div className="text-xs text-text-muted">Line, bar, pie charts</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAddWidget('metric')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-secondary/50 rounded-md transition-all duration-200 text-text-primary border border-transparent hover:border-border-subtle"
                    >
                      <Activity className="h-4 w-4 text-green-400" />
                      <div>
                        <div className="font-medium">Metric Widget</div>
                        <div className="text-xs text-text-muted">KPIs and key metrics</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAddWidget('text')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-secondary/50 rounded-md transition-all duration-200 text-text-primary border border-transparent hover:border-border-subtle"
                    >
                      <Type className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium">Text Widget</div>
                        <div className="text-xs text-text-muted">Markdown, HTML, or plain text</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAddWidget('model')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-secondary/50 rounded-md transition-all duration-200 text-text-primary border border-transparent hover:border-border-subtle"
                    >
                      <Brain className="h-4 w-4 text-purple-400" />
                      <div>
                        <div className="font-medium">Model Widget</div>
                        <div className="text-xs text-text-muted">ML model predictions and analysis</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh All */}
            <button
              onClick={refreshAllWidgets}
              className="p-2 rounded-md hover:bg-surface-secondary/50 transition-all duration-200 border border-transparent hover:border-border-subtle"
              title="Refresh all widgets"
            >
              <RefreshCw className="h-4 w-4 text-text-muted" />
            </button>

            {/* Dashboard Settings */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
              title="Dashboard settings"
            >
              <Settings className="h-4 w-4 text-text-muted" />
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white hover:text-white text-sm font-medium border border-emerald-500/50 hover:border-emerald-400 transition-all duration-200 flex items-center gap-2 disabled:hover:bg-slate-900"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </button>

            {/* Preview */}
            {currentDashboard && (
              <Link
                to={`/dashboard/${currentDashboard.id}`}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-white text-sm font-medium border border-violet-500/50 hover:border-violet-400 transition-all duration-200 flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Link>
            )}

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

      {/* Editor Content */}
      <main className="flex-1 p-6 overflow-auto">
        {currentDashboard ? (
          <DashboardGrid
            dashboardId={currentDashboard.id}
            widgets={currentDashboard.widgets}
            isEditMode={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Grid className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Create Your Dashboard
              </h2>
              <p className="text-text-secondary mb-6">
                Start by adding widgets to visualize your workflow data.
              </p>
              <button
                onClick={() => setShowWidgetPalette(true)}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white hover:text-white font-medium border border-cyan-500/50 hover:border-cyan-400 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="h-5 w-5" />
                Add Your First Widget
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Editor Footer */}
      <footer className="border-t border-border-subtle bg-surface px-6 py-3 flex-shrink-0 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm text-text-muted">
          <div className="flex items-center gap-4">
            <span>Dashboard Editor</span>
            {state.selectedWidgetId && (
              <span>Selected: Widget {state.selectedWidgetId}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {currentDashboard && (
              <span>
                {currentDashboard.widgets.length} widget{currentDashboard.widgets.length !== 1 ? 's' : ''}
              </span>
            )}
            <span>Auto-save enabled</span>
          </div>
        </div>
      </footer>

      {/* Click outside to close palette */}
      {showWidgetPalette && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setShowWidgetPalette(false)}
        />
      )}

      {/* Dashboard Settings Modal */}
      <DashboardSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
};

export default DashboardEditorPage;