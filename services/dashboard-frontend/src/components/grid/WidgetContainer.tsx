/**
 * Widget Container Component
 * 
 * Wrapper for individual widgets with controls and error boundaries
 */

import React, { useState } from 'react';
import { MoreVertical, Trash2, Copy, RefreshCw, Settings } from 'lucide-react';
import type { DashboardWidget, ChartWidgetConfig as ChartWidgetConfigType, TextWidgetConfig as TextWidgetConfigType, ModelWidgetConfig as ModelWidgetConfigType } from '@shared/types';
import WidgetRenderer from '../widgets/WidgetRenderer';
import ChartWidgetConfig from '../widgets/ChartWidgetConfig';
import TextWidgetConfig from '../widgets/TextWidgetConfig';
import ModelWidgetConfig from '../widgets/ModelWidgetConfig';
import InlineEditableText from '../common/InlineEditableText';
import { useDashboard } from '../../providers/DashboardProvider';
import { useWidgetData } from '../../hooks/useWidgetData';

interface WidgetContainerProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
}) => {
  const { 
    removeWidget, 
    updateWidget,
    setSelectedWidget, 
    state: { selectedWidgetId } 
  } = useDashboard();
  
  const { refreshData, isFetching } = useWidgetData(dashboardId, widget);
  const [showConfig, setShowConfig] = useState(false);

  const isSelected = selectedWidgetId === widget.id;

  const handleWidgetClick = (e: React.MouseEvent) => {
    if (!isEditMode) return;
    
    e.stopPropagation();
    setSelectedWidget(isSelected ? null : widget.id);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refreshData();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete widget "${widget.title || 'Untitled'}"?`)) {
      await removeWidget(widget.id);
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement duplicate functionality
    console.log('Duplicate widget:', widget.id);
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfig(true);
  };

  const handleConfigSave = (config: ChartWidgetConfigType | TextWidgetConfigType | ModelWidgetConfigType) => {
    console.log('WidgetContainer saving config for widget:', widget.id, config);
    updateWidget(widget.id, { config });
    setShowConfig(false);
  };

  const handleWidgetNameSave = (newTitle: string) => {
    updateWidget(widget.id, { title: newTitle });
  };

  return (
    <div
      className={`
        widget-container h-full flex flex-col
        ${isEditMode ? 'cursor-pointer' : ''}
        ${isSelected ? 'active ring-2 ring-primary/30 border-primary/30' : ''}
        ${isEditMode ? 'hover:bg-surface-secondary/20' : ''}
      `}
      onClick={handleWidgetClick}
    >
      {/* Widget Header - conditional based on showHeader setting */}
      {(widget.showHeader !== false || isEditMode) && (
        <div className="widget-header flex-shrink-0">
          <div className="flex items-center justify-between">
            <InlineEditableText
              value={widget.title || 'Untitled Widget'}
              onSave={handleWidgetNameSave}
              placeholder="Widget Title"
              className="widget-title text-sm font-medium text-text-primary flex-1 min-w-0"
              maxLength={50}
              showEditIcon={isEditMode}
              disabled={!isEditMode}
            />
            
            <div className="flex items-center gap-1">
              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                className={`
                  p-1 rounded hover:bg-surface-secondary/30 transition-colors
                  ${isFetching ? 'animate-spin' : ''}
                `}
                title="Refresh data"
              >
                <RefreshCw className="h-3 w-3 text-text-muted" />
              </button>

              {/* Edit mode controls */}
              {isEditMode && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSettings}
                    className="p-1 rounded hover:bg-surface-secondary/30 transition-colors"
                    title="Widget settings"
                  >
                    <Settings className="h-3 w-3 text-text-muted" />
                  </button>
                  
                  <button
                    onClick={handleDuplicate}
                    className="p-1 rounded hover:bg-surface-secondary/30 transition-colors"
                    title="Duplicate widget"
                  >
                    <Copy className="h-3 w-3 text-text-muted" />
                  </button>
                  
                  <button
                    onClick={handleDelete}
                    className="p-1 rounded hover:bg-red-500/10 transition-colors"
                    title="Delete widget"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Widget description */}
          {widget.description && (
            <p className="text-2xs text-text-muted mt-1 truncate">
              {widget.description}
            </p>
          )}
        </div>
      )}

      {/* Widget Content */}
      <div className="widget-content flex-1 min-h-0">
        <WidgetRenderer
          dashboardId={dashboardId}
          widget={widget}
          isEditMode={isEditMode}
        />
      </div>

      {/* Loading overlay for edit mode */}
      {isEditMode && isFetching && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}

      {/* Widget Configuration Modal */}
      {showConfig && widget.type === 'chart' && (
        <ChartWidgetConfig
          dashboardId={dashboardId}
          widget={widget}
          onSave={handleConfigSave}
          onClose={() => setShowConfig(false)}
        />
      )}
      
      {showConfig && widget.type === 'text' && (
        <TextWidgetConfig
          dashboardId={dashboardId}
          widget={widget}
          onSave={handleConfigSave}
          onClose={() => setShowConfig(false)}
        />
      )}
      
      {showConfig && widget.type === 'model' && (
        <ModelWidgetConfig
          dashboardId={dashboardId}
          widget={widget}
          onSave={handleConfigSave}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
};

export default WidgetContainer;