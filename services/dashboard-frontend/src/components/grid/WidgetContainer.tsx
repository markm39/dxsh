/**
 * Widget Container Component
 *
 * Wrapper for individual widgets with controls, styling, and error boundaries
 */

import React, { useState, useMemo } from 'react';
import { MoreVertical, Trash2, Copy, RefreshCw, Settings, Palette } from 'lucide-react';
import type {
  DashboardWidget,
  ChartWidgetConfig as ChartWidgetConfigType,
  TextWidgetConfig as TextWidgetConfigType,
  ModelWidgetConfig as ModelWidgetConfigType,
} from '@shared/types';
import type { DashboardStyles, WidgetStyles } from '../../types/styling';
import { DEFAULT_DASHBOARD_STYLES } from '../../types/styling';
import {
  backgroundToCSS,
  borderToCSS,
  shadowToCSS,
  spacingToCSS,
  generateWidgetStyles,
} from '../../utils/styleUtils';
import WidgetRenderer from '../widgets/WidgetRenderer';
import ChartWidgetConfig from '../widgets/ChartWidgetConfig';
import TextWidgetConfig from '../widgets/TextWidgetConfig';
import ModelWidgetConfig from '../widgets/ModelWidgetConfig';
import { WidgetStyleEditor } from '../styling';
import InlineEditableText from '../common/InlineEditableText';
import { useDashboard } from '../../providers/DashboardProvider';
import { useWidgetData } from '../../hooks/useWidgetData';

interface WidgetContainerProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
  dashboardStyles?: DashboardStyles;
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
  dashboardStyles = DEFAULT_DASHBOARD_STYLES,
}) => {
  const {
    removeWidget,
    updateWidget,
    setSelectedWidget,
    state: { selectedWidgetId },
  } = useDashboard();

  const { refreshData, isFetching } = useWidgetData(dashboardId, widget);
  const [showConfig, setShowConfig] = useState(false);
  const [showStyleEditor, setShowStyleEditor] = useState(false);

  const isSelected = selectedWidgetId === widget.id;

  // Get widget-specific styles from widget config
  const widgetStyles: WidgetStyles = useMemo(() => {
    return widget.config?.styles || {};
  }, [widget.config?.styles]);

  // Generate computed styles for the widget
  const computedStyles = useMemo(() => {
    const styles: React.CSSProperties = {};

    // Apply widget-specific or dashboard default background
    const bgConfig = widgetStyles.background || dashboardStyles.widgetDefaults.background;
    Object.assign(styles, backgroundToCSS(bgConfig));

    // Apply widget-specific or dashboard default border
    const borderConfig = widgetStyles.border || dashboardStyles.widgetDefaults.border;
    const borderCSS = borderToCSS(borderConfig);
    Object.entries(borderCSS).forEach(([key, value]) => {
      (styles as any)[key] = value;
    });

    // Apply widget-specific or dashboard default shadow
    const shadowConfig = widgetStyles.shadow || dashboardStyles.widgetDefaults.shadow;
    styles.boxShadow = shadowToCSS(shadowConfig);

    return styles;
  }, [widgetStyles, dashboardStyles.widgetDefaults]);

  // Generate header styles
  const headerStyles = useMemo(() => {
    if (widgetStyles.header?.background) {
      return backgroundToCSS(widgetStyles.header.background);
    }
    return {};
  }, [widgetStyles.header?.background]);

  // Generate content styles
  const contentStyles = useMemo(() => {
    const styles: React.CSSProperties = {};
    if (widgetStyles.content?.background) {
      Object.assign(styles, backgroundToCSS(widgetStyles.content.background));
    }
    if (widgetStyles.content?.padding) {
      styles.padding = spacingToCSS(widgetStyles.content.padding);
    }
    return styles;
  }, [widgetStyles.content]);

  // Hover styles
  const [isHovered, setIsHovered] = useState(false);
  const hoverStyles = useMemo(() => {
    if (!widgetStyles.hover || !isHovered) return {};

    const styles: React.CSSProperties = {};
    if (widgetStyles.hover.background) {
      Object.assign(styles, backgroundToCSS(widgetStyles.hover.background));
    }
    if (widgetStyles.hover.shadow) {
      styles.boxShadow = shadowToCSS(widgetStyles.hover.shadow);
    }
    if (widgetStyles.hover.scale && widgetStyles.hover.scale !== 1) {
      styles.transform = `scale(${widgetStyles.hover.scale})`;
    }
    return styles;
  }, [widgetStyles.hover, isHovered]);

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
    console.log('Duplicate widget:', widget.id);
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfig(true);
  };

  const handleStyleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowStyleEditor(true);
  };

  const handleConfigSave = (
    config: ChartWidgetConfigType | TextWidgetConfigType | ModelWidgetConfigType
  ) => {
    console.log('WidgetContainer saving config for widget:', widget.id, config);
    updateWidget(widget.id, { config });
    setShowConfig(false);
  };

  const handleStylesSave = (styles: WidgetStyles) => {
    updateWidget(widget.id, {
      config: {
        ...widget.config,
        styles,
      },
    });
    setShowStyleEditor(false);
  };

  const handleWidgetNameSave = (newTitle: string) => {
    updateWidget(widget.id, { title: newTitle });
  };

  // Combine all styles with hover taking precedence
  const finalStyles: React.CSSProperties = {
    ...computedStyles,
    ...hoverStyles,
    transition: widgetStyles.hover?.transition || 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <div
      className={`
        widget-container h-full flex flex-col overflow-hidden
        ${isEditMode ? 'cursor-pointer' : ''}
        ${isSelected ? 'ring-2 ring-primary/30' : ''}
      `}
      style={finalStyles}
      onClick={handleWidgetClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header - conditional based on showHeader setting */}
      {(widget.showHeader !== false || isEditMode) && (
        <div className="widget-header flex-shrink-0" style={headerStyles}>
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
                    onClick={handleStyleSettings}
                    className="p-1 rounded hover:bg-surface-secondary/30 transition-colors"
                    title="Widget styling"
                  >
                    <Palette className="h-3 w-3 text-text-muted" />
                  </button>

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
      <div className="widget-content flex-1 min-h-0" style={contentStyles}>
        <WidgetRenderer
          dashboardId={dashboardId}
          widget={widget}
          isEditMode={isEditMode}
          dashboardStyles={dashboardStyles}
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

      {/* Widget Style Editor Modal */}
      {showStyleEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border-subtle rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <h3 className="font-medium text-text-primary">Widget Styling</h3>
              </div>
              <button
                onClick={() => setShowStyleEditor(false)}
                className="p-1 hover:bg-surface-secondary rounded transition-colors"
              >
                <span className="text-text-muted text-lg">&times;</span>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              <WidgetStyleEditor
                value={widgetStyles}
                onChange={handleStylesSave}
                widgetType={widget.type as any}
              />
            </div>
            <div className="p-4 border-t border-border-subtle flex justify-end gap-2">
              <button
                onClick={() => setShowStyleEditor(false)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStylesSave(widgetStyles)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WidgetContainer;
