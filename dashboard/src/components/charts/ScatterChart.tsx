/**
 * Scatter Chart Component
 * 
 * Shows correlation between two numeric variables
 */

import React from 'react';
import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, ScatterChartConfig } from './types';

interface ScatterChartProps extends ChartComponentProps {
  config: ScatterChartConfig;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({
  data,
  config,
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const {
    xAxis,
    yAxis,
    labelField,
    showLabelsOnChart = false,
    showLabelsInTooltip = false,
    colors = ['#3b82f6'],
    showGrid = true,
    showTooltip = true,
    symbolSize = 4,
  } = config;

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const yAxisField = Array.isArray(yAxis) ? yAxis[0] : yAxis;

  // Helper function to get nested values
  const getNestedValue = (obj: any, path: string): any => {
    if (!path) return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  };

  // Transform data for scatter chart
  const scatterData = data.map((item, index) => ({
    x: Number(getNestedValue(item, xAxis)) || 0,
    y: Number(getNestedValue(item, yAxisField)) || 0,
    label: labelField ? String(getNestedValue(item, labelField) || '') : undefined,
    originalData: item,
  }));

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsScatterChart
        data={scatterData}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />}
        
        <XAxis 
          type="number"
          dataKey="x"
          name={xAxis}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
        />
        
        <YAxis 
          type="number"
          dataKey="y"
          name={yAxisField}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
        />
        
        {showTooltip && (
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload;
                return (
                  <div className="bg-surface border border-border-subtle rounded-lg shadow-lg p-3">
                    <div className="text-sm space-y-1">
                      <div><strong>{xAxis}:</strong> {data.x?.toLocaleString()}</div>
                      <div><strong>{yAxisField}:</strong> {data.y?.toLocaleString()}</div>
                      {labelField && showLabelsInTooltip && data.label && (
                        <div><strong>{labelField}:</strong> {data.label}</div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
        )}
        
        <Scatter 
          name="Data Points" 
          data={scatterData} 
          fill={colors[0]}
          shape={labelField && showLabelsOnChart ? (props: any) => {
            const { cx, cy, payload } = props;
            return (
              <g>
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r={symbolSize} 
                  fill={colors[0]} 
                />
                {payload?.label && (
                  <text
                    x={cx}
                    y={cy - symbolSize - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgb(148 163 184)"
                    dy="0.35em"
                  >
                    {payload.label}
                  </text>
                )}
              </g>
            );
          } : undefined}
        />
      </RechartsScatterChart>
    </ResponsiveContainer>
  );
};

export default ScatterChart;