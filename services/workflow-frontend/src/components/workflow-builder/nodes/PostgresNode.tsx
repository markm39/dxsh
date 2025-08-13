import React from "react";
import { Handle, Position } from "reactflow";
import { 
  Database, 
  Loader2, 
  Play, 
  AlertTriangle, 
  CheckCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings,
  Eye,
  Trash2
} from "lucide-react";
import { NodeData } from "../types";
import { DataType, ExecutionStatus } from "../workflow-types";

interface PostgresNodeProps {
  data: NodeData & {
    // Enhanced properties for typed workflow system
    nodeDefinition?: any;
    cachedOutput?: any;
    executionStatus?: ExecutionStatus;
    canRunFromHere?: boolean;
    runFromHereReason?: string;
  };
  // Optional enhanced execution handler
  onRunFromHere?: () => void;
  // Optional delete handler
  onDelete?: () => void;
}

const PostgresNode: React.FC<PostgresNodeProps> = ({ data, onRunFromHere, onDelete }) => {
  const hasResult = data.executionResult !== undefined;
  const isError = data.executionStatus === ExecutionStatus.ERROR || 
                 (hasResult && data.executionError);
  const isExecuting = data.isExecuting || data.executionStatus === ExecutionStatus.RUNNING;
  const isCached = data.executionStatus === ExecutionStatus.CACHED;
  const hasCache = data.cachedOutput !== undefined;

  // Determine operation mode based on configuration
  const getOperationMode = (): 'source' | 'sink' | 'unconfigured' => {
    const postgresConfig = data.postgres || {};
    
    if (postgresConfig.operationMode) {
      return postgresConfig.operationMode;
    }
    
    // Infer from configuration
    if (postgresConfig.query && !postgresConfig.tableName) {
      return 'source';
    } else if (postgresConfig.tableName && !postgresConfig.query) {
      return 'sink';
    }
    
    return 'unconfigured';
  };

  // Determine if node has proper inputs for sink mode
  const hasInputsForSink = () => {
    return data.inputSources && data.inputSources.length > 0;
  };

  const operationMode = getOperationMode();
  const canOperateAsSink = operationMode === 'sink' && hasInputsForSink();
  const canOperateAsSource = operationMode === 'source';

  const handleRunFromHere = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the config modal
    if (onRunFromHere && !isExecuting && data.canRunFromHere !== false) {
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
        textColor: "text-blue-400",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        icon: <Loader2 className="w-3 h-3 animate-spin" />
      };
    }
    if (isError) {
      return {
        textColor: "text-red-400", 
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        icon: <AlertTriangle className="w-3 h-3" />
      };
    }
    if (hasResult && !isError) {
      return {
        textColor: "text-green-400",
        bgColor: "bg-green-500/10", 
        borderColor: "border-green-500/30",
        icon: <CheckCircle className="w-3 h-3" />
      };
    }
    if (isCached) {
      return {
        textColor: "text-purple-400",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/30", 
        icon: <Database className="w-3 h-3" />
      };
    }
    return {
      textColor: "text-text-muted",
      bgColor: "bg-surface-secondary/30",
      borderColor: "border-border-subtle/50",
      icon: <Settings className="w-3 h-3" />
    };
  };

  const getStatusText = () => {
    if (isExecuting) {
      return operationMode === 'source' ? "Querying..." : "Inserting...";
    }
    if (isError) return "Failed";
    if (isCached) return "Cached Result";
    if (hasResult) {
      const resultCount = Array.isArray(data.executionResult) ? data.executionResult.length : 1;
      return operationMode === 'source' ? `${resultCount} rows` : "Inserted";
    }
    if (data.configured) {
      return operationMode === 'source' ? "Ready to Query" : 
             operationMode === 'sink' ? "Ready to Insert" : "Ready";
    }
    return "Configure";
  };

  const statusStyles = getStatusStyles();

  // Dynamic node border based on execution state
  const getNodeBorderClass = () => {
    if (isExecuting) return "border-blue-500/50 shadow-blue-500/20";
    if (isError) return "border-red-500/50 shadow-red-500/20";
    if (hasResult && !isError) return "border-green-500/50 shadow-green-500/20";
    return "border-border-subtle hover:border-primary/30";
  };

  return (
    <div className={`bg-surface border-2 rounded-lg p-3 min-w-[220px] shadow-sm hover:shadow-md transition-all duration-200 ${getNodeBorderClass()}`}>
      {/* Input Handle - only visible for sink mode */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
        style={{ 
          visibility: operationMode === 'sink' || operationMode === 'unconfigured' ? 'visible' : 'hidden' 
        }}
        title="Input data for database insertion"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center transition-all duration-200 ${isExecuting ? 'animate-pulse bg-purple-500/30' : ''}`}>
            {isExecuting ? (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            ) : (
              <Database className="w-4 h-4 text-purple-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">
              {data.label}
            </span>
            <span className="text-xs text-text-muted">
              PostgreSQL {operationMode !== 'unconfigured' ? `• ${operationMode}` : ''}
            </span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-1">
          {data.configured && (
            <>
              {/* Run from here button */}
              {onRunFromHere && (
                <button
                  onClick={handleRunFromHere}
                  disabled={isExecuting || data.canRunFromHere === false}
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

              {/* Preview button */}
              {hasResult && (
                <button
                  className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors"
                  title="Preview output data"
                >
                  <Eye className="h-3 w-3 text-text-muted hover:text-text-primary" />
                </button>
              )}
            </>
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

      {/* Connection Info */}
      {data.postgres && (
        <div className="text-xs text-text-muted mb-2 truncate bg-surface-secondary/30 px-2 py-1 rounded border border-border-subtle/50">
          {data.postgres.host || 'localhost'}:{data.postgres.port || 5432}/{data.postgres.database || 'db'}
        </div>
      )}

      {/* Operation Mode Indicator */}
      {operationMode !== 'unconfigured' && (
        <div className="flex items-center gap-1 mb-2">
          {operationMode === 'source' ? (
            <ArrowUpFromLine className="w-3 h-3 text-blue-400" />
          ) : (
            <ArrowDownToLine className="w-3 h-3 text-green-400" />
          )}
          <span className="text-xs text-text-muted">
            {operationMode === 'source' ? 'Extract Data' : 'Insert Data'}
          </span>
        </div>
      )}

      {/* Enhanced Status Display */}
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border ${statusStyles.bgColor} ${statusStyles.borderColor} ${statusStyles.textColor}`}>
        {statusStyles.icon}
        <span className="text-xs font-medium">
          {getStatusText()}
        </span>
        
        {/* Progress indicator for execution */}
        {isExecuting && (
          <div className="ml-auto">
            <div className="w-12 h-1 bg-purple-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
        
        {/* Success checkmark animation */}
        {hasResult && !isError && !isExecuting && (
          <div className="ml-auto animate-pulse">
            <CheckCircle className="w-3 h-3 text-green-400" />
          </div>
        )}
      </div>

      {/* Current Output Data Display */}
      {hasResult && data.executionResult && (
        <div className="mt-2 p-2 bg-surface-secondary/30 rounded border border-border-subtle/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-secondary">
              {operationMode === 'source' ? 'Query Results:' : 'Insert Results:'}
            </span>
            <span className="text-xs text-text-muted">
              {Array.isArray(data.executionResult) ? `${data.executionResult.length} rows` : '1 result'}
            </span>
          </div>
          <div className="text-xs text-text-muted bg-background/50 p-1.5 rounded border border-border-subtle/30 max-h-16 overflow-y-auto">
            {Array.isArray(data.executionResult) && data.executionResult.length > 0 ? (
              <div className="space-y-0.5">
                {data.executionResult.slice(0, 2).map((item: any, idx: number) => (
                  <div key={idx} className="font-mono text-xs">
                    {typeof item === 'object' ? JSON.stringify(item).slice(0, 60) + '...' : String(item).slice(0, 60)}
                  </div>
                ))}
                {data.executionResult.length > 2 && (
                  <div className="text-text-muted">... +{data.executionResult.length - 2} more</div>
                )}
              </div>
            ) : (
              <span className="text-text-muted">
                {operationMode === 'source' ? 'No data returned' : 'Operation completed'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Output Handle - only visible for source mode */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
        style={{ 
          visibility: operationMode === 'source' || operationMode === 'unconfigured' ? 'visible' : 'hidden' 
        }}
        title="Output query results"
      />
      
      {/* Output data type label */}
      {(operationMode === 'source' || operationMode === 'unconfigured') && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
            {DataType.STRUCTURED_DATA}
          </span>
        </div>
      )}
    </div>
  );
};

export default PostgresNode;