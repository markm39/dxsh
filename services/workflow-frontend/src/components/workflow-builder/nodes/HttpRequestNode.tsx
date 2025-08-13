import React from "react";
import { Handle, Position } from "reactflow";
import { 
  Globe2, 
  Loader2, 
  Play, 
  AlertTriangle, 
  CheckCircle,
  Settings,
  Lock,
  Trash2
} from "lucide-react";
import { NodeData } from "../types";
import { DataType, ExecutionStatus, WorkflowNodeData } from "../workflow-types";

interface HttpRequestNodeProps {
  data: NodeData & WorkflowNodeData & {
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

const HttpRequestNode: React.FC<HttpRequestNodeProps> = ({ data, onRunFromHere, onDelete }) => {
  const hasResult = data.executionResult !== undefined;
  const isError = data.executionStatus === ExecutionStatus.ERROR || 
                 (hasResult && data.executionError);
  const isExecuting = data.isExecuting || data.executionStatus === ExecutionStatus.RUNNING;
  const isCached = data.executionStatus === ExecutionStatus.CACHED;

  // Get HTTP configuration
  const httpConfig = data.httpRequest || {};
  const isConfigured = data.configured && httpConfig.url;
  
  // Determine if authentication is configured
  const hasAuth = httpConfig.authType && httpConfig.authType !== 'none';

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
        icon: <Globe2 className="w-3 h-3" />
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
    if (isExecuting) return "Calling API...";
    if (isError) return "Request Failed";
    if (isCached) return "Cached Response";
    if (hasResult) {
      const result = data.executionResult;
      if (result?.status) {
        return `${result.status} ${result.status < 300 ? 'OK' : 'Error'}`;
      }
      return "Response Received";
    }
    if (isConfigured) return "Ready to Call";
    return "Configure API";
  };

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'text-green-400 bg-green-500/10';
      case 'POST': return 'text-blue-400 bg-blue-500/10';
      case 'PUT': return 'text-orange-400 bg-orange-500/10';
      case 'DELETE': return 'text-red-400 bg-red-500/10';
      case 'PATCH': return 'text-purple-400 bg-purple-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
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
    <div className={`bg-surface border-2 rounded-lg p-3 min-w-[240px] shadow-sm hover:shadow-md transition-all duration-200 ${getNodeBorderClass()}`}>
      {/* Input Handle - can accept input for dynamic parameters */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-background"
        title="Input data for dynamic parameters/body"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-lg flex items-center justify-center transition-all duration-200 ${isExecuting ? 'animate-pulse bg-indigo-500/30' : ''}`}>
            {isExecuting ? (
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            ) : (
              <Globe2 className="w-4 h-4 text-indigo-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">
              {data.label}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-muted">HTTP Request</span>
              {hasAuth && (
                <span title="Authentication configured">
                  <Lock className="w-3 h-3 text-green-400" />
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-1">
          {isConfigured && (
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

      {/* URL and Method Info */}
      {httpConfig.url && (
        <div className="text-xs text-text-muted mb-2 bg-surface-secondary/30 px-2 py-1 rounded border border-border-subtle/50">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${getMethodColor(httpConfig.method)}`}>
              {httpConfig.method || 'GET'}
            </span>
            {hasAuth && (
              <span className="text-green-400 text-xs">
                {httpConfig.authType?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="truncate font-mono" title={httpConfig.url}>
            {httpConfig.url.length > 40 ? `${httpConfig.url.substring(0, 37)}...` : httpConfig.url}
          </div>
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
            <div className="w-12 h-1 bg-indigo-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
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


      {/* Output Handle */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-background"
        title="HTTP response data"
      />
      
      {/* Output data type label */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
          {DataType.STRUCTURED_DATA}
        </span>
      </div>
    </div>
  );
};

export default HttpRequestNode;