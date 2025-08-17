import React, { useState } from 'react';
import { Sparkles, RefreshCw, Settings } from 'lucide-react';
import { createMockLinearRegressionWidget } from './LinearRegressionWidget';
import { ModelWidgetProps } from './types';

/**
 * Demo component for testing and showcasing model widgets
 * Useful for development and testing the model widget system
 */
export const ModelWidgetDemo: React.FC = () => {
  const [widgetConfig, setWidgetConfig] = useState({
    showPredictionForm: true,
    showPerformance: true,
    showVisualizations: true,
    showExplanation: true,
    defaultTab: 'predict' as const,
    compact: false
  });

  const { widget: LinearRegressionDemo, mockData } = createMockLinearRegressionWidget();

  const toggleConfig = (key: keyof typeof widgetConfig) => {
    setWidgetConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary">Model Widget System</h1>
          </div>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Interactive machine learning model interfaces with prediction forms, 
            performance metrics, and visualizations. Test the Linear Regression widget below.
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-surface rounded-lg border border-border-subtle p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-text-primary" />
            <h3 className="font-medium text-text-primary">Widget Configuration</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={widgetConfig.showPredictionForm}
                onChange={() => toggleConfig('showPredictionForm')}
                className="rounded border-border-subtle"
              />
              <span className="text-sm text-text-secondary">Prediction Form</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={widgetConfig.showPerformance}
                onChange={() => toggleConfig('showPerformance')}
                className="rounded border-border-subtle"
              />
              <span className="text-sm text-text-secondary">Performance</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={widgetConfig.showVisualizations}
                onChange={() => toggleConfig('showVisualizations')}
                className="rounded border-border-subtle"
              />
              <span className="text-sm text-text-secondary">Visualizations</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={widgetConfig.showExplanation}
                onChange={() => toggleConfig('showExplanation')}
                className="rounded border-border-subtle"
              />
              <span className="text-sm text-text-secondary">Explanation</span>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={widgetConfig.compact}
                onChange={() => toggleConfig('compact')}
                className="rounded border-border-subtle"
              />
              <span className="text-sm text-text-secondary">Compact Mode</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Default Tab:</span>
              <select
                value={widgetConfig.defaultTab}
                onChange={(e) => setWidgetConfig(prev => ({
                  ...prev,
                  defaultTab: e.target.value as any
                }))}
                className="text-sm bg-surface border border-border-subtle rounded px-2 py-1"
              >
                <option value="predict">Predict</option>
                <option value="performance">Performance</option>
                <option value="visualize">Visualize</option>
                <option value="explain">Explain</option>
              </select>
            </div>
          </div>
        </div>

        {/* Model Info Card */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Demo Model Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">Model Type:</span>
                  <span className="ml-2 font-medium text-blue-400 capitalize">
                    {mockData.type.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Features:</span>
                  <span className="ml-2 font-medium text-text-primary">
                    {mockData.schema.features.length}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">R² Score:</span>
                  <span className="ml-2 font-medium text-green-400">
                    {(mockData.performance.r_squared! * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Demo
            </button>
          </div>
          
          <p className="text-text-secondary">{mockData.description}</p>
        </div>

        {/* Model Widget */}
        <LinearRegressionDemo
          config={widgetConfig}
          className="shadow-lg"
        />

        {/* Usage Instructions */}
        <div className="bg-surface rounded-lg border border-border-subtle p-6">
          <h3 className="font-medium text-text-primary mb-4">How to Use This Widget</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-text-primary mb-2">Making Predictions</h4>
              <ul className="space-y-1 text-text-secondary">
                <li>• Enter property details in the Predict tab</li>
                <li>• All fields have sensible defaults</li>
                <li>• Click "Make Prediction" to get results</li>
                <li>• View confidence scores and explanations</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-text-primary mb-2">Understanding Performance</h4>
              <ul className="space-y-1 text-text-secondary">
                <li>• R² score shows model accuracy (87%)</li>
                <li>• Feature coefficients show impact</li>
                <li>• Training info shows model details</li>
                <li>• Higher scores indicate better predictions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <details className="bg-surface rounded-lg border border-border-subtle">
          <summary className="p-4 cursor-pointer font-medium text-text-primary hover:bg-surface-secondary">
            Technical Implementation Details
          </summary>
          <div className="p-4 border-t border-border-subtle space-y-4">
            <div>
              <h4 className="font-medium text-text-primary mb-2">Architecture</h4>
              <p className="text-sm text-text-secondary mb-2">
                The model widget system uses a modular architecture with reusable components:
              </p>
              <ul className="text-sm text-text-secondary space-y-1 ml-4">
                <li>• <code className="bg-surface-secondary px-1 rounded">BaseModelWidget</code> - Common tabbed interface</li>
                <li>• <code className="bg-surface-secondary px-1 rounded">PredictionForm</code> - Input form with validation</li>
                <li>• <code className="bg-surface-secondary px-1 rounded">PerformanceDisplay</code> - Metrics and charts</li>
                <li>• <code className="bg-surface-secondary px-1 rounded">LinearRegressionWidget</code> - Specialized implementation</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-text-primary mb-2">Features</h4>
              <ul className="text-sm text-text-secondary space-y-1 ml-4">
                <li>• Type-safe TypeScript interfaces</li>
                <li>• Reusable validation hooks</li>
                <li>• Configurable widget behavior</li>
                <li>• Mock data for development</li>
                <li>• Extensible for new model types</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default ModelWidgetDemo;