/**
 * Dashboard Settings Modal Component
 *
 * Comprehensive dashboard settings with styling, widget controls, and more
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Settings,
  Check,
  Eye,
  EyeOff,
  Palette,
  Layout,
  Sliders,
} from 'lucide-react';
import { useDashboard } from '../../providers/DashboardProvider';
import { DashboardStyleEditor } from '../styling';
import type { DashboardStyles } from '../../types/styling';
import { DEFAULT_DASHBOARD_STYLES } from '../../types/styling';

interface DashboardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WidgetDisplaySettings {
  id: string;
  title: string;
  type: string;
  showHeader: boolean;
  showFooter: boolean;
}

type SettingsTab = 'styling' | 'widgets' | 'layout';

const DashboardSettingsModal: React.FC<DashboardSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, updateWidget, updateDashboard } = useDashboard();
  const [activeTab, setActiveTab] = useState<SettingsTab>('styling');
  const [widgetSettings, setWidgetSettings] = useState<WidgetDisplaySettings[]>([]);
  const [dashboardStyles, setDashboardStyles] = useState<DashboardStyles>(
    DEFAULT_DASHBOARD_STYLES
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Initialize settings when modal opens
  useEffect(() => {
    if (isOpen && state.currentDashboard) {
      // Widget display settings
      const settings = state.currentDashboard.widgets.map((widget) => ({
        id: widget.id,
        title: widget.title || 'Untitled',
        type: widget.type,
        showHeader: widget.showHeader ?? true,
        showFooter: widget.showFooter ?? true,
      }));
      setWidgetSettings(settings);

      // Dashboard styles
      const displaySettings = state.currentDashboard.displaySettings || {};
      setDashboardStyles({
        ...DEFAULT_DASHBOARD_STYLES,
        ...displaySettings.styles,
      });

      setHasChanges(false);
    }
  }, [isOpen, state.currentDashboard]);

  const updateWidgetSetting = useCallback(
    (widgetId: string, setting: 'showHeader' | 'showFooter', value: boolean) => {
      setWidgetSettings((prev) =>
        prev.map((widget) =>
          widget.id === widgetId ? { ...widget, [setting]: value } : widget
        )
      );
      setHasChanges(true);
    },
    []
  );

  const toggleAllHeaders = useCallback((enabled: boolean) => {
    setWidgetSettings((prev) =>
      prev.map((widget) => ({ ...widget, showHeader: enabled }))
    );
    setHasChanges(true);
  }, []);

  const toggleAllFooters = useCallback((enabled: boolean) => {
    setWidgetSettings((prev) =>
      prev.map((widget) => ({ ...widget, showFooter: enabled }))
    );
    setHasChanges(true);
  }, []);

  const toggleByType = useCallback(
    (type: string, setting: 'showHeader' | 'showFooter', enabled: boolean) => {
      setWidgetSettings((prev) =>
        prev.map((widget) =>
          widget.type === type ? { ...widget, [setting]: enabled } : widget
        )
      );
      setHasChanges(true);
    },
    []
  );

  const handleStylesChange = useCallback((styles: DashboardStyles) => {
    setDashboardStyles(styles);
    setHasChanges(true);
  }, []);

  const applyChanges = async () => {
    if (!state.currentDashboard || !hasChanges) return;

    setIsApplying(true);
    try {
      // Update widget display settings
      for (const widgetSetting of widgetSettings) {
        const currentWidget = state.currentDashboard.widgets.find(
          (w) => w.id === widgetSetting.id
        );
        if (currentWidget) {
          await updateWidget(widgetSetting.id, {
            showHeader: widgetSetting.showHeader,
            showFooter: widgetSetting.showFooter,
          });
        }
      }

      // Update dashboard styles
      await updateDashboard({
        displaySettings: {
          ...state.currentDashboard.displaySettings,
          styles: dashboardStyles,
        },
      });

      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Failed to apply settings:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const groupedByType = widgetSettings.reduce(
    (acc, widget) => {
      if (!acc[widget.type]) {
        acc[widget.type] = [];
      }
      acc[widget.type].push(widget);
      return acc;
    },
    {} as Record<string, WidgetDisplaySettings[]>
  );

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: 'styling', label: 'Styling', icon: Palette },
    { id: 'widgets', label: 'Widgets', icon: Layout },
    { id: 'layout', label: 'Layout', icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border-subtle rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-text-primary">
                Dashboard Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-text-muted" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 border-b border-border-subtle -mb-[1px]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
                  border-b-2 -mb-[1px]
                  ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-subtle'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Styling Tab */}
          {activeTab === 'styling' && (
            <div>
              <p className="text-text-secondary mb-6">
                Customize the appearance of your dashboard with themes, colors,
                typography, and more.
              </p>
              <DashboardStyleEditor
                value={dashboardStyles}
                onChange={handleStylesChange}
              />
            </div>
          )}

          {/* Widgets Tab */}
          {activeTab === 'widgets' && (
            <div>
              {/* Bulk Controls */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-text-primary mb-4">
                  Bulk Controls
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-text-secondary">
                      All Widgets
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAllHeaders(true)}
                        className="px-3 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Show All Headers
                      </button>
                      <button
                        onClick={() => toggleAllHeaders(false)}
                        className="px-3 py-2 bg-surface-secondary hover:bg-surface-secondary/70 text-text-primary text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        <EyeOff className="h-4 w-4" />
                        Hide All Headers
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAllFooters(true)}
                        className="px-3 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Show All Footers
                      </button>
                      <button
                        onClick={() => toggleAllFooters(false)}
                        className="px-3 py-2 bg-surface-secondary hover:bg-surface-secondary/70 text-text-primary text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        <EyeOff className="h-4 w-4" />
                        Hide All Footers
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-text-secondary">
                      By Widget Type
                    </h4>
                    <div className="space-y-2">
                      {Object.keys(groupedByType).map((type) => (
                        <div
                          key={type}
                          className="flex items-center justify-between p-2 bg-surface-secondary/30 rounded-lg"
                        >
                          <span className="text-sm font-medium text-text-primary capitalize">
                            {type} ({groupedByType[type].length})
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                toggleByType(
                                  type,
                                  'showHeader',
                                  !groupedByType[type][0]?.showHeader
                                )
                              }
                              className={`p-1 rounded text-xs transition-colors ${
                                groupedByType[type].every((w) => w.showHeader)
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/70'
                              }`}
                              title="Toggle headers"
                            >
                              H
                            </button>
                            <button
                              onClick={() =>
                                toggleByType(
                                  type,
                                  'showFooter',
                                  !groupedByType[type][0]?.showFooter
                                )
                              }
                              className={`p-1 rounded text-xs transition-colors ${
                                groupedByType[type].every((w) => w.showFooter)
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/70'
                              }`}
                              title="Toggle footers"
                            >
                              F
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Widget Controls */}
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-4">
                  Individual Widget Controls
                </h3>
                <div className="space-y-3">
                  {widgetSettings.map((widget) => (
                    <div
                      key={widget.id}
                      className="flex items-center justify-between p-4 bg-surface-secondary/30 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-text-primary">
                          {widget.title}
                        </div>
                        <div className="text-sm text-text-secondary capitalize">
                          {widget.type} widget
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={widget.showHeader}
                            onChange={(e) =>
                              updateWidgetSetting(
                                widget.id,
                                'showHeader',
                                e.target.checked
                              )
                            }
                            className="rounded border-border-subtle"
                          />
                          <span className="text-text-secondary">Show Header</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={widget.showFooter}
                            onChange={(e) =>
                              updateWidgetSetting(
                                widget.id,
                                'showFooter',
                                e.target.checked
                              )
                            }
                            className="rounded border-border-subtle"
                          />
                          <span className="text-text-secondary">Show Footer</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === 'layout' && (
            <div>
              <p className="text-text-secondary mb-6">
                Configure grid layout, spacing, and responsive behavior.
              </p>

              <div className="space-y-6">
                {/* Grid Gap */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Grid Gap: {dashboardStyles.grid.gap}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="48"
                    value={dashboardStyles.grid.gap}
                    onChange={(e) =>
                      handleStylesChange({
                        ...dashboardStyles,
                        grid: {
                          ...dashboardStyles.grid,
                          gap: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Grid Padding */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Grid Padding
                  </label>
                  <div className="grid grid-cols-4 gap-4">
                    {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                      <div key={side}>
                        <label className="block text-xs text-text-muted mb-1 capitalize">
                          {side}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={dashboardStyles.grid.padding[side]}
                          onChange={(e) =>
                            handleStylesChange({
                              ...dashboardStyles,
                              grid: {
                                ...dashboardStyles.grid,
                                padding: {
                                  ...dashboardStyles.grid.padding,
                                  [side]: parseInt(e.target.value, 10) || 0,
                                },
                              },
                            })
                          }
                          className="w-full px-2 py-1.5 bg-surface-secondary border border-border-subtle rounded text-sm text-text-primary focus:border-primary focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact Mode */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        state.currentDashboard?.displaySettings?.compactMode ||
                        false
                      }
                      onChange={(e) =>
                        updateDashboard({
                          displaySettings: {
                            ...state.currentDashboard?.displaySettings,
                            compactMode: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-border-subtle"
                    />
                    <span className="text-sm text-text-secondary">
                      Compact Mode (reduce spacing between widgets)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle bg-surface-secondary/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              {hasChanges ? 'You have unsaved changes' : 'No changes made'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyChanges}
                disabled={!hasChanges || isApplying}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-surface-secondary disabled:text-text-muted text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettingsModal;
