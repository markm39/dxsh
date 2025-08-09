/**
 * Line Chart Component
 * 
 * Supports multiple series with customizable styling
 */

import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, LineChartConfig } from './types';
import { CustomTooltip } from './common/CustomTooltip';

interface LineChartProps extends ChartComponentProps {
  config: LineChartConfig;
}

export const LineChart: React.FC<LineChartProps> = ({
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
    strokeWidth = 2,
    connectNulls = false,
    dot = true,
  } = config;

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const yAxisFields = Array.isArray(yAxis) ? yAxis : [yAxis];

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsLineChart
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
        
        {yAxisFields.map((field, index) => (
          <Line
            key={field}
            type="monotone"
            dataKey={field}
            stroke={colors[index % colors.length]}
            strokeWidth={strokeWidth}
            connectNulls={connectNulls}
            dot={dot ? { 
              fill: colors[index % colors.length], 
              strokeWidth: 0, 
              r: 4 
            } : false}
            activeDot={{ r: 6, fill: colors[index % colors.length] }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

export default LineChart;