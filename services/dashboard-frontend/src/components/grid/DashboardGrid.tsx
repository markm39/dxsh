/**
 * Dashboard Grid Component
 *
 * Responsive grid layout with drag-and-drop using React Grid Layout
 * Supports custom styling from dashboard settings
 */

import React, { useCallback, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import type { DashboardWidget } from '@shared/types';
import type { DashboardStyles } from '../../types/styling';
import { DEFAULT_DASHBOARD_STYLES } from '../../types/styling';
import { backgroundToCSS, spacingToCSS, generateCSSVariables } from '../../utils/styleUtils';
import WidgetContainer from './WidgetContainer';
import { useDashboard } from '../../providers/DashboardProvider';

// Import CSS for React Grid Layout
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  dashboardId: string;
  widgets: DashboardWidget[];
  isEditMode?: boolean;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  dashboardId,
  widgets,
  isEditMode = false,
}) => {
  const { state, updateWidget, setDragging, setResizing } = useDashboard();

  // Get dashboard styles from display settings
  const dashboardStyles: DashboardStyles = useMemo(() => {
    const displaySettings = state.currentDashboard?.displaySettings || {};
    return {
      ...DEFAULT_DASHBOARD_STYLES,
      ...displaySettings.styles,
    };
  }, [state.currentDashboard?.displaySettings]);

  // Generate CSS variables for the dashboard
  const cssVariables = useMemo(() => {
    return generateCSSVariables(dashboardStyles);
  }, [dashboardStyles]);

  // Generate background styles
  const backgroundStyles = useMemo(() => {
    return backgroundToCSS(dashboardStyles.background);
  }, [dashboardStyles.background]);

  // Grid gap and padding from styles
  const gridGap = dashboardStyles.grid.gap;
  const gridPadding = dashboardStyles.grid.padding;

  // Convert widgets to grid layout format
  const layouts = useMemo(() => {
    const layout: Layout[] = widgets.map((widget) => ({
      i: String(widget.id),
      x: widget.position.x,
      y: widget.position.y,
      w: widget.position.w,
      h: widget.position.h,
      minW: widget.position.minW || 1,
      maxW: widget.position.maxW || 24,
      minH: widget.position.minH || 1,
      maxH: widget.position.maxH || 20,
      isDraggable: isEditMode && widget.position.isDraggable !== false,
      isResizable: isEditMode && widget.position.isResizable !== false,
    }));

    return {
      lg: layout,
      md: layout,
      sm: layout,
      xs: layout,
      xxs: layout,
    };
  }, [widgets, isEditMode]);

  // Handle layout changes
  const handleLayoutChange = useCallback(
    (layout: Layout[]) => {
      if (!isEditMode) return;

      layout.forEach((item) => {
        const widget = widgets.find((w) => String(w.id) === String(item.i));
        if (widget) {
          const hasChanged =
            widget.position.x !== item.x ||
            widget.position.y !== item.y ||
            widget.position.w !== item.w ||
            widget.position.h !== item.h;

          if (hasChanged) {
            updateWidget(widget.id, {
              position: {
                ...widget.position,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
              },
            });
          }
        }
      });
    },
    [widgets, updateWidget, isEditMode]
  );

  // Handle drag start/stop
  const handleDragStart = useCallback(() => {
    setDragging(true);
  }, [setDragging]);

  const handleDragStop = useCallback(() => {
    setDragging(false);
  }, [setDragging]);

  // Handle resize start/stop
  const handleResizeStart = useCallback(() => {
    setResizing(true);
  }, [setResizing]);

  const handleResizeStop = useCallback(() => {
    setResizing(false);
  }, [setResizing]);

  // Grid breakpoints and column counts
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 24, md: 20, sm: 16, xs: 12, xxs: 8 };

  // Build inline style for the container
  const containerStyle: React.CSSProperties = {
    ...backgroundStyles,
    padding: spacingToCSS(gridPadding),
    minHeight: '100%',
    ...Object.fromEntries(
      Object.entries(cssVariables).map(([key, value]) => [key, value])
    ),
  };

  // Empty state
  if (widgets.length === 0) {
    return (
      <div
        className="dashboard-grid-container"
        style={containerStyle}
      >
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-border-subtle rounded-lg">
          <div className="text-center">
            <p className="text-text-secondary mb-2">No widgets yet</p>
            {isEditMode && (
              <p className="text-sm text-text-muted">Add widgets to get started</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Generate primary color from palette for placeholders
  const primaryColor = dashboardStyles.colorPalette.primary;

  return (
    <div className="dashboard-grid-container" style={containerStyle}>
      <ResponsiveGridLayout
        layouts={layouts}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={dashboardStyles.grid.rowHeight || 60}
        margin={[gridGap, gridGap]}
        containerPadding={[0, 0]}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        useCSSTransforms={true}
        compactType="vertical"
        preventCollision={false}
        autoSize={true}
        measureBeforeMount={false}
        className={`dashboard-grid ${isEditMode ? 'edit-mode' : 'view-mode'}`}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="grid-item">
            <WidgetContainer
              dashboardId={dashboardId}
              widget={widget}
              isEditMode={isEditMode}
              dashboardStyles={dashboardStyles}
            />
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Dynamic grid styles based on dashboard configuration */}
      <style>{`
        .dashboard-grid-container {
          --dashboard-primary: ${primaryColor};
        }

        .dashboard-grid.edit-mode .grid-item {
          cursor: grab;
        }

        .dashboard-grid.edit-mode .grid-item:active {
          cursor: grabbing;
        }

        .dashboard-grid .react-grid-item.react-grid-placeholder {
          background: ${primaryColor}15;
          border: 2px dashed ${primaryColor}50;
          border-radius: ${dashboardStyles.widgetDefaults.border.radius}px;
          transition: all 200ms ease;
        }

        .dashboard-grid .react-grid-item.dragging {
          z-index: 1000;
          transform: rotate(2deg);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .dashboard-grid .react-grid-item.resizing {
          z-index: 999;
          opacity: 0.8;
        }

        .dashboard-grid .react-resizable-handle {
          background-color: ${primaryColor}15;
          border: 1px solid ${primaryColor}30;
        }

        .dashboard-grid .react-resizable-handle:hover {
          background-color: ${primaryColor}30;
          border-color: ${primaryColor}50;
        }
      `}</style>
    </div>
  );
};

export default DashboardGrid;
