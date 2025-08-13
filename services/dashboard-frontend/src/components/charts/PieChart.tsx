/**
 * Pie Chart Component
 * 
 * Circular chart for showing proportions
 */

import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, PieChartConfig } from './types';
import { CustomTooltip } from './common/CustomTooltip';

interface PieChartProps extends ChartComponentProps {
  config: PieChartConfig;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  config,
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const {
    xAxis,
    yAxis,
    colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'],
    showLegend = true,
    showTooltip = true,
    innerRadius = 0,
    outerRadius = 80,
    startAngle = 0,
    endAngle = 360,
  } = config;

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const yAxisField = Array.isArray(yAxis) ? yAxis[0] : yAxis;

  // Transform data for pie chart
  const pieData = data.map((item, index) => ({
    name: item[xAxis] || `Item ${index + 1}`,
    value: Number(item[yAxisField]) || 0,
    originalData: item,
  }));

  const renderLabel = ({ name, percent }: any) => 
    `${name} ${(percent * 100).toFixed(0)}%`;

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsPieChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={outerRadius}
          innerRadius={innerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((_, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={colors[index % colors.length]} 
            />
          ))}
        </Pie>
        
        {showTooltip && (
          <Tooltip 
            content={<CustomTooltip 
              valueFormatter={(value, name) => [value.toLocaleString(), 'Value']}
            />} 
          />
        )}
        
        {showLegend && <Legend />}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

export default PieChart;