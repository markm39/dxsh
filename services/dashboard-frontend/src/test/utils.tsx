/**
 * Test Utilities
 * 
 * Custom render functions and test helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Test providers wrapper
interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  // Create a new QueryClient for each test to avoid cache pollution
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div id="portal-root" />
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Common test helpers
export const createMockWidget = (overrides = {}) => ({
  id: 'test-widget',
  type: 'chart' as const,
  position: { x: 0, y: 0, w: 6, h: 4 },
  dataSource: {
    agentId: 1,
    nodeId: 'test-node',
    refreshOnWorkflowComplete: true,
  },
  config: {
    chartType: 'line' as const,
    xAxis: 'date',
    yAxis: 'value',
  },
  title: 'Test Widget',
  ...overrides,
});

export const createMockDashboard = (overrides = {}) => ({
  id: 'test-dashboard',
  name: 'Test Dashboard',
  agentId: 1,
  userId: 1,
  layout: {
    grid: { cols: 12, rows: 8, gap: 16 },
    responsive: true,
  },
  widgets: [createMockWidget()],
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
    fonts: { primary: 'Inter' },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12 },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0.0',
  ...overrides,
});

// Mock functions
export const mockApiCall = vi.fn();
export const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Wait for async operations
export const waitForAsyncOperations = () =>
  new Promise(resolve => setTimeout(resolve, 0));

// Resize observer mock for grid layout tests
export const mockResizeObserver = () => {
  const mockObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  vi.stubGlobal('ResizeObserver', mockObserver);
  
  return mockObserver;
};

// Local storage mock
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: Object.keys(store).length,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};