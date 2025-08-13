import React from "react";
import { Handle, Position } from "reactflow";
import { 
  FileText, 
  Loader2, 
  Play, 
  AlertTriangle, 
  CheckCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings,
  Eye,
  File,
  FileJson,
  FileSpreadsheet,
  FileType,
  Trash2
} from "lucide-react";
import { NodeData } from "../types";
import { DataType, ExecutionStatus } from "../workflow-types";

interface FileNodeProps {
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

const FileNode: React.FC<FileNodeProps> = ({ data, onRunFromHere, onDelete }) => {
  const hasResult = data.executionResult !== undefined;
  const isError = data.executionStatus === ExecutionStatus.ERROR || 
                 (hasResult && data.executionError);
  const isExecuting = data.isExecuting || data.executionStatus === ExecutionStatus.RUNNING;
  const isCached = data.executionStatus === ExecutionStatus.CACHED;
  const hasCache = data.cachedOutput !== undefined;

  // Determine operation mode based on configuration
  const getOperationMode = (): 'source' | 'sink' | 'unconfigured' => {
    const fileConfig = data.fileNode || {};
    
    if (fileConfig.operationMode) {
      return fileConfig.operationMode;
    }
    
    // Infer from configuration
    if (fileConfig.loadFile && !fileConfig.saveFile) {
      return 'source';
    } else if (fileConfig.saveFile && !fileConfig.loadFile) {
      return 'sink';
    }
    
    return 'unconfigured';
  };

  // Determine if node has proper inputs for sink mode
  const hasInputsForSink = () => {
    return data.inputSources && data.inputSources.length > 0;
  };

  // Get file type icon based on file extension
  const getFileTypeIcon = (fileName: string) => {
    if (!fileName) return <FileText className="w-3 h-3" />;
    
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'json':
        return <FileJson className="w-3 h-3" />;
      case 'csv':
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-3 h-3" />;
      case 'txt':
      case 'doc':
      case 'docx':
        return <FileType className="w-3 h-3" />;
      default:
        return <File className="w-3 h-3" />;
    }
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
    e.preventDefault(); // Prevent any default behavior
    
    console.log('🗑️ Delete button clicked for node:', data.id, data.label);
    
    if (onDelete) {
      console.log('🗑️ Calling onDelete for node:', data.id);
      onDelete();
    } else {
      console.warn('🗑️ No onDelete handler provided for node:', data.id);
    }
  };

  // Enhanced status styling
  const getStatusStyles = () => {
    if (isExecuting) {
      return {
        textColor: "text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/30",
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
        textColor: "text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/30", 
        icon: <FileText className="w-3 h-3" />
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
      return operationMode === 'source' ? "Loading..." : "Saving...";
    }
    if (isError) return "Failed";
    if (isCached) return "Cached Result";
    if (hasResult) {
      const resultCount = Array.isArray(data.executionResult) ? data.executionResult.length : 1;
      return operationMode === 'source' ? `${resultCount} records` : "Saved";
    }
    if (data.configured) {
      return operationMode === 'source' ? "Ready to Load" : 
             operationMode === 'sink' ? "Ready to Save" : "Ready";
    }
    return "Configure";
  };

  const statusStyles = getStatusStyles();

  // Dynamic node border based on execution state
  const getNodeBorderClass = () => {
    if (isExecuting) return "border-orange-500/50 shadow-orange-500/20";
    if (isError) return "border-red-500/50 shadow-red-500/20";
    if (hasResult && !isError) return "border-green-500/50 shadow-green-500/20";
    return "border-border-subtle hover:border-primary/30";
  };

  // Get file name for display
  const getFileName = () => {
    const fileConfig = data.fileNode || {};
    return fileConfig.fileName || fileConfig.filePath || 'No file selected';
  };

  return (
    <div className={`bg-surface border-2 rounded-lg p-3 min-w-[220px] shadow-sm hover:shadow-md transition-all duration-200 ${getNodeBorderClass()}`}>
      {/* Input Handle - only visible for sink mode */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
        style={{ 
          visibility: operationMode === 'sink' || operationMode === 'unconfigured' ? 'visible' : 'hidden' 
        }}
        title="Input data for file saving"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center justify-center transition-all duration-200 ${isExecuting ? 'animate-pulse bg-orange-500/30' : ''}`}>
            {isExecuting ? (
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-orange-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">
              {data.label}
            </span>
            <span className="text-xs text-text-muted">
              File Node {operationMode !== 'unconfigured' ? `• ${operationMode}` : ''}
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
              className={`relative z-10 p-1.5 rounded-md transition-colors ${
                isExecuting
                  ? "opacity-50 cursor-not-allowed text-text-muted"
                  : "hover:bg-red-500/20 text-red-400 hover:text-red-300"
              }`}
              title="Delete this node"
              style={{ pointerEvents: 'auto' }} // Ensure button is always clickable
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* File Info */}
      {data.fileNode && (
        <div className="text-xs text-text-muted mb-2 truncate bg-surface-secondary/30 px-2 py-1 rounded border border-border-subtle/50 flex items-center gap-1">
          {getFileTypeIcon(getFileName())}
          <span className="truncate">{getFileName()}</span>
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
            {operationMode === 'source' ? 'Load File' : 'Save File'}
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
            <div className="w-12 h-1 bg-orange-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
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
              {operationMode === 'source' ? 'File Data:' : 'Save Results:'}
            </span>
            <span className="text-xs text-text-muted">
              {Array.isArray(data.executionResult) ? `${data.executionResult.length} records` : '1 result'}
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
                {operationMode === 'source' ? 'No data loaded' : 'Operation completed'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Output Handle - only visible for source mode */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
        style={{ 
          visibility: operationMode === 'source' || operationMode === 'unconfigured' ? 'visible' : 'hidden' 
        }}
        title="Output file data"
      />
      
      {/* Output data type label */}
      {(operationMode === 'source' || operationMode === 'unconfigured') && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
            {DataType.STRUCTURED_DATA}
          </span>
        </div>
      )}
    </div>
  );
};

export default FileNode;