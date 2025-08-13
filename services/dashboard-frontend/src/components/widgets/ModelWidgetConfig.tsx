/**
 * Model Widget Configuration Component
 * 
 * Configuration interface for model dashboard widgets
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Brain, Settings, Eye, BarChart3, Calculator, HelpCircle } from 'lucide-react';
import type { DashboardWidget, ModelWidgetConfig } from '@shared/types';

interface ModelWidgetConfigProps {
  dashboardId: string;
  widget: DashboardWidget;
  onSave: (config: ModelWidgetConfig) => void;
  onClose: () => void;
}

const ModelWidgetConfigComponent: React.FC<ModelWidgetConfigProps> = ({
  dashboardId,
  widget,
  onSave,
  onClose,
}) => {
  const [config, setConfig] = useState<ModelWidgetConfig>(
    widget.config as ModelWidgetConfig || {
      showPredictionForm: true,
      showPerformance: true,
      showVisualizations: true,
      showExplanation: false,
      defaultTab: 'predict',
      compact: false,
      showHeader: true,
      showTabs: true,
      allowedTabs: undefined,
    }
  );

  const handleConfigUpdate = (updates: Partial<ModelWidgetConfig>) => {
    setConfig((prev: ModelWidgetConfig) => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    console.log('ModelWidgetConfig saving config:', config);
    onSave(config);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Model Widget Configuration</h3>
              <p className="text-sm text-text-secondary">
                Configure which parts of the model interface to display
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

      {/* Interface Components */}
      <div className="space-y-4">
        <h4 className="font-medium text-text-primary flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Interface Components
        </h4>

        <div className="space-y-3">
          {/* Prediction Form */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.showPredictionForm}
              onChange={(e) => handleConfigUpdate({ showPredictionForm: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex items-center gap-2 flex-1">
              <Calculator className="w-4 h-4 text-blue-400" />
              <div>
                <div className="font-medium text-text-primary">Prediction Form</div>
                <div className="text-xs text-text-muted">Interactive form for making predictions</div>
              </div>
            </div>
          </label>

          {/* Performance Metrics */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.showPerformance}
              onChange={(e) => handleConfigUpdate({ showPerformance: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex items-center gap-2 flex-1">
              <BarChart3 className="w-4 h-4 text-green-400" />
              <div>
                <div className="font-medium text-text-primary">Performance Metrics</div>
                <div className="text-xs text-text-muted">Model accuracy and training statistics</div>
              </div>
            </div>
          </label>

          {/* Visualizations */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.showVisualizations}
              onChange={(e) => handleConfigUpdate({ showVisualizations: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex items-center gap-2 flex-1">
              <Eye className="w-4 h-4 text-purple-400" />
              <div>
                <div className="font-medium text-text-primary">Visualizations</div>
                <div className="text-xs text-text-muted">Charts and graphs showing model insights</div>
              </div>
            </div>
          </label>

          {/* Explanations */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.showExplanation}
              onChange={(e) => handleConfigUpdate({ showExplanation: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex items-center gap-2 flex-1">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-medium text-text-primary">Model Explanation</div>
                <div className="text-xs text-text-muted">How the model works and interpretation guide</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Display Options */}
      <div className="space-y-4">
        <h4 className="font-medium text-text-primary flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Display Options
        </h4>

        <div className="space-y-4">
          {/* Default Tab */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Default Tab</label>
            <select
              value={config.defaultTab || 'predict'}
              onChange={(e) => handleConfigUpdate({ defaultTab: e.target.value as any })}
              className="w-full bg-surface text-text-primary p-2 rounded-lg border border-border-subtle focus:border-purple-500 focus:outline-none"
            >
              {config.showPredictionForm && (
                <option value="predict">Prediction Form</option>
              )}
              {config.showPerformance && (
                <option value="performance">Performance Metrics</option>
              )}
              {config.showVisualizations && (
                <option value="visualize">Visualizations</option>
              )}
              {config.showExplanation && (
                <option value="explain">Model Explanation</option>
              )}
            </select>
            <p className="text-xs text-text-muted">
              Which tab should be shown first when the widget loads
            </p>
          </div>

          {/* Compact Mode */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.compact}
              onChange={(e) => handleConfigUpdate({ compact: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Compact Mode</div>
              <div className="text-xs text-text-muted">
                Use smaller layout suitable for smaller dashboard tiles
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Layout Options */}
      <div className="space-y-4">
        <h4 className="font-medium text-text-primary flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Layout Options
        </h4>

        <div className="space-y-4">
          {/* Show Header */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.showHeader}
              onChange={(e) => handleConfigUpdate({ showHeader: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Show Header</div>
              <div className="text-xs text-text-muted">
                Display model name, type, and version at the top
              </div>
            </div>
          </label>

          {/* Show Tabs */}
          <label className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle cursor-pointer hover:bg-surface-secondary transition-colors">
            <input
              type="checkbox"
              checked={config.showTabs}
              onChange={(e) => handleConfigUpdate({ showTabs: e.target.checked })}
              className="rounded border-border-subtle"
            />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Show Tab Navigation</div>
              <div className="text-xs text-text-muted">
                Display tabs when multiple components are enabled
              </div>
            </div>
          </label>

          {/* Allowed Tabs */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Visible Tabs</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!config.allowedTabs || config.allowedTabs.includes('predict')}
                  onChange={(e) => {
                    const currentTabs = config.allowedTabs || ['predict', 'performance', 'visualize', 'explain'];
                    if (e.target.checked) {
                      const newTabs = [...new Set([...currentTabs, 'predict' as const])];
                      handleConfigUpdate({ allowedTabs: newTabs });
                    } else {
                      const newTabs = currentTabs.filter((tab: string) => tab !== 'predict');
                      handleConfigUpdate({ allowedTabs: newTabs.length > 0 ? newTabs : ['performance'] });
                    }
                  }}
                  className="rounded border-border-subtle"
                />
                <Calculator className="w-3 h-3 text-blue-400" />
                <span className="text-text-primary">Prediction Form</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!config.allowedTabs || config.allowedTabs.includes('performance')}
                  onChange={(e) => {
                    const currentTabs = config.allowedTabs || ['predict', 'performance', 'visualize', 'explain'];
                    if (e.target.checked) {
                      const newTabs = [...new Set([...currentTabs, 'performance'])];
                      handleConfigUpdate({ allowedTabs: newTabs });
                    } else {
                      const newTabs = currentTabs.filter((tab: string) => tab !== 'performance');
                      handleConfigUpdate({ allowedTabs: newTabs.length > 0 ? newTabs : ['predict'] });
                    }
                  }}
                  className="rounded border-border-subtle"
                />
                <BarChart3 className="w-3 h-3 text-green-400" />
                <span className="text-text-primary">Performance</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!config.allowedTabs || config.allowedTabs.includes('visualize')}
                  onChange={(e) => {
                    const currentTabs = config.allowedTabs || ['predict', 'performance', 'visualize', 'explain'];
                    if (e.target.checked) {
                      const newTabs = [...new Set([...currentTabs, 'visualize'])];
                      handleConfigUpdate({ allowedTabs: newTabs });
                    } else {
                      const newTabs = currentTabs.filter((tab: string) => tab !== 'visualize');
                      handleConfigUpdate({ allowedTabs: newTabs.length > 0 ? newTabs : ['predict'] });
                    }
                  }}
                  className="rounded border-border-subtle"
                />
                <Eye className="w-3 h-3 text-purple-400" />
                <span className="text-text-primary">Visualizations</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!config.allowedTabs || config.allowedTabs.includes('explain')}
                  onChange={(e) => {
                    const currentTabs = config.allowedTabs || ['predict', 'performance', 'visualize', 'explain'];
                    if (e.target.checked) {
                      const newTabs = [...new Set([...currentTabs, 'explain'])];
                      handleConfigUpdate({ allowedTabs: newTabs });
                    } else {
                      const newTabs = currentTabs.filter((tab: string) => tab !== 'explain');
                      handleConfigUpdate({ allowedTabs: newTabs.length > 0 ? newTabs : ['predict'] });
                    }
                  }}
                  className="rounded border-border-subtle"
                />
                <HelpCircle className="w-3 h-3 text-amber-400" />
                <span className="text-text-primary">Explanation</span>
              </label>
            </div>
            <p className="text-xs text-text-muted">
              Choose which tabs are visible in the widget. At least one must be selected.
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <h4 className="font-medium text-blue-400 mb-2">Configuration Preview</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Enabled Components:</span>
            <span className="text-text-primary">
              {[
                config.showPredictionForm && 'Prediction',
                config.showPerformance && 'Performance',
                config.showVisualizations && 'Visualizations',
                config.showExplanation && 'Explanation'
              ].filter(Boolean).length} / 4
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Default Tab:</span>
            <span className="text-text-primary capitalize">
              {config.defaultTab || 'predict'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Layout:</span>
            <span className="text-text-primary">
              {config.compact ? 'Compact' : 'Full Size'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Header:</span>
            <span className="text-text-primary">
              {config.showHeader ? 'Visible' : 'Hidden'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Tab Navigation:</span>
            <span className="text-text-primary">
              {config.showTabs ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {config.allowedTabs && (
            <div className="flex justify-between">
              <span className="text-text-muted">Visible Tabs:</span>
              <span className="text-text-primary">
                {config.allowedTabs.length} selected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Data Source Info */}
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <h4 className="font-medium text-amber-400 mb-2">Data Source Requirements</h4>
        <div className="text-sm text-text-secondary space-y-1">
          <p>• Connect to a trained ML model node</p>
          <p>• Model data must include schema and performance metrics</p>
          <p>• Supported model types: Linear Regression, Random Forest, etc.</p>
        </div>
      </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <button
                onClick={onClose}
                className="px-4 py-2 text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ModelWidgetConfigComponent;