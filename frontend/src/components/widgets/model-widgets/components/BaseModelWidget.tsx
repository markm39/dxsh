import React, { useState, useEffect } from 'react';
import { Calculator, BarChart3, Eye, HelpCircle } from 'lucide-react';
import { ModelWidgetProps, PredictionResult } from '../types';
import { PredictionForm } from './PredictionForm';
import { PerformanceDisplay } from './PerformanceDisplay';
import { ModelVisualization } from './ModelVisualization';
import { createPredictionHook } from '../hooks/usePrediction';

/**
 * Base model widget with tabbed interface
 * Provides common structure for all model types
 */
export const BaseModelWidget: React.FC<ModelWidgetProps> = ({
  modelData,
  onPredict,
  onUpdateModel,
  config = {},
  className = ''
}) => {
  // Debug config received by BaseModelWidget
  console.log('BaseModelWidget received config:', {
    showHeader: config.showHeader,
    showTabs: config.showTabs,
    modelType: modelData?.type,
    timestamp: new Date().toISOString(),
    fullConfig: config
  });

  const {
    showPredictionForm = true,
    showPerformance = true,
    showVisualizations = true,
    showExplanation = false,
    defaultTab = 'predict',
    height = 600,
    compact = false,
    showHeader = true,
    showTabs = true,
    allowedTabs
  } = config;

  const usePrediction = createPredictionHook(onPredict);
  const { loading, result, error, clear } = usePrediction();

  const tabs = [
    {
      id: 'predict',
      label: 'Predict',
      icon: Calculator,
      show: showPredictionForm,
      description: 'Make predictions with the model'
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: BarChart3,
      show: showPerformance,
      description: 'View model accuracy and metrics'
    },
    {
      id: 'visualize',
      label: 'Visualize',
      icon: Eye,
      show: showVisualizations,
      description: 'Explore model insights and patterns'
    },
    {
      id: 'explain',
      label: 'Explain',
      icon: HelpCircle,
      show: showExplanation,
      description: 'Understand how the model works'
    }
  ].filter(tab => {
    // First filter by show property
    if (!tab.show) return false;
    // Then filter by allowedTabs if specified
    if (allowedTabs && !allowedTabs.includes(tab.id as any)) return false;
    return true;
  });

  // Determine the correct initial tab - use defaultTab if it's available, otherwise use first available tab
  const getValidDefaultTab = () => {
    const isDefaultTabValid = tabs.some(tab => tab.id === defaultTab);
    return isDefaultTabValid ? defaultTab : (tabs[0]?.id || 'predict');
  };

  const [activeTab, setActiveTab] = useState<string>(getValidDefaultTab());
  
  // Update active tab when configuration changes
  useEffect(() => {
    const validTab = getValidDefaultTab();
    if (activeTab !== validTab && !tabs.some(tab => tab.id === activeTab)) {
      setActiveTab(validTab);
    }
  }, [showPredictionForm, showPerformance, showVisualizations, showExplanation, allowedTabs, defaultTab]);

  const activeTabData = tabs.find(tab => tab.id === activeTab) || tabs[0];

  return (
    <div 
      className={`${className}`}
      style={{ height: compact ? 'auto' : height }}
    >
      {/* Header */}
      {showHeader && (
        <div className="border-b border-border-subtle p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{modelData.name}</h2>
              {modelData.description && (
                <p className="text-sm text-text-secondary mt-1">{modelData.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <span className="text-xs font-medium text-blue-400 capitalize">
                  {modelData.type.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
              
              <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <span className="text-xs font-medium text-green-400">
                  v{modelData.version}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      {showTabs && tabs.length > 1 && (
        <div className="border-b border-border-subtle">
          <nav className="flex space-x-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                      : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-secondary/50'
                  }`}
                  title={tab.description}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'predict' && showPredictionForm && (
          <div className="p-6">
            <PredictionForm
              schema={modelData.schema}
              onPredict={onPredict}
              loading={loading}
              result={result}
            />
          </div>
        )}

        {activeTab === 'performance' && showPerformance && (
          <div className="p-6">
            <PerformanceDisplay
              performance={modelData.performance}
              modelType={modelData.type}
            />
          </div>
        )}

        {activeTab === 'visualize' && showVisualizations && (
          <div className="p-6">
            <ModelVisualizations
              visualizations={modelData.visualizations}
              modelType={modelData.type}
            />
          </div>
        )}

        {activeTab === 'explain' && showExplanation && (
          <div className="p-6">
            <ModelExplanation
              modelData={modelData}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Model visualizations component
 * Renders charts and graphs based on model type
 */
interface ModelVisualizationsProps {
  visualizations: Array<{
    id: string;
    title: string;
    type: string;
    data: any;
    config?: any;
  }>;
  modelType: string;
}

const ModelVisualizations: React.FC<ModelVisualizationsProps> = ({
  visualizations,
  modelType
}) => {
  if (visualizations.length === 0) {
    return (
      <div className="text-center py-12">
        <Eye className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">No Visualizations Available</h3>
        <p className="text-text-secondary">
          Visualizations will appear here once the model has been trained and analyzed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
          <Eye className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Model Insights</h3>
          <p className="text-sm text-text-secondary">
            Visual analysis of model behavior and patterns
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visualizations.map((viz, index) => (
          <ModelVisualization
            key={viz.id || index}
            visualization={viz as any}
            className="h-full"
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Model explanation component
 * Provides insights into how the model works
 */
interface ModelExplanationProps {
  modelData: any;
}

const ModelExplanation: React.FC<ModelExplanationProps> = ({ modelData }) => {
  const getModelExplanation = () => {
    switch (modelData.type) {
      case 'linearRegression':
        return {
          title: 'Linear Regression',
          description: 'This model predicts a continuous target variable by finding the best linear relationship between input features and the target.',
          howItWorks: [
            'The model learns coefficients (weights) for each input feature',
            'Predictions are made by multiplying each feature by its coefficient and summing the results',
            'Higher coefficient values indicate stronger influence on the prediction',
            'The R² score shows how well the linear relationship explains the data variance'
          ],
          interpretation: 'Look at the coefficients to understand which features have the strongest positive or negative impact on predictions.'
        };
      
      case 'randomForest':
        return {
          title: 'Random Forest',
          description: 'This ensemble model combines many decision trees to make robust predictions and reduce overfitting.',
          howItWorks: [
            'Multiple decision trees are trained on random subsets of the data',
            'Each tree votes on the final prediction',
            'Feature importance is calculated based on how much each feature improves predictions across all trees',
            'The model is less prone to overfitting than individual decision trees'
          ],
          interpretation: 'Feature importance scores show which variables are most valuable for making accurate predictions.'
        };
      
      default:
        return {
          title: modelData.type,
          description: 'Machine learning model for predictive analysis.',
          howItWorks: ['Model processes input features to generate predictions'],
          interpretation: 'Review performance metrics to understand model quality.'
        };
    }
  };

  const explanation = getModelExplanation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">How This Model Works</h3>
          <p className="text-sm text-text-secondary">
            Understanding the algorithm and interpretation
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Model Description */}
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <h4 className="font-medium text-text-primary mb-2">{explanation.title}</h4>
          <p className="text-text-secondary">{explanation.description}</p>
        </div>

        {/* How It Works */}
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <h4 className="font-medium text-text-primary mb-3">How It Works</h4>
          <ul className="space-y-2">
            {explanation.howItWorks.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-sm text-text-secondary">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Interpretation Guide */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <h4 className="font-medium text-amber-400 mb-2">Interpretation Guide</h4>
          <p className="text-sm text-text-secondary">{explanation.interpretation}</p>
        </div>

        {/* Model Features */}
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <h4 className="font-medium text-text-primary mb-3">Input Features</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modelData.schema.features.map((feature: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-surface-secondary rounded">
                <span className="text-sm font-medium text-text-primary">
                  {feature.displayName || feature.name}
                </span>
                <span className="text-xs text-text-muted capitalize">
                  {feature.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};