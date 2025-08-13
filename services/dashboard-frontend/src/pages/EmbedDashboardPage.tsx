/**
 * Embed Dashboard Page Component
 * 
 * Minimal dashboard page for embedding - no navigation, authentication bypass
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '../providers/DashboardProvider';
import DashboardGrid from '../components/grid/DashboardGrid';

const EmbedDashboardPage: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  const [searchParams] = useSearchParams();
  const { state, loadDashboard } = useDashboard();
  
  // Get embed parameters
  const token = searchParams.get('token');
  const theme = searchParams.get('theme') || 'light';
  const refresh = searchParams.get('refresh');
  
  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'dark' ? 'dark' : '';
  }, [theme]);

  useEffect(() => {
    if (dashboardId) {
      loadDashboard(dashboardId);
    }
  }, [dashboardId, loadDashboard]);

  // Auto-refresh functionality
  useEffect(() => {
    if (refresh && parseInt(refresh) > 0) {
      const interval = setInterval(() => {
        if (dashboardId) {
          loadDashboard(dashboardId);
        }
      }, parseInt(refresh) * 1000);
      
      return () => clearInterval(interval);
    }
  }, [refresh, dashboardId, loadDashboard]);

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
          <div className="p-6 bg-surface border border-border-subtle rounded-xl">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <div className="font-medium text-text-primary mb-2">Error Loading Dashboard</div>
            <div className="text-sm text-text-secondary">{state.error}</div>
          </div>
        </div>
      </div>
    );
  }

  // No dashboard state
  if (!state.currentDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="text-text-muted">Dashboard not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ margin: 0, padding: '16px' }}>
      {/* Optional dashboard title */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-text-primary">{state.currentDashboard.name}</h1>
        {state.currentDashboard.description && (
          <p className="text-text-secondary mt-2">{state.currentDashboard.description}</p>
        )}
      </div>

      {/* Dashboard Content - Reuse existing DashboardGrid component */}
      <DashboardGrid
        dashboardId={state.currentDashboard.id}
        widgets={state.currentDashboard.widgets}
        isEditMode={false}
      />
    </div>
  );
};

export default EmbedDashboardPage;