import React from "react";
import { Handle, Position } from "reactflow";
import { BarChart3, Loader2, Play, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { NodeData } from "../types";

interface ChartGeneratorNodeProps {
  data: NodeData;
  onRunFromHere?: () => void;
  onDelete?: () => void;
}

const ChartGeneratorNode: React.FC<ChartGeneratorNodeProps> = ({ data, onRunFromHere, onDelete }) => {
  const hasResult = data.executionResult !== undefined;
  const isError = hasResult && (!data.executionResult || data.executionResult.length === 0);
  const isExecuting = data.isExecuting;

  const handleRunFromHere = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the config modal
    if (onRunFromHere && !isExecuting) {
      onRunFromHere();
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the config modal
    if (onDelete) {
      onDelete();
    }
  };

  // Enhanced status styling
  const getStatusStyles = () => {
    if (isExecuting) {
      return {
        textColor: "text-green-400",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/30",
        nodeBorder: "border-green-500/50 shadow-green-500/20"
      };
    }
    if (isError) {
      return {
        textColor: "text-red-400", 
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        nodeBorder: "border-red-500/50 shadow-red-500/20"
      };
    }
    if (hasResult && !isError) {
      return {
        textColor: "text-green-400",
        bgColor: "bg-green-500/10", 
        borderColor: "border-green-500/30",
        nodeBorder: "border-green-500/50 shadow-green-500/20"
      };
    }
    return {
      textColor: "text-text-muted",
      bgColor: "bg-surface-secondary/30",
      borderColor: "border-border-subtle/50",
      nodeBorder: "border-border-subtle hover:border-primary/30"
    };
  };

  const getStatusText = () => {
    if (isExecuting) return "Generating...";
    if (isError) return "Failed";
    if (hasResult) return "Chart Ready";
    return data.configured ? "Ready" : "Configure";
  };

  const statusStyles = getStatusStyles();

  return (
    <div className={`bg-background border-2 rounded-lg p-4 min-w-[200px] shadow-sm hover:shadow-md transition-all duration-200 ${statusStyles.nodeBorder}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center transition-all duration-200 ${isExecuting ? 'animate-pulse bg-green-500/30' : ''}`}>
            {isExecuting ? (
              <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4 text-green-400" />
            )}
          </div>
          <span className="text-sm font-medium text-text-primary">
            {data.label}
          </span>
        </div>
        
        <div className="flex gap-1">
          {data.configured && onRunFromHere && (
            <button
              onClick={handleRunFromHere}
              disabled={isExecuting}
              className={`p-1.5 rounded-md transition-colors hover:bg-primary/20 text-primary hover:text-primary ${
                isExecuting ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Run workflow from this node"
            >
              <Play className="h-3 w-3" />
            </button>
          )}

          {/* Delete button - always visible */}
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isExecuting}
              className={`p-1.5 rounded-md transition-colors ${
                isExecuting
                  ? "opacity-50 cursor-not-allowed text-text-muted"
                  : "hover:bg-red-500/20 text-red-400 hover:text-red-300"
              }`}
              title="Delete this node"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {data.chartGenerator && (
        <div className="text-xs text-text-muted mb-2 truncate">
          {data.chartGenerator.chartType || 'Chart Generation'}
        </div>
      )}

      {/* Enhanced Status Display */}
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border ${statusStyles.bgColor} ${statusStyles.borderColor} ${statusStyles.textColor}`}>
        {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
        {isError && <AlertTriangle className="w-3 h-3" />}
        {hasResult && !isError && !isExecuting && <CheckCircle className="w-3 h-3" />}
        
        <span className="text-xs font-medium">
          {getStatusText()}
        </span>
        
        {/* Progress indicator for execution */}
        {isExecuting && (
          <div className="ml-auto">
            <div className="w-12 h-1 bg-green-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Current Output Data Display */}
      {hasResult && data.executionResult && (
        <div className="mt-2 p-2 bg-surface-secondary/30 rounded border border-border-subtle/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-secondary">Current Output:</span>
          </div>
          <div className="text-xs text-text-muted bg-background/50 p-1.5 rounded border border-border-subtle/30 max-h-16 overflow-y-auto">
            <div className="font-mono">
              {data.executionResult.chartType && (
                <div><strong>Type:</strong> {data.executionResult.chartType}</div>
              )}
              {data.executionResult.title && (
                <div><strong>Title:</strong> {data.executionResult.title}</div>
              )}
              {data.executionResult.data && (
                <div><strong>Data:</strong> {Array.isArray(data.executionResult.data) ? `${data.executionResult.data.length} items` : 'Ready'}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
};

export default ChartGeneratorNode;