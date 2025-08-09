/**
 * Metric Widget Component
 * 
 * Displays key metrics and KPIs with trend indicators
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Loader2 } from 'lucide-react';
import type { DashboardWidget, MetricWidgetConfig } from '@shared/types';
import { useWidgetData } from '../../hooks/useWidgetData';

interface MetricWidgetProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
}

const MetricWidget: React.FC<MetricWidgetProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
}) => {
  const config = widget.config as MetricWidgetConfig;
  const { data, isLoading, error, isError, lastUpdated } = useWidgetData(dashboardId, widget);

  // Format number based on config
  const formatValue = (value: number): string => {
    if (isNaN(value)) return 'N/A';

    const precision = config.precision ?? 0;
    const prefix = config.prefix || '';
    const suffix = config.suffix || '';

    let formatted: string;

    switch (config.format) {
      case 'currency':
        formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
        break;

      case 'percentage':
        formatted = new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value / 100);
        break;

      default:
        formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
        break;
    }

    return `${prefix}${formatted}${suffix}`;
  };

  // Extract metric value from data
  const getValue = (): number | null => {
    if (!data) return null;
    
    if (typeof data === 'number') return data;
    if (typeof data === 'object' && config.valueKey) {
      return data[config.valueKey];
    }
    
    return null;
  };

  // Extract comparison value for trend calculation
  const getComparisonValue = (): number | null => {
    if (!data || !config.comparisonKey) return null;
    
    if (typeof data === 'object') {
      return data[config.comparisonKey];
    }
    
    return null;
  };

  // Calculate trend
  const calculateTrend = (current: number, comparison: number) => {
    if (config.comparisonType === 'percentage') {
      return ((current - comparison) / comparison) * 100;
    }
    return current - comparison;
  };

  // Get threshold color
  const getThresholdColor = (value: number): string | null => {
    if (!config.thresholds) return null;

    for (const threshold of config.thresholds) {
      let matches = false;
      
      switch (threshold.operator) {
        case 'gt':
          matches = value > threshold.value;
          break;
        case 'gte':
          matches = value >= threshold.value;
          break;
        case 'lt':
          matches = value < threshold.value;
          break;
        case 'lte':
          matches = value <= threshold.value;
          break;
        case 'eq':
          matches = value === threshold.value;
          break;
      }

      if (matches) {
        return threshold.color;
      }
    }

    return null;
  };

  const value = getValue();
  const comparisonValue = getComparisonValue();
  const thresholdColor = value !== null ? getThresholdColor(value) : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px]">
        <div className="text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || value === null) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] p-4">
        <div className="text-center">
          <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-text-primary mb-1">Error</p>
          <p className="text-xs text-text-secondary">
            {error?.message || 'Failed to load metric'}
          </p>
        </div>
      </div>
    );
  }

  // Calculate trend if comparison is available
  let trend: number | null = null;
  let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
  
  if (comparisonValue !== null && value !== null) {
    trend = calculateTrend(value, comparisonValue);
    if (trend > 0) trendDirection = 'up';
    else if (trend < 0) trendDirection = 'down';
  }

  // Determine text size based on widget size
  const getTextSize = () => {
    const size = config.size || 'medium';
    switch (size) {
      case 'small': return 'text-lg';
      case 'large': return 'text-4xl';
      default: return 'text-2xl';
    }
  };

  return (
    <div className="h-full flex flex-col justify-center p-4">
      <div className="text-center">
        {/* Icon if configured */}
        {config.icon && (
          <div className="mb-2">
            <span className="text-2xl">{config.icon}</span>
          </div>
        )}

        {/* Main value */}
        <div 
          className={`font-bold ${getTextSize()} leading-tight`}
          style={{ color: thresholdColor || config.color || undefined }}
        >
          {formatValue(value)}
        </div>

        {/* Trend indicator */}
        {config.showTrend && trend !== null && (
          <div className="flex items-center justify-center gap-1 mt-1">
            {trendDirection === 'up' && (
              <TrendingUp className="h-4 w-4 text-green-400" />
            )}
            {trendDirection === 'down' && (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
            {trendDirection === 'neutral' && (
              <Minus className="h-4 w-4 text-text-muted" />
            )}
            <span 
              className={`text-sm font-medium ${
                trendDirection === 'up' ? 'text-green-400' :
                trendDirection === 'down' ? 'text-red-400' :
                'text-text-secondary'
              }`}
            >
              {config.comparisonType === 'percentage' 
                ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`
                : `${trend > 0 ? '+' : ''}${formatValue(trend)}`
              }
            </span>
          </div>
        )}

        {/* Last updated - conditional based on showFooter setting */}
        {lastUpdated && !isEditMode && widget.showFooter !== false && (
          <div className="mt-2">
            <p className="text-2xs text-text-secondary">
              {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricWidget;