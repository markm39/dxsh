/**
 * Widget Data Hook
 * 
 * Manages data fetching and caching for dashboard widgets
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { DashboardWidget } from '@shared/types';
import { apiService } from '../services/api';
import { useAuthHeaders } from '../providers/AuthProvider';
import { useEmbedToken } from '../contexts/EmbedContext';

interface UseWidgetDataOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export const useWidgetData = (
  dashboardId: string,
  widget: DashboardWidget,
  options: UseWidgetDataOptions = {}
) => {
  const queryClient = useQueryClient();
  const authHeaders = useAuthHeaders();
  const embedToken = useEmbedToken();

  const queryKey = ['widget-data', dashboardId, widget.id, widget.dataSource, embedToken];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('useWidgetData: Starting data fetch for widget:', {
        dashboardId,
        widgetId: widget.id,
        dataSource: widget.dataSource,
        isEmbed: !!embedToken
      });

      // If we have an embed token, use the embed endpoint
      if (embedToken) {
        try {
          console.log('useWidgetData: Using embed endpoint with token');
          const apiUrl = import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:8001';
          const response = await fetch(
            `${apiUrl}/api/v1/embed/widget/${widget.id}/data?token=${embedToken}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch widget data: ${response.statusText}`);
          }

          const result = await response.json();
          return result.data;
        } catch (error) {
          console.error('useWidgetData: Embed endpoint failed:', error);
          // For embeds, we only return cached data from the dashboard
          return widget.cachedData || null;
        }
      }

      // Original authenticated flow
      try {
        console.log('useWidgetData: Trying widget-specific endpoint...');
        const widgetData = await apiService.getWidgetData(dashboardId, widget.id, authHeaders);
        console.log('useWidgetData: Widget endpoint success:', widgetData);
        return widgetData;
      } catch (widgetError) {
        console.log('useWidgetData: Widget endpoint failed:', widgetError);
        
        // Fallback to node output if widget endpoint doesn't exist and dataSource is configured
        if (widget.dataSource?.nodeId) {
          try {
            console.log('useWidgetData: Trying node output fallback for nodeId:', widget.dataSource.nodeId);
            const nodeData = await apiService.getNodeOutput(widget.dataSource.nodeId, authHeaders);
            console.log('useWidgetData: Node output success:', nodeData);
            return nodeData;
          } catch (nodeError) {
            console.error('useWidgetData: Node output fallback failed:', nodeError);
            return null;
          }
        }
        
        console.log('useWidgetData: No dataSource.nodeId configured, returning null');
        // Return empty data if no data source is configured
        return null;
      }
    },
    enabled: options.enabled !== false,
    refetchInterval: options.refetchInterval || widget.dataSource?.refreshInterval || 30000,
    staleTime: 5000, // Data is fresh for 5 seconds
    retry: 2,
  });

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const setData = useCallback((data: any) => {
    queryClient.setQueryData(queryKey, data);
  }, [queryClient, queryKey]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
    isFetching: query.isFetching,
    refreshData,
    setData,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
  };
};