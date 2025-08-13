/**
 * Chart Factory Component
 * 
 * Routes to appropriate chart component based on chart type
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ChartComponentProps } from './types';

// Chart component imports
import BarChart from './BarChart';
import LineChart from './LineChart';
import PieChart from './PieChart';
import RadarChart from './RadarChart';
import ScatterChart from './ScatterChart';
import AreaChart from './AreaChart';
import Histogram from './Histogram';

interface ChartFactoryProps extends ChartComponentProps {
  chartType: string;
}

export const ChartFactory: React.FC<ChartFactoryProps> = ({
  chartType,
  data,
  config,
  width,
  height,
  className,
  isLoading,
  error,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-text-secondary">Loading chart...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="font-medium text-text-primary mb-1">Chart Error</p>
          <p className="text-sm text-text-secondary">{error.message}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="font-medium text-text-primary mb-1">No Data Available</p>
          <p className="text-sm text-text-secondary">
            Execute the connected workflow to populate chart data
          </p>
        </div>
      </div>
    );
  }

  // Route to appropriate chart component
  const chartProps = {
    data,
    config,
    width,
    height,
    className,
  };

  switch (chartType) {
    case 'bar':
      return <BarChart {...chartProps} />;
    
    case 'line':
      return <LineChart {...chartProps} />;
    
    case 'pie':
      return <PieChart {...chartProps} />;
    
    case 'radar':
      return <RadarChart {...chartProps} />;
    
    case 'scatter':
      return <ScatterChart {...chartProps} />;
    
    case 'area':
      return <AreaChart {...chartProps} />;
    
    case 'histogram':
      return <Histogram {...chartProps} />;
    
    default:
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="font-medium text-text-primary mb-1">Unsupported Chart Type</p>
            <p className="text-sm text-text-secondary">
              Chart type "{chartType}" is not supported
            </p>
          </div>
        </div>
      );
  }
};

export default ChartFactory;