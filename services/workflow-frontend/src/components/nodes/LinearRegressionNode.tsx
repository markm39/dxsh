import React from 'react';
import { Handle, Position } from 'reactflow';
import { TrendingUp, Loader2, CheckCircle, AlertCircle, Brain, Play } from 'lucide-react';

interface LinearRegressionNodeProps {
  data: {
    label: string;
    configured: boolean;
    model?: any;
    modelConfig?: any;
    isTraining?: boolean;
    trainingResult?: any;
    executionResult?: any;
    isExecuting?: boolean;
    hasError?: boolean;
    canRunFromHere?: boolean;
    runFromHereReason?: string;
  };
  onRunFromHere?: () => void;
}

const LinearRegressionNode: React.FC<LinearRegressionNodeProps> = ({ data, onRunFromHere }) => {
  const { 
    label, 
    configured = false, 
    model,
    modelConfig, 
    isTraining = false, 
    trainingResult, 
    executionResult,
    isExecuting = false,
    hasError = false
  } = data;

  // Use model config from either model or modelConfig for backward compatibility
  const actualModelConfig = model || modelConfig;

  // Determine node status
  const getNodeStatus = () => {
    if (hasError) return 'error';
    if (isTraining || isExecuting) return 'training';
    if (executionResult || trainingResult) return 'completed';
    if (configured) return 'configured';
    return 'unconfigured';
  };

  const status = getNodeStatus();

  // Enhanced status styling matching other nodes
  const getStatusStyles = () => {
    switch (status) {
      case 'error':
        return {
          textColor: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          nodeBorder: "border-red-500/50 shadow-red-500/20",
          icon: <AlertCircle className="w-3 h-3 text-red-400" />
        };
      case 'training':
        return {
          textColor: "text-orange-400",
          bgColor: "bg-orange-500/10",
          borderColor: "border-orange-500/30",
          nodeBorder: "border-orange-500/50 shadow-orange-500/20",
          icon: <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
        };
      case 'completed':
        return {
          textColor: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          nodeBorder: "border-green-500/50 shadow-green-500/20",
          icon: <CheckCircle className="w-3 h-3 text-green-400" />
        };
      case 'configured':
        return {
          textColor: "text-purple-400",
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-500/30",
          nodeBorder: "border-purple-500/50 shadow-purple-500/20",
          icon: <Brain className="w-3 h-3 text-purple-400" />
        };
      default:
        return {
          textColor: "text-text-muted",
          bgColor: "bg-surface-secondary/30",
          borderColor: "border-border-subtle/50",
          nodeBorder: "border-border-subtle hover:border-primary/30",
          icon: null
        };
    }
  };

  const styles = getStatusStyles();

  // Get training metrics if available
  const getTrainingMetrics = () => {
    if (executionResult?.model?.training_metrics) {
      return executionResult.model.training_metrics;
    }
    if (trainingResult?.training_metrics) {
      return trainingResult.training_metrics;
    }
    return null;
  };

  const handleRunFromHere = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the config modal
    if (onRunFromHere && !isTraining && !isExecuting && data.canRunFromHere !== false) {
      onRunFromHere();
    }
  };

  const metrics = getTrainingMetrics();

  return (
    <div className={`bg-background border-2 rounded-lg p-4 min-w-[200px] max-w-[250px] shadow-sm hover:shadow-md transition-all duration-200 ${styles.nodeBorder}`}>
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center justify-center transition-all duration-200 ${isTraining || isExecuting ? 'animate-pulse bg-orange-500/30' : ''}`}>
            {isTraining || isExecuting ? (
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4 text-orange-400" />
            )}
          </div>
          <span className="text-sm font-medium text-text-primary">
            {label}
          </span>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-1">
          {configured && onRunFromHere && (
            <button
              onClick={handleRunFromHere}
              disabled={isTraining || isExecuting || data.canRunFromHere === false}
              className={`p-1.5 rounded-md transition-colors ${
                data.canRunFromHere === false
                  ? "opacity-50 cursor-not-allowed text-text-muted"
                  : "hover:bg-primary/20 text-primary hover:text-primary"
              }`}
              title={data.runFromHereReason || "Run workflow from this node"}
            >
              <Play className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Model Configuration Info */}
      {configured && actualModelConfig && (
        <div className="text-xs text-text-muted mb-2">
          <div>Model: {actualModelConfig.modelType?.replace('_', ' ').toUpperCase()}</div>
          {actualModelConfig.testSize && (
            <div>Test Size: {Math.round(actualModelConfig.testSize * 100)}%</div>
          )}
          {actualModelConfig.normalize !== undefined && (
            <div>Normalized: {actualModelConfig.normalize ? 'Yes' : 'No'}</div>
          )}
        </div>
      )}

      {/* Enhanced Status Display */}
      <div className={`flex items-center gap-2 px-2 py-1.5 mb-3 rounded-md border ${styles.bgColor} ${styles.borderColor} ${styles.textColor}`}>
        {styles.icon}
        <span className="text-xs font-medium">
          {status === 'training' ? 'Training...' : 
           status === 'error' ? 'Failed' :
           status === 'completed' ? 'Completed' :
           status === 'configured' ? 'Ready' : 'Configure'}
        </span>
        
        {/* Progress indicator for training */}
        {(isTraining || isExecuting) && (
          <div className="ml-auto">
            <div className="w-12 h-1 bg-orange-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
        
        {/* Success checkmark animation */}
        {status === 'completed' && !(isTraining || isExecuting) && (
          <div className="ml-auto animate-pulse">
            <CheckCircle className="w-3 h-3 text-green-400" />
          </div>
        )}
      </div>

      {/* Current Output Data Display */}
      {(executionResult || trainingResult) && (
        <div className="mb-3 p-2 bg-surface-secondary/30 rounded border border-border-subtle/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-secondary">Current Output:</span>
          </div>
          <div className="text-xs text-text-muted bg-background/50 p-1.5 rounded border border-border-subtle/30 space-y-1">
            {executionResult?.prediction !== undefined && (
              <div><strong>Prediction:</strong> {executionResult.prediction}</div>
            )}
            {executionResult?.r_squared !== undefined && (
              <div><strong>R² Score:</strong> {executionResult.r_squared.toFixed(4)}</div>
            )}
            {(executionResult || trainingResult) && (
              <div className="text-xs text-text-muted">Model trained and ready</div>
            )}
          </div>
        </div>
      )}

      {/* Training Metrics */}
      {metrics && (
        <div className="text-xs text-text-muted space-y-1">
          <div className="font-medium text-text-primary">Performance:</div>
          <div className="grid grid-cols-2 gap-1">
            <div>R² Score: {metrics.test_r2?.toFixed(3)}</div>
            <div>MSE: {metrics.test_mse?.toFixed(2)}</div>
          </div>
          {metrics.train_r2 && (
            <div className="text-xs">
              Train R²: {metrics.train_r2.toFixed(3)}
            </div>
          )}
        </div>
      )}

      {/* Model Info */}
      {executionResult?.model && (
        <div className="text-xs text-text-muted mt-2 pt-2 border-t border-border-subtle">
          <div>Features: {executionResult.model.n_features}</div>
          <div>Samples: {executionResult.model.n_samples}</div>
          {executionResult.model.target_name && (
            <div>Target: {executionResult.model.target_name}</div>
          )}
        </div>
      )}


      {/* Unconfigured State */}
      {!configured && (
        <div className="text-xs text-text-muted italic">
          Click to configure model training
        </div>
      )}
    </div>
  );
};

export default LinearRegressionNode;