/**
 * Shared Types for Dashboard System
 * 
 * Common types used across dashboard components and widgets
 */

import type { ChartDataPoint } from '../components/charts/types';

// Base widget configuration
export interface BaseWidgetConfig {
  title?: string;
  description?: string;
  refreshInterval?: number; // in seconds
  showLastUpdated?: boolean;
}

// Chart widget specific configuration
export interface ChartWidgetConfig extends BaseWidgetConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'histogram';
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  
  // Chart-specific options
  stackType?: 'none' | 'stacked' | 'percent';
  strokeWidth?: number;
  fillOpacity?: number;
  barSize?: number;
  symbolSize?: number;
  innerRadius?: number;
  outerRadius?: number;
  bins?: number;
}

// Metric widget configuration
export interface MetricWidgetConfig extends BaseWidgetConfig {
  metricField: string;
  aggregation?: 'sum' | 'average' | 'count' | 'min' | 'max' | 'last';
  format?: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
  showTrend?: boolean;
  trendField?: string;
  thresholds?: {
    good?: number;
    warning?: number;
    critical?: number;
  };
}

// Text widget configuration
export interface TextWidgetConfig extends BaseWidgetConfig {
  content: string;
  format?: 'plain' | 'markdown' | 'html';
  fontSize?: 'small' | 'medium' | 'large';
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  textColor?: string;
}

// Model widget configuration
export interface ModelWidgetConfig extends BaseWidgetConfig {
  showPredictionForm?: boolean;
  showPerformance?: boolean;
  showVisualizations?: boolean;
  showExplanation?: boolean;
  defaultTab?: 'predict' | 'performance' | 'visualize' | 'explain';
  compact?: boolean;
  
  // Layout options
  showHeader?: boolean; // Show/hide the model name and version header
  showTabs?: boolean;   // Show/hide the tab navigation (single tab mode)
  allowedTabs?: Array<'predict' | 'performance' | 'visualize' | 'explain'>; // Restrict visible tabs
}

// Widget data source configuration
export interface WidgetDataSource {
  type: 'workflow' | 'api' | 'static';
  
  // For workflow data sources
  workflowId?: string;
  nodeId?: string;
  
  // For API data sources
  url?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  
  // For static data
  staticData?: any;
  
  // Refresh settings
  refreshInterval?: number;
  cacheDuration?: number;
}

// Dashboard widget types
export type WidgetType = 'chart' | 'metric' | 'text' | 'model' | 'table' | 'image' | 'iframe';

// Widget configuration union type
export type WidgetConfig = 
  | ChartWidgetConfig 
  | MetricWidgetConfig 
  | TextWidgetConfig 
  | ModelWidgetConfig;

// Dashboard widget interface
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  
  // Grid layout properties
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  
  // Widget configuration
  config: WidgetConfig;
  
  // Data source
  dataSource?: WidgetDataSource;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// Dashboard interface
export interface Dashboard {
  id: string;
  title: string;
  description?: string;
  widgets: DashboardWidget[];
  
  // Layout settings
  layout: {
    cols: number;
    rowHeight: number;
    margin: [number, number];
    containerPadding: [number, number];
  };
  
  // Display settings
  settings: {
    theme?: 'light' | 'dark' | 'auto';
    showGrid?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
  };
  
  // Access control
  isPublic: boolean;
  sharedWith?: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Widget data response
export interface WidgetDataResponse {
  data: any;
  metadata?: {
    lastUpdated: string;
    dataType: string;
    rowCount?: number;
    schema?: Array<{
      name: string;
      type: string;
    }>;
  };
  error?: string;
}

// Dashboard API responses
export interface DashboardListResponse {
  dashboards: Dashboard[];
  total: number;
}

export interface DashboardResponse {
  dashboard: Dashboard;
}

// Widget creation/update requests
export interface CreateWidgetRequest {
  type: WidgetType;
  title: string;
  description?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: WidgetConfig;
  dataSource?: WidgetDataSource;
}

export interface UpdateWidgetRequest {
  title?: string;
  description?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: Partial<WidgetConfig>;
  dataSource?: WidgetDataSource;
}

// Dashboard creation/update requests
export interface CreateDashboardRequest {
  title: string;
  description?: string;
  layout?: Dashboard['layout'];
  settings?: Dashboard['settings'];
  isPublic?: boolean;
}

export interface UpdateDashboardRequest {
  title?: string;
  description?: string;
  layout?: Dashboard['layout'];
  settings?: Dashboard['settings'];
  isPublic?: boolean;
}

// Error types
export interface APIError {
  message: string;
  code?: string;
  details?: any;
}

// Re-export chart types for convenience
export type { ChartDataPoint };

// Model-specific types (imported from model widget system)
export interface ModelData {
  id: string;
  type: 'linearRegression' | 'randomForest' | 'logisticRegression' | 'neuralNetwork';
  name: string;
  description?: string;
  schema: {
    features: Array<{
      name: string;
      type: 'number' | 'categorical' | 'boolean';
      displayName?: string;
      description?: string;
      min?: number;
      max?: number;
      options?: string[];
      required?: boolean;
    }>;
    target: {
      name: string;
      type: string;
      displayName?: string;
      unit?: string;
    };
  };
  performance: {
    score: number;
    r_squared?: number;
    mean_squared_error?: number;
    accuracy?: number;
    feature_importance?: Array<{
      feature: string;
      importance: number;
    }>;
    training_info: {
      training_date: string;
      dataset_size: number;
    };
  };
  created_at: string;
  updated_at: string;
  version: string;
}

export interface PredictionResult {
  value: number | string;
  confidence?: number;
  explanation?: {
    featureContributions: Array<{
      feature: string;
      contribution: number;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    summary?: string;
  };
}