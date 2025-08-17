/**
 * Dashboard Provider
 * 
 * Manages dashboard state, configuration, and provides dashboard context
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { Dashboard, DashboardWidget, DashboardSettings } from '@shared/types';
import { useAuthHeaders } from './AuthProvider';

// Dashboard state interface
interface DashboardState {
  currentDashboard: Dashboard | null;
  isLoading: boolean;
  error: string | null;
  settings: DashboardSettings;
  widgets: Record<string, DashboardWidget>;
  widgetData: Record<string, any>;
  isEditMode: boolean;
  selectedWidgetId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  lastUpdated: Record<string, Date>;
}

// Dashboard actions
type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DASHBOARD'; payload: Dashboard }
  | { type: 'UPDATE_DASHBOARD'; payload: Partial<Dashboard> }
  | { type: 'SET_SETTINGS'; payload: Partial<DashboardSettings> }
  | { type: 'ADD_WIDGET'; payload: DashboardWidget }
  | { type: 'UPDATE_WIDGET'; payload: { id: string; updates: Partial<DashboardWidget> } }
  | { type: 'REMOVE_WIDGET'; payload: string }
  | { type: 'SET_WIDGET_DATA'; payload: { widgetId: string; data: any } }
  | { type: 'SET_EDIT_MODE'; payload: boolean }
  | { type: 'SET_SELECTED_WIDGET'; payload: string | null }
  | { type: 'SET_DRAGGING'; payload: boolean }
  | { type: 'SET_RESIZING'; payload: boolean }
  | { type: 'UPDATE_LAYOUT'; payload: { widgets: DashboardWidget[] } }
  | { type: 'RESET_DASHBOARD' };

// Default settings
const defaultSettings: DashboardSettings = {
  apiUrl: import.meta.env.VITE_WORKFLOW_API_URL || 'http://localhost:5000',
  apiKey: import.meta.env.VITE_WORKFLOW_API_KEY,
  maxConcurrentRequests: 5,
  requestTimeout: 30000,
  retryAttempts: 3,
  enableRealTimeUpdates: true,
  defaultRefreshInterval: 30000,
  showGridLines: true,
  enableDragDrop: true,
  compactLayout: false,
};

// Initial state
const initialState: DashboardState = {
  currentDashboard: null,
  isLoading: false,
  error: null,
  settings: defaultSettings,
  widgets: {},
  widgetData: {},
  isEditMode: false,
  selectedWidgetId: null,
  isDragging: false,
  isResizing: false,
  lastUpdated: {},
};

// Reducer function
const dashboardReducer = (state: DashboardState, action: DashboardAction): DashboardState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_DASHBOARD': {
      const dashboard = action.payload;
      const widgets: Record<string, DashboardWidget> = {};
      
      dashboard.widgets.forEach(widget => {
        widgets[widget.id] = widget;
      });

      return {
        ...state,
        currentDashboard: dashboard,
        widgets,
        isLoading: false,
        error: null,
      };
    }

    case 'UPDATE_DASHBOARD': {
      if (!state.currentDashboard) return state;
      
      const updatedDashboard = {
        ...state.currentDashboard,
        ...action.payload,
      };

      return {
        ...state,
        currentDashboard: updatedDashboard,
      };
    }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case 'ADD_WIDGET': {
      const widget = action.payload;
      return {
        ...state,
        widgets: { ...state.widgets, [widget.id]: widget },
        currentDashboard: state.currentDashboard ? {
          ...state.currentDashboard,
          widgets: [...state.currentDashboard.widgets, widget],
        } : null,
      };
    }

    case 'UPDATE_WIDGET': {
      const { id, updates } = action.payload;
      const updatedWidget = { ...state.widgets[id], ...updates };
      
      return {
        ...state,
        widgets: { ...state.widgets, [id]: updatedWidget },
        currentDashboard: state.currentDashboard ? {
          ...state.currentDashboard,
          widgets: state.currentDashboard.widgets.map(w => 
            w.id === id ? updatedWidget : w
          ),
        } : null,
      };
    }

    case 'REMOVE_WIDGET': {
      const widgetId = action.payload;
      const { [widgetId]: removed, ...remainingWidgets } = state.widgets;
      const { [widgetId]: removedData, ...remainingData } = state.widgetData;

      return {
        ...state,
        widgets: remainingWidgets,
        widgetData: remainingData,
        selectedWidgetId: state.selectedWidgetId === widgetId ? null : state.selectedWidgetId,
        currentDashboard: state.currentDashboard ? {
          ...state.currentDashboard,
          widgets: state.currentDashboard.widgets.filter(w => w.id !== widgetId),
        } : null,
      };
    }

    case 'SET_WIDGET_DATA':
      return {
        ...state,
        widgetData: {
          ...state.widgetData,
          [action.payload.widgetId]: action.payload.data,
        },
        lastUpdated: {
          ...state.lastUpdated,
          [action.payload.widgetId]: new Date(),
        },
      };

    case 'SET_EDIT_MODE':
      return {
        ...state,
        isEditMode: action.payload,
        selectedWidgetId: action.payload ? state.selectedWidgetId : null,
      };

    case 'SET_SELECTED_WIDGET':
      return { ...state, selectedWidgetId: action.payload };

    case 'SET_DRAGGING':
      return { ...state, isDragging: action.payload };

    case 'SET_RESIZING':
      return { ...state, isResizing: action.payload };

    case 'UPDATE_LAYOUT': {
      const { widgets } = action.payload;
      const widgetMap: Record<string, DashboardWidget> = {};
      
      widgets.forEach(widget => {
        widgetMap[widget.id] = widget;
      });

      return {
        ...state,
        widgets: widgetMap,
        currentDashboard: state.currentDashboard ? {
          ...state.currentDashboard,
          widgets,
        } : null,
      };
    }

    case 'RESET_DASHBOARD':
      return {
        ...initialState,
        settings: state.settings,
      };

    default:
      return state;
  }
};

// Context interface
interface DashboardContextValue {
  state: DashboardState;
  
  // Dashboard operations
  loadDashboard: (dashboardId: string) => Promise<void>;
  updateDashboard: (dashboardId: string, updates: Partial<Dashboard>) => void;
  saveDashboard: () => Promise<void>;
  resetDashboard: () => void;
  
  // Widget operations
  addWidget: (widget: Omit<DashboardWidget, 'id'>) => Promise<void>;
  updateWidget: (id: string, updates: Partial<DashboardWidget>) => void;
  removeWidget: (id: string) => Promise<void>;
  duplicateWidget: (id: string) => void;
  
  // Data operations
  refreshWidget: (widgetId: string) => Promise<void>;
  refreshAllWidgets: () => Promise<void>;
  setWidgetData: (widgetId: string, data: any) => void;
  
  // UI state operations
  setEditMode: (enabled: boolean) => void;
  setSelectedWidget: (widgetId: string | null) => void;
  setDragging: (isDragging: boolean) => void;
  setResizing: (isResizing: boolean) => void;
  
  // Layout operations
  updateLayout: (widgets: DashboardWidget[]) => void;
  
  // Settings operations
  updateSettings: (settings: Partial<DashboardSettings>) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const authHeaders = useAuthHeaders();

  // Generate unique widget ID
  const generateWidgetId = useCallback(() => {
    return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Load dashboard from API
  const loadDashboard = useCallback(async (dashboardId: string) => {
    console.log('loadDashboard called with dashboardId:', dashboardId);
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Special handling for 'new' dashboard ID
      if (dashboardId === 'new') {
        console.log('Creating new dashboard...');
        console.log('Auth headers:', authHeaders);
        
        // Create a new dashboard
        const response = await fetch(`${defaultSettings.apiUrl}/api/v1/dashboards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            name: 'New Dashboard',
            description: 'A new dashboard for workflow data visualization',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create dashboard: ${response.statusText}`);
        }

        const { data } = await response.json();
        console.log('LOAD: Widget positions from API:', data.widgets?.map(w => ({ id: w.id, position: w.position })) || []);
        dispatch({ type: 'SET_DASHBOARD', payload: data });
      } else {
        // Load existing dashboard
        const response = await fetch(`${defaultSettings.apiUrl}/api/v1/dashboards/${dashboardId}`, {
          headers: authHeaders,
        });

        if (!response.ok) {
          throw new Error(`Failed to load dashboard: ${response.statusText}`);
        }

        const { data } = await response.json();
        console.log('LOAD: Widget positions from API:', data.widgets?.map(w => ({ id: w.id, position: w.position })) || []);
        console.log('LOAD: Widget settings from API:', data.widgets?.map((w: any) => ({ 
          id: w.id, 
          title: w.title,
          showHeader: w.showHeader, 
          showFooter: w.showFooter 
        })) || []);
        dispatch({ type: 'SET_DASHBOARD', payload: data });
        
        // Note: Widget data will be loaded separately when needed
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  }, [authHeaders]);

  // Save dashboard to API
  const saveDashboard = useCallback(async () => {
    if (!state.currentDashboard) return;

    try {
      console.log('SAVE: Widget positions before save:', state.currentDashboard.widgets.map(w => ({ id: w.id, position: w.position })));
      
      const response = await fetch(`${defaultSettings.apiUrl}/api/v1/dashboards/${state.currentDashboard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(state.currentDashboard),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save failed:', response.status, errorText);
        throw new Error(`Failed to save dashboard: ${response.statusText}`);
      }
      
      console.log('SAVE: Dashboard saved successfully');
    } catch (error) {
      console.error('Error saving dashboard:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  }, [state.currentDashboard, authHeaders]);

  // Update dashboard
  const updateDashboard = useCallback((dashboardId: string, updates: Partial<Dashboard>) => {
    dispatch({ type: 'UPDATE_DASHBOARD', payload: updates });
  }, []);

  // Reset dashboard
  const resetDashboard = useCallback(() => {
    dispatch({ type: 'RESET_DASHBOARD' });
  }, []);

  // Add widget
  const addWidget = useCallback(async (widget: Omit<DashboardWidget, 'id'>) => {
    if (!state.currentDashboard) {
      console.error('No current dashboard - cannot add widget');
      return;
    }

    try {
      const response = await fetch(`${defaultSettings.apiUrl}/api/v1/dashboards/${state.currentDashboard.id}/widgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(widget),
      });

      if (!response.ok) {
        throw new Error(`Failed to add widget: ${response.statusText}`);
      }

      const { data } = await response.json();
      dispatch({ type: 'ADD_WIDGET', payload: data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  }, [state.currentDashboard, authHeaders]);

  // Update widget
  const updateWidget = useCallback(async (id: string, updates: Partial<DashboardWidget>) => {
    if (!state.currentDashboard) {
      console.error('No current dashboard - cannot update widget');
      return;
    }

    // Update local state immediately for responsive UI
    dispatch({ type: 'UPDATE_WIDGET', payload: { id, updates } });

    try {
      // Persist changes to backend
      const response = await fetch(`${defaultSettings.apiUrl}/api/v1/dashboards/${state.currentDashboard.id}/widgets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update widget: ${response.statusText}`);
      }

      console.log('Widget updated successfully');
    } catch (error) {
      console.error('Error updating widget:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      // Optionally revert local changes here if API call fails
    }
  }, [state.currentDashboard, authHeaders]);

  // Remove widget
  const removeWidget = useCallback(async (id: string) => {
    if (!state.currentDashboard) {
      console.error('No current dashboard - cannot remove widget');
      return;
    }

    try {
      // Remove from backend first
      const response = await fetch(`${defaultSettings.apiUrl}/api/v1/dashboards/${state.currentDashboard.id}/widgets/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete widget: ${response.status}`);
      }

      // If API call succeeds, remove from local state
      dispatch({ type: 'REMOVE_WIDGET', payload: id });
      console.log(' Widget deleted successfully:', id);
    } catch (error) {
      console.error(' Failed to delete widget:', error);
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      // Don't remove from local state if API call fails
    }
  }, [state.currentDashboard, authHeaders]);

  // Duplicate widget
  const duplicateWidget = useCallback((id: string) => {
    const widget = state.widgets[id];
    if (!widget) return;

    const duplicated = {
      ...widget,
      id: generateWidgetId(),
      title: `${widget.title} (Copy)`,
      position: {
        ...widget.position,
        x: widget.position.x + 1,
        y: widget.position.y + 1,
      },
    };

    dispatch({ type: 'ADD_WIDGET', payload: duplicated });
  }, [state.widgets, generateWidgetId]);

  // Refresh widget data
  const refreshWidget = useCallback(async (widgetId: string) => {
    const widget = state.widgets[widgetId];
    if (!widget || !state.currentDashboard) return;

    try {
      const response = await fetch(
        `${defaultSettings.apiUrl}/api/v1/dashboards/${state.currentDashboard.id}/widgets/${widgetId}/data`,
        {
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to refresh widget ${widgetId}: ${response.statusText}`);
      }

      const { data } = await response.json();
      dispatch({ type: 'SET_WIDGET_DATA', payload: { widgetId, data } });
    } catch (error) {
      console.error('Error refreshing widget:', error);
      // Don't dispatch error for individual widget failures
    }
  }, [state.widgets, state.currentDashboard, authHeaders]);

  // Refresh all widgets
  const refreshAllWidgets = useCallback(async () => {
    const widgets = Object.values(state.widgets);
    const refreshPromises = widgets.map(widget => refreshWidget(widget.id));
    await Promise.allSettled(refreshPromises);
  }, [state.widgets, refreshWidget]);

  // Set widget data
  const setWidgetData = useCallback((widgetId: string, data: any) => {
    dispatch({ type: 'SET_WIDGET_DATA', payload: { widgetId, data } });
  }, []);

  // UI state operations
  const setEditMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EDIT_MODE', payload: enabled });
  }, []);

  const setSelectedWidget = useCallback((widgetId: string | null) => {
    dispatch({ type: 'SET_SELECTED_WIDGET', payload: widgetId });
  }, []);

  const setDragging = useCallback((isDragging: boolean) => {
    dispatch({ type: 'SET_DRAGGING', payload: isDragging });
  }, []);

  const setResizing = useCallback((isResizing: boolean) => {
    dispatch({ type: 'SET_RESIZING', payload: isResizing });
  }, []);

  // Layout operations
  const updateLayout = useCallback((widgets: DashboardWidget[]) => {
    dispatch({ type: 'UPDATE_LAYOUT', payload: { widgets } });
  }, []);

  // Settings operations
  const updateSettings = useCallback((settings: Partial<DashboardSettings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
    
    // Persist settings to localStorage
    const currentSettings = { ...state.settings, ...settings };
    localStorage.setItem('dashboard-settings', JSON.stringify(currentSettings));
  }, [state.settings]);

  // Error handling
  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('dashboard-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        dispatch({ type: 'SET_SETTINGS', payload: settings });
      } catch (error) {
        console.error('Failed to load dashboard settings:', error);
      }
    }
  }, []);

  // Auto-save dashboard when widgets change (debounced)
  useEffect(() => {
    if (!state.currentDashboard || !state.isEditMode) return;

    const timeoutId = setTimeout(() => {
      saveDashboard();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [state.widgets, state.currentDashboard, state.isEditMode, saveDashboard]);

  const value: DashboardContextValue = {
    state,
    loadDashboard,
    updateDashboard,
    saveDashboard,
    resetDashboard,
    addWidget,
    updateWidget,
    removeWidget,
    duplicateWidget,
    refreshWidget,
    refreshAllWidgets,
    setWidgetData,
    setEditMode,
    setSelectedWidget,
    setDragging,
    setResizing,
    updateLayout,
    updateSettings,
    setError,
    clearError,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export default DashboardProvider;