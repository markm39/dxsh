/**
 * MSW Request Handlers
 * 
 * Mock API responses for testing
 */

import { http, HttpResponse } from 'msw';
import type { Dashboard, DashboardWidget, ApiResponse } from '@shared/types';

const API_BASE_URL = 'http://localhost:5000/api/v1';

// Mock data
const mockDashboard: Dashboard = {
  id: 'dashboard-1',
  name: 'Test Dashboard',
  description: 'A test dashboard for unit tests',
  agentId: 1,
  userId: 1,
  layout: {
    grid: { cols: 12, rows: 8, gap: 16 },
    responsive: true,
    compactType: 'vertical',
  },
  widgets: [
    {
      id: 'widget-1',
      type: 'chart',
      position: { x: 0, y: 0, w: 6, h: 4 },
      dataSource: {
        agentId: 1,
        nodeId: 'node-1',
        refreshOnWorkflowComplete: true,
      },
      config: {
        chartType: 'line',
        xAxis: 'date',
        yAxis: 'value',
        showLegend: true,
      },
      title: 'Test Chart',
    },
    {
      id: 'widget-2',
      type: 'metric',
      position: { x: 6, y: 0, w: 3, h: 2 },
      dataSource: {
        agentId: 1,
        nodeId: 'node-2',
        refreshOnWorkflowComplete: true,
      },
      config: {
        valueKey: 'total',
        format: 'number',
        precision: 0,
      },
      title: 'Total Count',
    },
  ],
  theme: {
    name: 'default',
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      background: '#ffffff',
      surface: '#f8fafc',
      text: {
        primary: '#1e293b',
        secondary: '#475569',
        muted: '#94a3b8',
      },
      border: '#e2e8f0',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12 },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
  },
  refreshInterval: 30000,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  version: '1.0.0',
};

const mockWidgetData = {
  'widget-1': [
    { date: '2024-01-01', value: 100 },
    { date: '2024-01-02', value: 150 },
    { date: '2024-01-03', value: 200 },
  ],
  'widget-2': { total: 450, change: '+12%' },
};

export const handlers = [
  // Dashboard CRUD
  http.get(`${API_BASE_URL}/dashboards/:id`, ({ params }) => {
    const { id } = params;
    if (id === 'dashboard-1') {
      return HttpResponse.json({
        success: true,
        data: mockDashboard,
        timestamp: new Date(),
      } as ApiResponse<Dashboard>);
    }
    return HttpResponse.json(
      {
        success: false,
        error: 'Dashboard not found',
        timestamp: new Date(),
      },
      { status: 404 }
    );
  }),

  http.post(`${API_BASE_URL}/dashboards`, async ({ request }) => {
    const data = await request.json();
    return HttpResponse.json({
      success: true,
      data: { ...mockDashboard, ...data, id: 'new-dashboard' },
      timestamp: new Date(),
    } as ApiResponse<Dashboard>);
  }),

  http.put(`${API_BASE_URL}/dashboards/:id`, async ({ params, request }) => {
    const { id } = params;
    const data = await request.json();
    return HttpResponse.json({
      success: true,
      data: { ...mockDashboard, ...data, id },
      timestamp: new Date(),
    } as ApiResponse<Dashboard>);
  }),

  http.delete(`${API_BASE_URL}/dashboards/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      timestamp: new Date(),
    } as ApiResponse);
  }),

  // Widget data
  http.get(`${API_BASE_URL}/dashboards/:dashboardId/widgets/:widgetId/data`, ({ params }) => {
    const { widgetId } = params;
    const data = mockWidgetData[widgetId as keyof typeof mockWidgetData];
    
    if (data) {
      return HttpResponse.json({
        success: true,
        data,
        timestamp: new Date(),
      } as ApiResponse);
    }
    
    return HttpResponse.json(
      {
        success: false,
        error: 'Widget data not found',
        timestamp: new Date(),
      },
      { status: 404 }
    );
  }),

  // Node outputs
  http.get(`${API_BASE_URL}/nodes/:nodeId/output`, ({ params }) => {
    const { nodeId } = params;
    
    const outputs = {
      'node-1': mockWidgetData['widget-1'],
      'node-2': mockWidgetData['widget-2'],
    };
    
    const data = outputs[nodeId as keyof typeof outputs];
    
    if (data) {
      return HttpResponse.json({
        success: true,
        data,
        timestamp: new Date(),
      } as ApiResponse);
    }
    
    return HttpResponse.json(
      {
        success: false,
        error: 'Node output not found',
        timestamp: new Date(),
      },
      { status: 404 }
    );
  }),

  // Agent executions
  http.get(`${API_BASE_URL}/agents/:agentId/latest-execution`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'execution-1',
        agentId: params.agentId,
        status: 'completed',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:05:00Z'),
        results: mockWidgetData,
      },
      timestamp: new Date(),
    } as ApiResponse);
  }),

  // Error simulation for testing
  http.get(`${API_BASE_URL}/error`, () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }),
];