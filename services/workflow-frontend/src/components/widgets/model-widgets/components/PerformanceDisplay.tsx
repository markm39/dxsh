import React from 'react';
import { BarChart3, Target, Calendar, Database, Clock, TrendingUp, Award } from 'lucide-react';
import { PerformanceDisplayProps, ModelType } from '../types';

/**
 * Reusable performance display component
 * Shows model performance metrics and training information
 */
export const PerformanceDisplay: React.FC<PerformanceDisplayProps> = ({
  performance,
  modelType,
  className = ''
}) => {
  const getPrimaryMetrics = () => {
    switch (modelType) {
      case 'linearRegression':
        return [
          { label: 'R² Score', value: performance.r_squared, format: 'percentage', description: 'Coefficient of determination' },
          { label: 'RMSE', value: performance.root_mean_squared_error, format: 'decimal', description: 'Root Mean Squared Error' },
          { label: 'MAE', value: performance.mean_absolute_error, format: 'decimal', description: 'Mean Absolute Error' }
        ];
      
      case 'randomForest':
        return [
          { label: 'Accuracy', value: performance.accuracy, format: 'percentage', description: 'Overall prediction accuracy' },
          { label: 'R² Score', value: performance.r_squared, format: 'percentage', description: 'Coefficient of determination' },
          { label: 'RMSE', value: performance.root_mean_squared_error, format: 'decimal', description: 'Root Mean Squared Error' }
        ];
      
      case 'logisticRegression':
        return [
          { label: 'Accuracy', value: performance.accuracy, format: 'percentage', description: 'Overall prediction accuracy' },
          { label: 'Precision', value: performance.precision, format: 'percentage', description: 'Positive prediction accuracy' },
          { label: 'Recall', value: performance.recall, format: 'percentage', description: 'True positive rate' },
          { label: 'F1 Score', value: performance.f1_score, format: 'percentage', description: 'Harmonic mean of precision and recall' }
        ];
      
      default:
        return [
          { label: 'Score', value: performance.score, format: 'percentage', description: 'Model performance score' }
        ];
    }
  };

  const formatValue = (value: number | undefined, format: 'percentage' | 'decimal' | 'integer'): string => {
    if (value === undefined || value === null) return 'N/A';
    
    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'decimal':
        return value.toFixed(4);
      case 'integer':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  const getScoreColor = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'text-text-muted';
    
    if (value >= 0.8) return 'text-green-400';
    if (value >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const primaryMetrics = getPrimaryMetrics();

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Model Performance</h3>
          <p className="text-sm text-text-secondary">
            Training metrics and model quality indicators
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {primaryMetrics.filter(metric => metric.value !== undefined).map((metric, idx) => (
            <div key={idx} className="bg-surface-secondary rounded-lg border border-border-subtle p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">{metric.label}</span>
                <Target className="w-4 h-4 text-text-muted" />
              </div>
              
              <div className={`text-2xl font-bold mb-1 ${getScoreColor(metric.value)}`}>
                {formatValue(metric.value, metric.format)}
              </div>
              
              <p className="text-xs text-text-muted">{metric.description}</p>
              
              {/* Visual indicator */}
              {metric.format === 'percentage' && metric.value !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-surface rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${
                        metric.value >= 0.8 ? 'bg-green-500' :
                        metric.value >= 0.6 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, metric.value * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Feature Importance / Coefficients */}
        {(performance.feature_importance || performance.coefficients) && (
          <div className="bg-surface-secondary rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-text-primary" />
              <h4 className="font-medium text-text-primary">
                {performance.feature_importance ? 'Feature Importance' : 'Model Coefficients'}
              </h4>
            </div>
            
            <div className="space-y-2">
              {performance.feature_importance && 
                performance.feature_importance
                  .sort((a, b) => b.importance - a.importance)
                  .slice(0, 5)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">{item.feature}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-surface rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(item.importance * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-text-primary w-12 text-right">
                          {(item.importance * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))
              }
              
              {performance.coefficients && 
                performance.coefficients
                  .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
                  .slice(0, 5)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">{item.feature}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium w-16 text-right ${
                          item.coefficient > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {item.coefficient > 0 ? '+' : ''}{item.coefficient.toFixed(3)}
                        </span>
                        {item.p_value !== undefined && (
                          <span className="text-xs text-text-muted w-16 text-right">
                            p={item.p_value.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

        {/* Training Information */}
        <div className="bg-surface-secondary rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-text-primary" />
            <h4 className="font-medium text-text-primary">Training Information</h4>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-text-muted" />
                <span className="text-xs text-text-muted">Trained</span>
              </div>
              <span className="text-sm font-medium text-text-primary">
                {new Date(performance.training_info.training_date).toLocaleDateString()}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Database className="w-3 h-3 text-text-muted" />
                <span className="text-xs text-text-muted">Dataset Size</span>
              </div>
              <span className="text-sm font-medium text-text-primary">
                {performance.training_info.dataset_size.toLocaleString()} rows
              </span>
            </div>
            
            {performance.training_info.training_time && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-text-muted" />
                  <span className="text-xs text-text-muted">Training Time</span>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {performance.training_info.training_time.toFixed(2)}s
                </span>
              </div>
            )}
            
            {performance.training_info.cross_validation_score && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-text-muted" />
                  <span className="text-xs text-text-muted">CV Score</span>
                </div>
                <span className={`text-sm font-medium ${getScoreColor(performance.training_info.cross_validation_score)}`}>
                  {formatValue(performance.training_info.cross_validation_score, 'percentage')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Metrics for specific model types */}
        {modelType === 'randomForest' && performance.feature_importance && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Random Forest Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Features Used:</span>
                <span className="ml-2 font-medium text-text-primary">
                  {performance.feature_importance.length}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Top Feature:</span>
                <span className="ml-2 font-medium text-blue-400">
                  {performance.feature_importance[0]?.feature || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {modelType === 'linearRegression' && performance.coefficients && (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-400 mb-2">Linear Regression Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Features:</span>
                <span className="ml-2 font-medium text-text-primary">
                  {performance.coefficients.length}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Strongest Effect:</span>
                <span className="ml-2 font-medium text-purple-400">
                  {performance.coefficients
                    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))[0]?.feature || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};