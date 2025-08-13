/**
 * Area Chart Component
 * 
 * Shows trends with filled areas, supports stacking
 */

import React from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, AreaChartConfig } from './types';
import { CustomTooltip } from './common/CustomTooltip';

interface AreaChartProps extends ChartComponentProps {
  config: AreaChartConfig;
}

export const AreaChart: React.FC<AreaChartProps> = ({
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
    fillOpacity = 0.3,
  } = config;

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const yAxisFields = Array.isArray(yAxis) ? yAxis : [yAxis];
  const stackId = stackType !== 'none' ? 'stack' : null;

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsAreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          {yAxisFields.map((field, index) => (
            <linearGradient key={field} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0.1}/>
            </linearGradient>
          ))}
        </defs>
        
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
          const areaProps: any = {
            key: field,
            type: "monotone",
            dataKey: field,
            stroke: colors[index % colors.length],
            fill: `url(#color${index})`,
            fillOpacity: fillOpacity,
            strokeWidth: 2,
          };
          
          if (stackId) {
            areaProps.stackId = stackId;
          }
          
          return <Area {...areaProps} />;
        })}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
};

export default AreaChart;