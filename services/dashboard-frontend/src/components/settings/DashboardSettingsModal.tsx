/**
 * Dashboard Settings Modal Component
 * 
 * Provides bulk controls for widget display settings
 */

import React, { useState, useEffect } from 'react';
import { X, Settings, Check, Eye, EyeOff } from 'lucide-react';
import { useDashboard } from '../../providers/DashboardProvider';

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

const DashboardSettingsModal: React.FC<DashboardSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, updateWidget } = useDashboard();
  const [widgetSettings, setWidgetSettings] = useState<WidgetDisplaySettings[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Initialize widget settings when modal opens
  useEffect(() => {
    if (isOpen && state.currentDashboard) {
      console.log('SETTINGS MODAL: Initializing with widgets:', state.currentDashboard.widgets.map(w => ({
        id: w.id,
        title: w.title,
        showHeader: w.showHeader,
        showFooter: w.showFooter
      })));
      
      const settings = state.currentDashboard.widgets.map(widget => ({
        id: widget.id,
        title: widget.title || 'Untitled',
        type: widget.type,
        showHeader: widget.showHeader ?? true,
        showFooter: widget.showFooter ?? true,
      }));
      
      console.log('SETTINGS MODAL: Created settings:', settings);
      setWidgetSettings(settings);
      setHasChanges(false);
    }
  }, [isOpen, state.currentDashboard]);

  const updateWidgetSetting = (widgetId: string, setting: 'showHeader' | 'showFooter', value: boolean) => {
    setWidgetSettings(prev => 
      prev.map(widget => 
        widget.id === widgetId 
          ? { ...widget, [setting]: value }
          : widget
      )
    );
    setHasChanges(true);
  };

  const toggleAllHeaders = (enabled: boolean) => {
    setWidgetSettings(prev => 
      prev.map(widget => ({ ...widget, showHeader: enabled }))
    );
    setHasChanges(true);
  };

  const toggleAllFooters = (enabled: boolean) => {
    setWidgetSettings(prev => 
      prev.map(widget => ({ ...widget, showFooter: enabled }))
    );
    setHasChanges(true);
  };

  const toggleByType = (type: string, setting: 'showHeader' | 'showFooter', enabled: boolean) => {
    setWidgetSettings(prev => 
      prev.map(widget => 
        widget.type === type 
          ? { ...widget, [setting]: enabled }
          : widget
      )
    );
    setHasChanges(true);
  };

  const applyChanges = async () => {
    if (!state.currentDashboard || !hasChanges) return;

    setIsApplying(true);
    try {
      // Update each widget with new settings
      for (const widgetSetting of widgetSettings) {
        const currentWidget = state.currentDashboard.widgets.find(w => w.id === widgetSetting.id);
        if (currentWidget) {
          await updateWidget(widgetSetting.id, {
            showHeader: widgetSetting.showHeader,
            showFooter: widgetSetting.showFooter,
          });
        }
      }
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Failed to apply settings:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const groupedByType = widgetSettings.reduce((acc, widget) => {
    if (!acc[widget.type]) {
      acc[widget.type] = [];
    }
    acc[widget.type].push(widget);
    return acc;
  }, {} as Record<string, WidgetDisplaySettings[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border-subtle rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-text-primary">Dashboard Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-text-muted" />
            </button>
          </div>
          <p className="text-text-secondary mt-2">
            Control which widgets show headers and footers
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Bulk Controls */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-text-primary mb-4">Bulk Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-text-secondary">All Widgets</h4>
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
                <h4 className="text-sm font-medium text-text-secondary">By Widget Type</h4>
                <div className="space-y-2">
                  {Object.keys(groupedByType).map(type => (
                    <div key={type} className="flex items-center justify-between p-2 bg-surface-secondary/30 rounded-lg">
                      <span className="text-sm font-medium text-text-primary capitalize">
                        {type} ({groupedByType[type].length})
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleByType(type, 'showHeader', !groupedByType[type][0]?.showHeader)}
                          className={`p-1 rounded text-xs transition-colors ${
                            groupedByType[type].every(w => w.showHeader)
                              ? 'bg-primary text-white'
                              : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/70'
                          }`}
                          title="Toggle headers"
                        >
                          H
                        </button>
                        <button
                          onClick={() => toggleByType(type, 'showFooter', !groupedByType[type][0]?.showFooter)}
                          className={`p-1 rounded text-xs transition-colors ${
                            groupedByType[type].every(w => w.showFooter)
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
            <h3 className="text-lg font-medium text-text-primary mb-4">Individual Widget Controls</h3>
            <div className="space-y-3">
              {widgetSettings.map(widget => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-4 bg-surface-secondary/30 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-text-primary">{widget.title}</div>
                    <div className="text-sm text-text-secondary capitalize">{widget.type} widget</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={widget.showHeader}
                        onChange={(e) => updateWidgetSetting(widget.id, 'showHeader', e.target.checked)}
                        className="rounded border-border-subtle"
                      />
                      <span className="text-text-secondary">Show Header</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={widget.showFooter}
                        onChange={(e) => updateWidgetSetting(widget.id, 'showFooter', e.target.checked)}
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

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle bg-surface-secondary/30">
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