/**
 * Chart Widget Component
 * 
 * Renders charts using Recharts with real data from workflow nodes
 */

import React from 'react';
import type { DashboardWidget, ChartWidgetConfig } from '@shared/types';
import { useWidgetData } from '../../hooks/useWidgetData';
import { analyzeDataStructure, getPrimaryTable } from '../../utils/dataAnalysis';
import { ChartFactory } from '../charts';

interface ChartWidgetProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
}

const ChartWidget: React.FC<ChartWidgetProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
}) => {
  const config = widget.config as ChartWidgetConfig;
  const { data, isLoading, error, isError, lastUpdated } = useWidgetData(dashboardId, widget);

  // Process data for chart rendering
  const processedData = React.useMemo(() => {
    if (!data) return [];
    
    // Use the data analysis utility to properly detect and extract table data
    const analysis = analyzeDataStructure(data);
    const primaryTable = getPrimaryTable(analysis);
    
    if (primaryTable) {
      return primaryTable.data.map((item, index) => ({
        ...item,
        _index: index,
      }));
    }
    
    // Fallback to original logic for non-table data
    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        ...item,
        _index: index,
      }));
    }
    
    return [];
  }, [data]);

  return (
    <div className="h-full flex flex-col">
      {/* Chart container */}
      <div className="flex-1 min-h-0">
        <ChartFactory
          chartType={config.chartType || 'bar'}
          data={processedData}
          config={config}
          isLoading={isLoading}
          error={isError ? error : null}
          width="100%"
          height="100%"
        />
      </div>

      {/* Footer with last updated info - conditional based on showFooter setting */}
      {lastUpdated && !isEditMode && widget.showFooter !== false && (
        <div className="px-2 py-1 border-t border-border-subtle">
          <p className="text-2xs text-text-secondary">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default ChartWidget;