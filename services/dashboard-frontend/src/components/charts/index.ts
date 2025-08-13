/**
 * Charts Module Exports
 * 
 * Central export point for all chart components and types
 */

// Main factory component
export { default as ChartFactory } from './ChartFactory';

// Individual chart components
export { default as BarChart } from './BarChart';
export { default as LineChart } from './LineChart';
export { default as PieChart } from './PieChart';
export { default as RadarChart } from './RadarChart';
export { default as ScatterChart } from './ScatterChart';
export { default as AreaChart } from './AreaChart';
export { default as Histogram } from './Histogram';

// Common components
export { default as CustomTooltip } from './common/CustomTooltip';

// Types and interfaces
export type {
  ChartDataPoint,
  BaseChartProps,
  ChartComponentProps,
  BarChartConfig,
  LineChartConfig,
  PieChartConfig,
  RadarChartConfig,
  ScatterChartConfig,
  AreaChartConfig,
  HistogramConfig,
} from './types';