/**
 * Model Widget Component
 * 
 * Dashboard widget for displaying ML model interfaces with prediction forms
 */

import React from 'react';
import type { DashboardWidget, ModelWidgetConfig } from '@shared/types';
import { useWidgetData } from '../../hooks/useWidgetData';
import { useAuthHeaders } from '../../providers/AuthProvider';
import { AlertTriangle, Brain, Loader, RefreshCw } from 'lucide-react';

// Import model widget components from frontend
import { 
  createModelWidget,
  validateModelData,
  type ModelData,
  type PredictionResult
} from '../../../../frontend/src/components/widgets/model-widgets/index';

interface ModelWidgetProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
}

const ModelWidget: React.FC<ModelWidgetProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
}) => {
  const config = widget.config as ModelWidgetConfig;
  const { data, isLoading, error, isError, refreshData } = useWidgetData(dashboardId, widget);
  const authHeaders = useAuthHeaders();

  // Debug logging for the hook results
  console.log('ModelWidget useWidgetData results:', {
    dashboardId,
    widgetId: widget.id,
    dataSource: widget.dataSource,
    data,
    isLoading,
    error,
    isError
  });

  // Process and validate model data
  const modelData = React.useMemo(() => {
    if (!data) return null;

    // Debug logging to understand the data structure
    console.log('Model widget received data:', {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
      data: data
    });

    // Handle different data structures more flexibly
    let processedData: any = null;

    // Try multiple extraction patterns like chart widgets do
    if (data.success && data.model) {
      // ML training API response: { success: true, model: {...}, visualization_data: [...] }
      console.log('Found model in success response:', data.model);
      processedData = data.model;
    } else if (Array.isArray(data) && data.length > 0) {
      // Array data - check first item
      const firstItem = data[0];
      if (firstItem.model) {
        processedData = firstItem.model;
      } else if (firstItem.modelData) {
        processedData = firstItem.modelData;
      } else if (firstItem.success && firstItem.model) {
        processedData = firstItem.model;
      }
    } else if (data.modelData) {
      // Direct model data object
      processedData = data.modelData;
    } else if (data.model) {
      // Alternative structure
      processedData = data.model;
    } else if (data.id && data.type && data.name) {
      // Raw model data that looks like a model
      processedData = data;
    }

    if (!processedData) {
      console.warn('No model data found in:', data);
      return null;
    }

    console.log('Extracted model data:', processedData);

    // Map backend model types to frontend model types
    const mapModelType = (backendType: string): string => {
      const typeMap: { [key: string]: string } = {
        'linear_regression': 'linearRegression',
        'random_forest': 'randomForest',
        'logistic_regression': 'logisticRegression',
        'neural_network': 'neuralNetwork'
      };
      return typeMap[backendType] || backendType;
    };

    // Transform the ML model data structure to match widget expectations
    // Extract coefficients from visualization_data if available
    const coefficientsFromViz: { [key: string]: number } = {};
    if (data.visualization_data?.feature_importance) {
      data.visualization_data.feature_importance.forEach((item: any) => {
        if (item.feature && item.coefficient !== undefined) {
          coefficientsFromViz[item.feature] = item.coefficient;
        }
      });
    }

    const transformedData = {
      id: processedData.id,
      type: mapModelType(processedData.model_type || processedData.type), // map backend type to frontend type
      name: processedData.model_name || processedData.name, // map model_name to name
      description: processedData.description || `${processedData.model_type || processedData.type} model`,
      schema: {
        features: processedData.feature_names ? processedData.feature_names.map((name: string, index: number) => ({
          name,
          type: 'number', // default to number for now
          displayName: name,
          required: true
        })) : [],
        target: {
          name: processedData.target_name || 'target',
          type: 'number',
          displayName: processedData.target_name || 'Target',
        }
      },
      performance: {
        score: processedData.training_metrics?.train_r2 || processedData.training_metrics?.test_r2 || processedData.training_metrics?.r2_score || 0,
        r_squared: processedData.training_metrics?.train_r2 || processedData.training_metrics?.r2_score,
        mean_squared_error: processedData.training_metrics?.train_mse || processedData.training_metrics?.test_mse || processedData.training_metrics?.mse,
        mean_absolute_error: processedData.training_metrics?.train_mae || processedData.training_metrics?.test_mae || processedData.training_metrics?.mae,
        accuracy: processedData.training_metrics?.accuracy,
        feature_importance: (() => {
          // Try multiple sources for feature importance
          if (data.visualization_data?.feature_importance) {
            // Linear regression style (from visualization_data with coefficients)
            return data.visualization_data.feature_importance.map((item: any) => ({
              feature: item.feature,
              importance: Math.abs(item.coefficient || item.importance || 0)
            }));
          } else if (processedData.feature_importance) {
            // Direct feature importance array
            return processedData.feature_importance;
          } else if (processedData.training_metrics?.feature_importance) {
            // Feature importance in training metrics
            return processedData.training_metrics.feature_importance;
          }
          return [];
        })(),
        training_info: {
          training_date: processedData.created_at || new Date().toISOString(),
          dataset_size: processedData.n_samples || 0,
        }
      },
      model_data: {
        ...processedData.model_metadata || {},
        coefficients: Object.keys(coefficientsFromViz).length > 0 ? coefficientsFromViz :
                     processedData.model_metadata?.coefficients || 
                     processedData.training_metrics?.coefficients || {}
      },
      visualizations: data.visualization_data ? [
        // Transform visualization data to expected format
        {
          type: 'scatter',
          title: 'Actual vs Predicted',
          data: data.visualization_data.actual_vs_predicted
        },
        {
          type: 'bar',
          title: 'Feature Importance',
          data: data.visualization_data.feature_importance
        },
        {
          type: 'scatter',
          title: 'Residuals',
          data: data.visualization_data.residuals
        }
      ] : [],
      created_at: processedData.created_at || new Date().toISOString(),
      updated_at: processedData.updated_at || new Date().toISOString(),
      version: '1.0'
    };

    console.log('Transformed model data:', transformedData);

    // More lenient validation - only require essential fields
    if (!transformedData.id || !transformedData.type || !transformedData.name) {
      console.warn('Model data missing essential fields after transformation:', transformedData);
      return null;
    }

    return transformedData as ModelData;
  }, [data]);

  // Handle predictions through API
  const handlePredict = React.useCallback(async (inputs: { [feature: string]: any }): Promise<PredictionResult> => {
    if (!modelData) {
      throw new Error('No model data available');
    }

    try {
      // Make prediction API call to the correct backend port
      const API_BASE_URL = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ml/models/${modelData.id}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ 
          input_data: [inputs]  // Backend expects array of input objects
        }),
      });

      if (!response.ok) {
        throw new Error(`Prediction failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Transform backend response to PredictionResult format
      if (result.success && result.predictions && result.predictions.length > 0) {
        return {
          value: result.predictions[0], // First prediction (we sent single input)
          explanation: {
            featureContributions: [], // Could be enhanced later with SHAP values
            summary: `Prediction made using ${modelData.type} model`
          }
        } as PredictionResult;
      } else {
        throw new Error(result.error || 'Prediction failed');
      }
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    }
  }, [modelData, widget.id, authHeaders]);

  // Handle model updates
  const handleModelUpdate = React.useCallback(async (updates: Partial<ModelData>): Promise<void> => {
    if (!modelData) return;

    try {
      const API_BASE_URL = import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ml/models/${modelData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }

      // Refresh widget data
      refreshData();
    } catch (error) {
      console.error('Model update error:', error);
      throw error;
    }
  }, [modelData, refreshData, authHeaders]);

  // Get appropriate widget component
  const ModelWidgetComponent = React.useMemo(() => {
    if (!modelData) return null;
    return createModelWidget(modelData.type);
  }, [modelData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] p-4">
        <div className="text-center">
          <Loader className="h-8 w-8 text-blue-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary mb-1">
            Loading Model
          </p>
          <p className="text-xs text-text-muted">
            Fetching model data and configuration...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-2">
            Failed to Load Model
          </p>
          <p className="text-xs text-text-muted mb-4">
            {error?.message || 'Unable to load model data from the connected source.'}
          </p>
          <button
            onClick={() => refreshData()}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition-colors flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No model data - show debug info
  if (!modelData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] p-4">
        <div className="text-center max-w-md">
          <Brain className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-2">
            No Model Data
          </p>
          {data ? (
            <div className="mb-4">
              <p className="text-xs text-text-muted mb-2">
                Raw data received (check console for details):
              </p>
              <div className="bg-surface rounded border p-2 text-left max-h-32 overflow-y-auto">
                <pre className="text-xs text-text-secondary">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted mb-4">
              Connect this widget to a trained ML model node to display model interface.
            </p>
          )}
          {isEditMode && (
            <p className="text-xs text-blue-400">
              Configure the data source in widget settings
            </p>
          )}
        </div>
      </div>
    );
  }

  // Invalid model component
  if (!ModelWidgetComponent) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] p-4">
        <div className="text-center">
          <AlertTriangle className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-text-primary mb-1">
            Unsupported Model Type
          </p>
          <p className="text-xs text-text-muted">
            Model type '{modelData.type}' is not yet supported
          </p>
        </div>
      </div>
    );
  }

  // Debug the config
  console.log('ModelWidget config passed to component:', {
    widgetId: widget.id,
    showHeader: config.showHeader,
    showTabs: config.showTabs,
    allowedTabs: config.allowedTabs,
    modelType: modelData?.type,
    timestamp: new Date().toISOString(),
    fullConfig: config
  });

  // Render model widget
  return (
    <div className="h-full w-full overflow-hidden">
      <div className="h-full overflow-auto">
        <ModelWidgetComponent
          modelData={modelData}
          onPredict={handlePredict}
          onUpdateModel={handleModelUpdate}
          config={{
            showPredictionForm: config.showPredictionForm ?? true,
            showPerformance: config.showPerformance ?? true,
            showVisualizations: config.showVisualizations ?? true,
            showExplanation: config.showExplanation ?? false,
            defaultTab: config.defaultTab || 'predict',
            compact: config.compact ?? false,
            showHeader: config.showHeader !== undefined ? config.showHeader : true,
            showTabs: config.showTabs !== undefined ? config.showTabs : true,
            allowedTabs: config.allowedTabs,
          }}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default ModelWidget;