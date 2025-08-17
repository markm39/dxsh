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
import { EmbedProvider } from '../contexts/EmbedContext';

const EmbedDashboardPage: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  const [searchParams] = useSearchParams();
  const { state } = useDashboard();
  const [isLoadingEmbed, setIsLoadingEmbed] = useState(true);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  
  // Get embed parameters
  const token = searchParams.get('token');
  const theme = searchParams.get('theme') || 'light';
  const refresh = searchParams.get('refresh');
  
  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'dark' ? 'dark' : '';
  }, [theme]);

  // Load dashboard data using embed endpoint
  const loadEmbedDashboard = async () => {
    if (!dashboardId || !token) return;
    
    setIsLoadingEmbed(true);
    setEmbedError(null);
    
    try {
      const apiUrl = import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:8001';
      const response = await fetch(
        `${apiUrl}/api/v1/embed/dashboard/${dashboardId}/data?token=${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Please check your embed token.');
        } else if (response.status === 404) {
          throw new Error('Dashboard not found or invalid token.');
        } else {
          throw new Error(`Failed to load dashboard: ${response.statusText}`);
        }
      }

      const result = await response.json();
      setDashboardData(result.data);
    } catch (error) {
      console.error('Error loading embedded dashboard:', error);
      setEmbedError((error as Error).message);
    } finally {
      setIsLoadingEmbed(false);
    }
  };

  useEffect(() => {
    loadEmbedDashboard();
  }, [dashboardId, token]);

  // Auto-refresh functionality
  useEffect(() => {
    if (refresh && parseInt(refresh) > 0) {
      const interval = setInterval(() => {
        loadEmbedDashboard();
      }, parseInt(refresh) * 1000);
      
      return () => clearInterval(interval);
    }
  }, [refresh, dashboardId, token]);

  // Loading state
  if (isLoadingEmbed) {
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
  if (embedError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="p-6 bg-surface border border-border-subtle rounded-xl">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <div className="font-medium text-text-primary mb-2">Error Loading Dashboard</div>
            <div className="text-sm text-text-secondary">{embedError}</div>
          </div>
        </div>
      </div>
    );
  }

  // No dashboard state
  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="text-text-muted">Dashboard not found</div>
        </div>
      </div>
    );
  }

  return (
    <EmbedProvider token={token}>
      <div className="min-h-screen bg-background" style={{ margin: 0, padding: '16px' }}>
        {/* Optional dashboard title */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text-primary">{dashboardData.name}</h1>
          {dashboardData.description && (
            <p className="text-text-secondary mt-2">{dashboardData.description}</p>
          )}
        </div>

        {/* Dashboard Content - Reuse existing DashboardGrid component */}
        <DashboardGrid
          dashboardId={dashboardData.id}
          widgets={dashboardData.widgets || []}
          isEditMode={false}
        />
      </div>
    </EmbedProvider>
  );
};

export default EmbedDashboardPage;