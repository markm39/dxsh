/**
 * Chart Types and Interfaces
 * 
 * Shared types and interfaces for all chart components
 */

export interface ChartDataPoint {
  [key: string]: any;
  _index?: number;
}

export interface BaseChartProps {
  data: ChartDataPoint[];
  config: {
    xAxis?: string;
    yAxis?: string | string[];
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
    xAxisTitle?: string;
    yAxisTitle?: string;
  };
  width?: number | string;
  height?: number | string;
  className?: string;
}

export interface ChartComponentProps extends BaseChartProps {
  isLoading?: boolean;
  error?: Error | null;
}

// Chart-specific configuration interfaces
export interface BarChartConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  stackType?: 'none' | 'stacked' | 'percent';
  barSize?: number;
}

export interface LineChartConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  strokeWidth?: number;
  connectNulls?: boolean;
  dot?: boolean;
}

export interface PieChartConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface RadarChartConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  categoricalField?: string;
  selectedValues?: string[];
  numericFields?: string[];
  outerRadius?: number;
  polarGridType?: 'polygon' | 'circle';
}

export interface ScatterChartConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  labelField?: string;
  showLabelsOnChart?: boolean;
  showLabelsInTooltip?: boolean;
  symbolSize?: number;
}

export interface AreaChartConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  stackType?: 'none' | 'stacked' | 'percent';
  fillOpacity?: number;
}

export interface HistogramConfig {
  xAxis?: string;
  yAxis?: string | string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  bins?: number;
  binWidth?: number;
}