/**
 * Radar Chart Component
 * 
 * Multi-dimensional data visualization
 */

import React from 'react';
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartComponentProps, RadarChartConfig } from './types';

interface RadarChartProps extends ChartComponentProps {
  config: RadarChartConfig;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  config,
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const {
    categoricalField,
    selectedValues = [],
    numericFields = [],
    colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'],
    showLegend = true,
    outerRadius = 80,
    polarGridType = 'polygon',
  } = config;

  if (!data || data.length === 0 || !categoricalField || !numericFields.length || !selectedValues.length) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

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

  // Process data to create radar chart format
  // Each numeric field becomes a point on the radar (angle)
  // Each selected categorical value becomes a separate radar line (series)
  const radarData = numericFields.map(field => {
    const dataPoint: any = { subject: field };
    
    selectedValues.forEach(categoryValue => {
      // Find data rows that match this categorical value
      const matchingRows = data.filter(row => {
        const cellValue = getNestedValue(row, categoricalField);
        return String(cellValue) === categoryValue;
      });
      
      if (matchingRows.length > 0) {
        // Calculate average value for this numeric field among matching rows
        const numericValues = matchingRows
          .map(row => {
            const value = getNestedValue(row, field);
            return typeof value === 'number' ? value : parseFloat(String(value));
          })
          .filter(val => !isNaN(val));
        
        if (numericValues.length > 0) {
          const avgValue = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
          dataPoint[categoryValue] = avgValue;
        }
      }
    });
    
    return dataPoint;
  });

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      <RechartsRadarChart data={radarData} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
        <PolarGrid gridType={polarGridType} />
        <PolarAngleAxis 
          dataKey="subject" 
          tick={{ fontSize: 12, fill: 'rgb(148 163 184)' }}
        />
        <PolarRadiusAxis 
          angle={90}
          domain={[0, 'dataMax']}
          tick={{ fontSize: 10, fill: 'rgb(148 163 184)' }}
        />
        
        {selectedValues.map((categoryValue, index) => (
          <Radar
            key={categoryValue}
            name={categoryValue}
            dataKey={categoryValue}
            stroke={colors[index % colors.length]}
            fill={colors[index % colors.length]}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        ))}
        
        {showLegend && selectedValues.length > 1 && <Legend />}
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
};

export default RadarChart;