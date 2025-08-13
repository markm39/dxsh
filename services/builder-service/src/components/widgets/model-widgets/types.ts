/**
 * Core types for model widgets
 * Provides a consistent interface for all ML model types
 */

export type ModelType = 'linearRegression' | 'randomForest' | 'neuralNetwork' | 'logisticRegression';

export type FeatureType = 'number' | 'categorical' | 'boolean';

export interface ModelFeature {
  name: string;
  type: FeatureType;
  displayName?: string;
  description?: string;
  
  // For numerical features
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  
  // For categorical features
  options?: string[];
  defaultOption?: string;
  
  // For boolean features
  defaultBoolean?: boolean;
  
  // Validation
  required?: boolean;
  validation?: {
    pattern?: string;
    message?: string;
  };
}

export interface ModelSchema {
  features: ModelFeature[];
  target: {
    name: string;
    type: FeatureType;
    displayName?: string;
    unit?: string; // e.g., "$", "%", "units"
  };
}

export interface PredictionResult {
  value: number | string;
  confidence?: number;
  probability?: number; // for classification
  explanation?: {
    featureContributions: Array<{
      feature: string;
      contribution: number;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    summary?: string;
  };
}

export interface ModelPerformance {
  // Common metrics
  score: number; // R² for regression, accuracy for classification
  
  // Regression-specific
  r_squared?: number;
  mean_squared_error?: number;
  mean_absolute_error?: number;
  root_mean_squared_error?: number;
  
  // Classification-specific
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  
  // Model-specific metrics
  feature_importance?: Array<{
    feature: string;
    importance: number;
  }>;
  
  coefficients?: Array<{
    feature: string;
    coefficient: number;
    p_value?: number;
  }>;
  
  // Training info
  training_info: {
    training_date: string;
    dataset_size: number;
    training_time?: number; // in seconds
    cross_validation_score?: number;
  };
}

export interface ModelVisualization {
  id: string;
  title: string;
  type: 'scatter' | 'bar' | 'line' | 'heatmap' | 'histogram' | 'tree';
  data: any;
  config?: {
    xLabel?: string;
    yLabel?: string;
    color?: string;
    showLegend?: boolean;
    height?: number;
  };
}

export interface ModelData {
  id: string;
  type: ModelType;
  name: string;
  description?: string;
  schema: ModelSchema;
  performance: ModelPerformance;
  
  // Model-specific data
  model_data: {
    // Linear Regression
    coefficients?: { [feature: string]: number };
    intercept?: number;
    
    // Random Forest
    n_estimators?: number;
    max_depth?: number;
    feature_importance?: { [feature: string]: number };
    
    // Raw model data for backend
    serialized_model?: string;
  };
  
  // Visualization configurations
  visualizations: ModelVisualization[];
  
  // Metadata
  created_at: string;
  updated_at: string;
  version: string;
}

export interface ModelWidgetProps {
  modelData: ModelData;
  onPredict: (inputs: { [feature: string]: any }) => Promise<PredictionResult>;
  onUpdateModel?: (updates: Partial<ModelData>) => Promise<void>;
  
  // Widget configuration
  config?: {
    showPredictionForm?: boolean;
    showPerformance?: boolean;
    showVisualizations?: boolean;
    showExplanation?: boolean;
    defaultTab?: 'predict' | 'performance' | 'visualize' | 'explain';
    height?: number;
    compact?: boolean;
    
    // Layout options
    showHeader?: boolean; // Show/hide the model name and version header
    showTabs?: boolean;   // Show/hide the tab navigation (single tab mode)
    allowedTabs?: Array<'predict' | 'performance' | 'visualize' | 'explain'>; // Restrict visible tabs
  };
  
  // Styling
  className?: string;
}

export interface PredictionFormProps {
  schema: ModelSchema;
  onPredict: (inputs: { [feature: string]: any }) => Promise<PredictionResult>;
  loading?: boolean;
  result?: PredictionResult;
  className?: string;
}

export interface PerformanceDisplayProps {
  performance: ModelPerformance;
  modelType: ModelType;
  className?: string;
}

export interface ModelVisualizationProps {
  visualizations: ModelVisualization[];
  modelType: ModelType;
  className?: string;
}

// Utility type for validation
export interface ValidationResult {
  isValid: boolean;
  errors: { [field: string]: string };
}

// Hook return types
export interface UsePredictionReturn {
  predict: (inputs: { [feature: string]: any }) => Promise<PredictionResult>;
  loading: boolean;
  result: PredictionResult | null;
  error: string | null;
  clear: () => void;
}

export interface UseModelValidationReturn {
  validate: (inputs: { [feature: string]: any }) => ValidationResult;
  validateField: (field: string, value: any) => string | null;
}