import React from 'react';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend
} from 'recharts';
import { ModelVisualization as ModelVizType } from '../types';

interface ModelVisualizationProps {
  visualization: ModelVizType;
  className?: string;
}

export const ModelVisualization: React.FC<ModelVisualizationProps> = ({
  visualization,
  className = ''
}) => {
  const renderVisualization = () => {
    switch (visualization.type) {
      case 'bar':
        return renderBarChart();
      case 'scatter':
        return renderScatterPlot();
      default:
        return renderUnsupportedChart();
    }
  };

  const renderBarChart = () => {
    if (!visualization.data || !Array.isArray(visualization.data)) {
      return <div className="text-sm text-text-muted">No data available</div>;
    }

    // Transform data for Recharts
    const chartData = visualization.data.map(item => ({
      name: item.feature,
      value: item.coefficient || item.importance || 0,
      absValue: Math.abs(item.coefficient || item.importance || 0)
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '0.5rem'
            }}
            labelStyle={{ color: '#F3F4F6' }}
            itemStyle={{ color: '#F3F4F6' }}
            formatter={(value: number) => value.toFixed(4)}
          />
          <ReferenceLine y={0} stroke="#6B7280" />
          <Bar dataKey="value">
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.value >= 0 ? '#10B981' : '#EF4444'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderScatterPlot = () => {
    if (!visualization.data || typeof visualization.data !== 'object') {
      return <div className="text-sm text-text-muted">No data available</div>;
    }

    // Handle Actual vs Predicted
    if (visualization.title === 'Actual vs Predicted') {
      const { train, test } = visualization.data as any;
      
      if (!train && !test) {
        return <div className="text-sm text-text-muted">No data available</div>;
      }

      // Prepare data for scatter plot
      const scatterData = [];
      
      if (train?.actual && train?.predicted) {
        train.actual.forEach((actual: number, i: number) => {
          scatterData.push({
            actual,
            predicted: train.predicted[i],
            type: 'Training'
          });
        });
      }
      
      if (test?.actual && test?.predicted) {
        test.actual.forEach((actual: number, i: number) => {
          scatterData.push({
            actual,
            predicted: test.predicted[i],
            type: 'Test'
          });
        });
      }

      // Calculate min and max for reference line and axis scaling
      const allValues = [...(train?.actual || []), ...(train?.predicted || []), 
                        ...(test?.actual || []), ...(test?.predicted || [])];
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);
      
      // Add some padding to the range (5% on each side)
      const range = maxValue - minValue;
      const padding = range * 0.05;
      const domainMin = minValue - padding;
      const domainMax = maxValue + padding;

      return (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              type="number"
              dataKey="actual" 
              name="Actual"
              domain={[domainMin, domainMax]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Actual Values', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
            />
            <YAxis 
              type="number"
              dataKey="predicted" 
              name="Predicted"
              domain={[domainMin, domainMax]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Predicted Values', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '0.5rem'
              }}
              labelStyle={{ color: '#F3F4F6' }}
              formatter={(value: number) => value.toFixed(2)}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            {/* Perfect prediction line */}
            <ReferenceLine 
              segment={[{ x: minValue, y: minValue }, { x: maxValue, y: maxValue }]} 
              stroke="#6B7280"
              strokeDasharray="5 5"
            />
            <Scatter 
              name="Training" 
              data={scatterData.filter(d => d.type === 'Training')} 
              fill="#3B82F6"
            />
            <Scatter 
              name="Test" 
              data={scatterData.filter(d => d.type === 'Test')} 
              fill="#8B5CF6"
            />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // Handle Residuals
    if (visualization.title === 'Residuals') {
      const { train, test } = visualization.data as any;
      
      // Prepare data for residuals plot
      const residualsData = [];
      
      if (train && Array.isArray(train)) {
        train.forEach((residual: number, i: number) => {
          residualsData.push({
            index: i,
            residual,
            type: 'Training'
          });
        });
      }
      
      if (test && Array.isArray(test)) {
        test.forEach((residual: number, i: number) => {
          residualsData.push({
            index: train ? train.length + i : i,
            residual,
            type: 'Test'
          });
        });
      }

      // Calculate residual range for better scaling
      const residualValues = residualsData.map(d => d.residual);
      const minResidual = Math.min(...residualValues);
      const maxResidual = Math.max(...residualValues);
      const residualRange = maxResidual - minResidual;
      const residualPadding = residualRange * 0.1; // 10% padding for residuals
      const residualDomainMin = minResidual - residualPadding;
      const residualDomainMax = maxResidual + residualPadding;

      return (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              type="number"
              dataKey="index" 
              name="Sample Index"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Sample Index', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
            />
            <YAxis 
              type="number"
              dataKey="residual" 
              name="Residual"
              domain={[residualDomainMin, residualDomainMax]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Residual', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '0.5rem'
              }}
              labelStyle={{ color: '#F3F4F6' }}
              formatter={(value: number) => value.toFixed(4)}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="5 5" />
            <Scatter 
              name="Training" 
              data={residualsData.filter(d => d.type === 'Training')} 
              fill="#3B82F6"
            />
            <Scatter 
              name="Test" 
              data={residualsData.filter(d => d.type === 'Test')} 
              fill="#8B5CF6"
            />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    return renderUnsupportedChart();
  };

  const renderUnsupportedChart = () => (
    <div className="flex items-center justify-center h-[300px]">
      <div className="text-center">
        <Activity className="w-8 h-8 text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-muted">
          {visualization.type} visualization
        </p>
        <p className="text-xs text-text-muted mt-1">
          Full chart implementation coming soon
        </p>
      </div>
    </div>
  );

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h4 className="font-medium text-text-primary">{visualization.title}</h4>
      </div>
      {renderVisualization()}
    </div>
  );
};

export default ModelVisualization;