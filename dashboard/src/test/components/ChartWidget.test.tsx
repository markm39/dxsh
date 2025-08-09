/**
 * Chart Widget Component Tests
 * 
 * Tests for the ChartWidget component functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import ChartWidget from '../../components/widgets/ChartWidget';
import { createMockWidget } from '../utils';
import type { ChartWidgetConfig } from '@shared/types';

// Mock Recharts components to avoid canvas/SVG rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('ChartWidget', () => {
  const mockDashboardId = 'test-dashboard';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when data is loading', () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: 'value',
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Loading spinner
    });
  });

  describe('Error State', () => {
    it('should show error message when data fetch fails', async () => {
      const widget = createMockWidget({
        type: 'chart',
        dataSource: {
          agentId: 1,
          nodeId: 'non-existent-node',
          refreshOnWorkflowComplete: true,
        },
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: 'value',
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chart Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to load chart data/)).toBeInTheDocument();
      });
    });
  });

  describe('Chart Rendering', () => {
    it('should render line chart with data', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: 'value',
          showGrid: true,
          showLegend: true,
          showTooltip: true,
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByTestId('line')).toBeInTheDocument();
        expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      });
    });

    it('should render bar chart with data', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'bar',
          xAxis: 'category',
          yAxis: 'value',
          showGrid: false,
          showLegend: false,
          showTooltip: true,
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('bar')).toBeInTheDocument();
        expect(screen.queryByTestId('cartesian-grid')).not.toBeInTheDocument();
        expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
      });
    });

    it('should render pie chart with data', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'pie',
          xAxis: 'name',
          yAxis: 'value',
          showTooltip: true,
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        expect(screen.getByTestId('pie')).toBeInTheDocument();
      });
    });

    it('should handle multiple y-axis series', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: ['value1', 'value2', 'value3'],
          showLegend: true,
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getAllByTestId('line')).toHaveLength(3);
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      });
    });
  });

  describe('No Data State', () => {
    it('should show no data message when data is empty', async () => {
      // Mock empty data response
      const widget = createMockWidget({
        type: 'chart',
        dataSource: {
          agentId: 1,
          nodeId: 'empty-node', // This will return empty array from our mock
          refreshOnWorkflowComplete: true,
        },
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: 'value',
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No Data')).toBeInTheDocument();
        expect(screen.getByText('No data available for this chart')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should not show last updated time in edit mode', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: 'value',
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
          isEditMode={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      // Should not show timestamp in edit mode
      expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    });

    it('should show last updated time in view mode', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'line',
          xAxis: 'date',
          yAxis: 'value',
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
          isEditMode={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      // Should show timestamp in view mode
      await waitFor(() => {
        expect(screen.getByText(/Updated/)).toBeInTheDocument();
      });
    });
  });

  describe('Unsupported Chart Types', () => {
    it('should show error for unsupported chart type', async () => {
      const widget = createMockWidget({
        type: 'chart',
        config: {
          chartType: 'unsupported' as any,
          xAxis: 'date',
          yAxis: 'value',
        } as ChartWidgetConfig,
      });

      render(
        <ChartWidget
          dashboardId={mockDashboardId}
          widget={widget}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Unsupported chart type: unsupported/)).toBeInTheDocument();
      });
    });
  });
});