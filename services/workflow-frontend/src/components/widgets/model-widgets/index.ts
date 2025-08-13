/**
 * Model Widgets Export
 * 
 * Provides a comprehensive system for displaying ML model interfaces
 * with prediction forms, performance metrics, and visualizations.
 */

// Core types
export * from './types';

// Base components
export { BaseModelWidget } from './components/BaseModelWidget';
export { PredictionForm } from './components/PredictionForm';
export { PerformanceDisplay } from './components/PerformanceDisplay';
export { ModelVisualization } from './components/ModelVisualization';

// Hooks
export { usePrediction, createPredictionHook } from './hooks/usePrediction';
export { 
  useModelValidation, 
  getDefaultValues, 
  formatValue, 
  parseInputValue 
} from './hooks/useModelValidation';

// Specific model widgets
export { 
  LinearRegressionWidget, 
  createMockLinearRegressionWidget 
} from './LinearRegressionWidget';
export { 
  RandomForestWidget, 
  createMockRandomForestWidget 
} from './RandomForestWidget';

// Widget factory and utilities
import { ModelType, ModelWidgetProps } from './types';
import { LinearRegressionWidget } from './LinearRegressionWidget';
import { RandomForestWidget } from './RandomForestWidget';
import { BaseModelWidget } from './components/BaseModelWidget';

/**
 * Factory function to create the appropriate widget for a model type
 */
export function createModelWidget(modelType: ModelType): React.FC<ModelWidgetProps> {
  switch (modelType) {
    case 'linearRegression':
      return LinearRegressionWidget;
    
    case 'randomForest':
      return RandomForestWidget;
    
    case 'logisticRegression':
      // TODO: Implement LogisticRegressionWidget  
      return BaseModelWidget;
    
    case 'neuralNetwork':
      // TODO: Implement NeuralNetworkWidget
      return BaseModelWidget;
    
    default:
      // Fallback to base widget for unknown types
      return BaseModelWidget;
  }
}

/**
 * Get available model types
 */
export function getAvailableModelTypes(): Array<{
  type: ModelType;
  displayName: string;
  description: string;
  implemented: boolean;
}> {
  return [
    {
      type: 'linearRegression',
      displayName: 'Linear Regression',
      description: 'Predicts continuous values using linear relationships',
      implemented: true
    },
    {
      type: 'randomForest',
      displayName: 'Random Forest', 
      description: 'Ensemble method using multiple decision trees',
      implemented: true
    },
    {
      type: 'logisticRegression',
      displayName: 'Logistic Regression',
      description: 'Classification using logistic function',
      implemented: false
    },
    {
      type: 'neuralNetwork',
      displayName: 'Neural Network',
      description: 'Deep learning model with multiple layers',
      implemented: false
    }
  ];
}

/**
 * Validate model data structure
 */
export function validateModelData(modelData: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!modelData.id) errors.push('Model ID is required');
  if (!modelData.type) errors.push('Model type is required');
  if (!modelData.name) errors.push('Model name is required');
  if (!modelData.schema) errors.push('Model schema is required');
  if (!modelData.performance) errors.push('Model performance data is required');

  // Schema validation
  if (modelData.schema) {
    if (!Array.isArray(modelData.schema.features)) {
      errors.push('Schema features must be an array');
    }
    if (!modelData.schema.target) {
      errors.push('Schema target is required');
    }
  }

  // Performance validation
  if (modelData.performance) {
    if (typeof modelData.performance.score !== 'number') {
      errors.push('Performance score must be a number');
    }
    if (!modelData.performance.training_info) {
      errors.push('Training info is required in performance data');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get default tab for a given config
 */
export function getDefaultTabForConfig(config: any): string {
  if (config.showPredictionForm) return 'predict';
  if (config.showPerformance) return 'performance';
  if (config.showVisualizations) return 'visualize';
  if (config.showExplanation) return 'explain';
  return 'predict';
}