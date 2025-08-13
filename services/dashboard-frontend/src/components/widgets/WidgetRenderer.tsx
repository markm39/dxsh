/**
 * Widget Renderer Component
 * 
 * Dynamically renders widgets based on their type
 */

import React from 'react';
import type { DashboardWidget } from '@shared/types';
import ChartWidget from './ChartWidget';
import MetricWidget from './MetricWidget';
import TextWidget from './TextWidget';
import ModelWidget from './ModelWidget';
import { AlertTriangle } from 'lucide-react';

interface WidgetRendererProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
}) => {
  // Render appropriate widget component based on type
  const renderWidget = () => {
    switch (widget.type) {
      case 'chart':
        return (
          <ChartWidget
            dashboardId={dashboardId}
            widget={widget}
            isEditMode={isEditMode}
          />
        );

      case 'metric':
        return (
          <MetricWidget
            dashboardId={dashboardId}
            widget={widget}
            isEditMode={isEditMode}
          />
        );

      case 'text':
        return (
          <TextWidget
            dashboardId={dashboardId}
            widget={widget}
            isEditMode={isEditMode}
          />
        );

      case 'model':
        return (
          <ModelWidget
            dashboardId={dashboardId}
            widget={widget}
            isEditMode={isEditMode}
          />
        );

      // TODO: Add more widget types as they're implemented
      case 'table':
      case 'image':
      case 'iframe':
        return (
          <div className="flex items-center justify-center h-full min-h-[120px] p-4">
            <div className="text-center">
              <AlertTriangle className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-text-primary mb-1">
                Coming Soon
              </p>
              <p className="text-xs text-text-muted">
                {widget.type} widgets are not yet implemented
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full min-h-[120px] p-4">
            <div className="text-center">
              <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-text-primary mb-1">
                Unknown Widget Type
              </p>
              <p className="text-xs text-text-muted">
                Widget type '{widget.type}' is not supported
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full">
      {renderWidget()}
    </div>
  );
};

export default WidgetRenderer;