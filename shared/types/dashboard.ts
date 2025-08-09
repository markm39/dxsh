/**
 * Dashboard System Type Definitions
 * 
 * Shared types between Workflow Engine and Dashboard Application
 */

// Core Dashboard Types
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  agentId: number;
  userId: number;
  
  // Layout configuration
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  
  // Display settings
  theme: DashboardTheme;
  refreshInterval?: number; // milliseconds
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: string; // for compatibility tracking
}

export interface DashboardLayout {
  grid: {
    cols: number;
    rows: number;
    gap: number;
  };
  responsive: boolean;
  compactType?: 'vertical' | 'horizontal' | null;
}

// Widget System Types
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  
  // Grid position
  position: WidgetPosition;
  
  // Data source configuration
  dataSource?: WidgetDataSource;
  
  // Widget-specific configuration
  config: WidgetConfig;
  
  // Display properties
  title?: string;
  description?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  
  // State
  isLoading?: boolean;
  error?: string;
  lastUpdated?: Date;
}

export type WidgetType = 
  | 'chart'
  | 'table'
  | 'metric'
  | 'model-interface'
  | 'text'
  | 'image'
  | 'iframe';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number; // width in grid units
  h: number; // height in grid units
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export interface WidgetDataSource {
  // Workflow connection
  agentId: number;
  nodeId: string;
  
  // Data extraction
  outputPath?: string; // JSONPath for nested data
  transform?: DataTransform;
  
  // Update behavior
  refreshOnWorkflowComplete: boolean;
  refreshInterval?: number; // override dashboard default
  cacheTime?: number; // cache duration in milliseconds
}

export interface DataTransform {
  type: 'filter' | 'map' | 'reduce' | 'sort' | 'custom';
  config: Record<string, any>;
  script?: string; // JavaScript transformation function
}

// Widget-specific configurations
export type WidgetConfig = 
  | ChartWidgetConfig
  | TableWidgetConfig
  | MetricWidgetConfig
  | ModelInterfaceWidgetConfig
  | TextWidgetConfig
  | ImageWidgetConfig
  | IframeWidgetConfig;

export interface ChartWidgetConfig {
  chartType: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'radar' | 'histogram';
  
  // Data mapping
  xAxis?: string;
  yAxis?: string | string[];
  colorBy?: string;
  
  // Styling
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  
  // Axes configuration
  xAxisTitle?: string;
  yAxisTitle?: string;
  xAxisType?: 'category' | 'number' | 'time';
  yAxisType?: 'category' | 'number' | 'time';
  
  // Radar chart specific fields
  categoricalField?: string;
  selectedValues?: string[];
  numericFields?: string[];
  
  // Scatter chart specific fields
  labelField?: string;
  showLabelsOnChart?: boolean;
  showLabelsInTooltip?: boolean;
  
  // Chart-specific options
  options?: Record<string, any>;
}

export interface TableWidgetConfig {
  // Column configuration
  columns?: TableColumn[];
  
  // Display options
  showHeader?: boolean;
  showFooter?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  
  // Sorting and filtering
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  
  // Styling
  striped?: boolean;
  bordered?: boolean;
  hover?: boolean;
  
  // Export options
  exportable?: boolean;
  exportFormats?: ('csv' | 'json' | 'xlsx')[];
}

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  formatter?: 'number' | 'currency' | 'date' | 'percentage' | 'custom';
  formatterConfig?: Record<string, any>;
}

export interface MetricWidgetConfig {
  // Value display
  valueKey: string;
  format?: 'number' | 'currency' | 'percentage';
  precision?: number;
  prefix?: string;
  suffix?: string;
  
  // Comparison
  comparisonKey?: string;
  comparisonType?: 'absolute' | 'percentage';
  showTrend?: boolean;
  
  // Styling
  size?: 'small' | 'medium' | 'large';
  color?: string;
  icon?: string;
  
  // Thresholds
  thresholds?: MetricThreshold[];
}

export interface MetricThreshold {
  value: number;
  color: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
}

export interface ModelInterfaceWidgetConfig {
  modelId: string;
  
  // Input configuration
  inputs: ModelInput[];
  
  // Output display
  outputFormat?: 'number' | 'text' | 'json' | 'chart';
  outputKey?: string;
  
  // UI options
  showInputLabels?: boolean;
  submitButtonText?: string;
  showPredictionHistory?: boolean;
}

export interface ModelInput {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'checkbox';
  required?: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface TextWidgetConfig {
  content: string;
  format: 'plain' | 'markdown' | 'html';
  
  // Styling
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  
  // Dynamic content
  templateVariables?: Record<string, string>;
}

export interface ImageWidgetConfig {
  src: string;
  alt?: string;
  
  // Display options
  fit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  showCaption?: boolean;
  caption?: string;
}

export interface IframeWidgetConfig {
  src: string;
  sandbox?: string[];
  allowFullscreen?: boolean;
}

// Theme System
export interface DashboardTheme {
  name: string;
  
  // Colors
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  
  // Typography
  fonts: {
    primary: string;
    secondary?: string;
  };
  
  // Spacing
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  
  // Border radius
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
  
  // Shadows
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

// API Response Types
export interface DashboardDataResponse {
  success: boolean;
  data: any;
  error?: string;
  timestamp: Date;
  executionId?: string;
}

export interface WidgetDataResponse {
  widgetId: string;
  data: any;
  error?: string;
  lastUpdated: Date;
  isStale: boolean;
}

// Real-time Update Types
export interface DashboardUpdate {
  type: 'widget-data' | 'widget-config' | 'layout' | 'error';
  dashboardId: string;
  widgetId?: string;
  data: any;
  timestamp: Date;
}

// Configuration and Settings
export interface DashboardSettings {
  apiUrl: string;
  apiKey?: string;
  
  // Performance
  maxConcurrentRequests: number;
  requestTimeout: number;
  retryAttempts: number;
  
  // Updates
  enableRealTimeUpdates: boolean;
  defaultRefreshInterval: number;
  
  // UI
  showGridLines: boolean;
  enableDragDrop: boolean;
  compactLayout: boolean;
}

// Validation and Error Types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface DashboardError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// Export utilities for type guards
export const isChartWidget = (widget: DashboardWidget): widget is DashboardWidget & { config: ChartWidgetConfig } => {
  return widget.type === 'chart';
};

export const isTableWidget = (widget: DashboardWidget): widget is DashboardWidget & { config: TableWidgetConfig } => {
  return widget.type === 'table';
};

export const isMetricWidget = (widget: DashboardWidget): widget is DashboardWidget & { config: MetricWidgetConfig } => {
  return widget.type === 'metric';
};

export const isModelInterfaceWidget = (widget: DashboardWidget): widget is DashboardWidget & { config: ModelInterfaceWidgetConfig } => {
  return widget.type === 'model-interface';
};