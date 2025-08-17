/**
 * Embed Widget Page Component
 * 
 * Minimal widget page for embedding - shows single widget, no navigation
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '../providers/DashboardProvider';
import { apiService } from '../services/api';
import WidgetContainer from '../components/grid/WidgetContainer';

const EmbedWidgetPage: React.FC = () => {
  const { widgetId } = useParams<{ widgetId?: string }>();
  const [searchParams] = useSearchParams();
  const { state, loadDashboard } = useDashboard();
  const [widget, setWidget] = useState<any>(null);
  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get embed parameters
  const token = searchParams.get('token');
  const theme = searchParams.get('theme') || 'light';
  const refresh = searchParams.get('refresh');
  
  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'dark' ? 'dark' : '';
  }, [theme]);

  // Find which dashboard contains this widget
  useEffect(() => {
    const findWidgetDashboard = async () => {
      if (!widgetId) return;
      
      try {
        setLoading(true);
        
        // Use embed token for authentication
        const headers = token ? { 'X-Embed-Token': token } : {};
        
        // Get widget data from embed endpoint
        const response = await fetch(`/api/v1/embed/widget/${widgetId}/data?token=${token}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Set the widget data directly from the embed response
            setWidget(data.data);
            if (data.data.dashboard_id) {
              setDashboardId(data.data.dashboard_id.toString());
            }
          } else {
            console.error('Widget data missing from embed response:', data);
            setError('Failed to load widget data');
          }
        } else {
          console.error('Failed to fetch widget data:', response.status, response.statusText);
          setError('Failed to load widget data');
        }
      } catch (err) {
        console.error('Failed to find widget dashboard:', err);
        setError('Failed to load widget information');
      } finally {
        setLoading(false);
      }
    };

    findWidgetDashboard();
  }, [widgetId, token]);

  // For widget embeds, we don't need to load the full dashboard
  // The widget data from the embed endpoint contains everything we need

  // Widget is set directly from the embed data response

  // Auto-refresh functionality
  useEffect(() => {
    if (refresh && parseInt(refresh) > 0 && dashboardId) {
      const interval = setInterval(() => {
        loadDashboard(dashboardId);
      }, parseInt(refresh) * 1000);
      
      return () => clearInterval(interval);
    }
  }, [refresh, dashboardId, loadDashboard]);

  // Loading state
  if (loading || state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4" />
          <p className="text-text-secondary">Loading widget...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="p-6 bg-surface border border-border-subtle rounded-xl">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <div className="font-medium text-text-primary mb-2">Error Loading Widget</div>
            <div className="text-sm text-text-secondary">{error || state.error}</div>
          </div>
        </div>
      </div>
    );
  }

  // No widget state
  if (!widget) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="text-text-muted">Widget not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ 
      margin: 0, 
      padding: '8px',
      overflow: 'hidden'
    }}>
      {/* Single Widget - Use WidgetContainer with proper dashboard ID */}
      <div style={{ width: '100%', height: 'calc(100vh - 16px)' }}>
        <WidgetContainer
          dashboardId={dashboardId || ''}
          widget={widget}
          isEditMode={false}
        />
      </div>
    </div>
  );
};

export default EmbedWidgetPage;