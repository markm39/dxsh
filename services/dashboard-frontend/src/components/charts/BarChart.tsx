/**
 * Bar Chart Component
 * 
 * Supports single and multiple series with stacking options
 */

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, BarChartConfig } from './types';
import { CustomTooltip } from './common/CustomTooltip';

interface BarChartProps extends ChartComponentProps {
  config: BarChartConfig;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  config,
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const {
    xAxis,
    yAxis,
    colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'],
    showLegend = true,
    showGrid = true,
    showTooltip = true,
    stackType = 'none',
    barSize = 20,
  } = config;

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const yAxisFields = Array.isArray(yAxis) ? yAxis : [yAxis];
  const stackId = stackType !== 'none' ? 'stack' : null;

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsBarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />}
        
        <XAxis 
          dataKey={xAxis}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
        />
        
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
        />
        
        {showTooltip && <Tooltip content={<CustomTooltip />} />}
        {showLegend && yAxisFields.length > 1 && <Legend />}
        
        {yAxisFields.map((field, index) => {
          const barProps: any = {
            key: field,
            dataKey: field,
            fill: colors[index % colors.length],
            radius: [2, 2, 0, 0],
            maxBarSize: barSize,
          };
          
          if (stackId) {
            barProps.stackId = stackId;
          }
          
          return <Bar {...barProps} />;
        })}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarChart;