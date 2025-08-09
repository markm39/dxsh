/**
 * Histogram Component
 * 
 * Shows distribution of numeric values
 */

import React, { useMemo } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, HistogramConfig } from './types';
import { CustomTooltip } from './common/CustomTooltip';

interface HistogramProps extends ChartComponentProps {
  config: HistogramConfig;
}

export const Histogram: React.FC<HistogramProps> = ({
  data,
  config,
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const {
    xAxis,
    colors = ['#3b82f6'],
    showGrid = true,
    showTooltip = true,
    bins = 10,
  } = config;

  if (!data || data.length === 0 || !xAxis) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  // Calculate histogram bins
  const histogramData = useMemo(() => {
    const values = data
      .map(item => Number(item[xAxis]))
      .filter(val => !isNaN(val))
      .sort((a, b) => a - b);

    if (values.length === 0) return [];

    const min = values[0];
    const max = values[values.length - 1];
    const binWidth = (max - min) / bins;

    // Create bins
    const binData = Array.from({ length: bins }, (_, i) => {
      const binStart = min + i * binWidth;
      const binEnd = min + (i + 1) * binWidth;
      const count = values.filter(val => val >= binStart && (i === bins - 1 ? val <= binEnd : val < binEnd)).length;
      
      return {
        bin: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        binStart,
        binEnd,
        count,
        frequency: count / values.length,
      };
    });

    return binData;
  }, [data, xAxis, bins]);

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsBarChart
        data={histogramData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" />}
        
        <XAxis 
          dataKey="bin"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
          label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }}
        />
        
        {showTooltip && (
          <Tooltip 
            content={<CustomTooltip 
              labelFormatter={(label) => `Range: ${label}`}
              valueFormatter={(value, name) => [value.toLocaleString(), 'Count']}
            />}
          />
        )}
        
        <Bar
          dataKey="count"
          fill={colors[0]}
          radius={[2, 2, 0, 0]}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default Histogram;