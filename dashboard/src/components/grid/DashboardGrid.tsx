/**
 * Dashboard Grid Component
 * 
 * Responsive grid layout with drag-and-drop using React Grid Layout
 */

import React, { useCallback, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import type { DashboardWidget } from '@shared/types';
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
  const { updateWidget, setDragging, setResizing } = useDashboard();

  // Convert widgets to grid layout format
  const layouts = useMemo(() => {
    const layout: Layout[] = widgets.map(widget => ({
      i: String(widget.id),
      x: widget.position.x,
      y: widget.position.y,
      w: widget.position.w,
      h: widget.position.h,
      minW: widget.position.minW || 1, // Allow single column width
      maxW: widget.position.maxW || 24, // Allow up to 24 columns (double the default)
      minH: widget.position.minH || 1, // Allow single row height
      maxH: widget.position.maxH || 20, // Allow up to 20 rows (much taller)
      isDraggable: isEditMode && (widget.position.isDraggable !== false),
      isResizable: isEditMode && (widget.position.isResizable !== false),
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
  const handleLayoutChange = useCallback((layout: Layout[]) => {
    if (!isEditMode) return;

    layout.forEach((item) => {
      const widget = widgets.find(w => String(w.id) === String(item.i));
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
  }, [widgets, updateWidget, isEditMode]);

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

  // Empty state
  if (widgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-border-subtle rounded-lg">
        <div className="text-center">
          <p className="text-text-secondary mb-2">No widgets yet</p>
          {isEditMode && (
            <p className="text-sm text-text-muted">
              Add widgets to get started
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveGridLayout
        layouts={layouts}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={60}
        margin={[16, 16]}
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
        // Responsive behavior
        measureBeforeMount={false}
        className={`dashboard-grid ${isEditMode ? 'edit-mode' : 'view-mode'}`}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="grid-item">
            <WidgetContainer
              dashboardId={dashboardId}
              widget={widget}
              isEditMode={isEditMode}
            />
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Grid styles */}
      <style jsx>{`
        .dashboard-grid.edit-mode .grid-item {
          cursor: grab;
        }
        
        .dashboard-grid.edit-mode .grid-item:active {
          cursor: grabbing;
        }
        
        .dashboard-grid .react-grid-item.react-grid-placeholder {
          background: rgba(0, 212, 255, 0.1);
          border: 2px dashed rgba(0, 212, 255, 0.3);
          border-radius: 6px;
          transition: all 200ms ease;
        }
        
        .dashboard-grid .react-grid-item.dragging {
          z-index: 1000;
          transform: rotate(2deg);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        
        .dashboard-grid .react-grid-item.resizing {
          z-index: 999;
          opacity: 0.8;
        }
        
        .dashboard-grid .react-resizable-handle {
          background-color: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
        }
        
        .dashboard-grid .react-resizable-handle:hover {
          background-color: rgba(0, 212, 255, 0.2);
          border-color: rgba(0, 212, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

export default DashboardGrid;