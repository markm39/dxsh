import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Settings, Database, CheckCircle, AlertCircle, Hash } from 'lucide-react';
import { DataStructuringConfig } from '../node-configs/DataStructuringSetup';

interface DataStructuringNodeProps {
  data: {
    label: string;
    configured: boolean;
    config?: DataStructuringConfig;
    onConfigure: () => void;
    results?: any[];
    isExecuting?: boolean;
    executionStatus?: 'idle' | 'running' | 'success' | 'error';
    error?: string;
  };
  selected: boolean;
}

const DataStructuringNode: React.FC<DataStructuringNodeProps> = ({ data, selected }) => {
  const { 
    label, 
    configured, 
    config, 
    onConfigure, 
    results = [], 
    isExecuting = false,
    executionStatus = 'idle',
    error 
  } = data;

  const getStatusIcon = () => {
    if (isExecuting) {
      return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
    }
    
    switch (executionStatus) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Database className="w-4 h-4 text-text-muted" />;
    }
  };

  const getStatusColor = () => {
    if (isExecuting) return 'border-blue-500';
    
    switch (executionStatus) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      default:
        return configured ? 'border-primary' : 'border-border-subtle';
    }
  };

  return (
    <div className={`
      relative bg-background rounded-lg border-2 transition-all duration-200 min-w-[200px]
      ${getStatusColor()}
      ${selected ? 'shadow-lg ring-2 ring-primary/20' : 'shadow-md'}
      ${isExecuting ? 'shadow-blue-200' : ''}
    `}>
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      {/* Header */}
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`font-medium text-sm ${
              configured ? 'text-text-primary' : 'text-text-muted'
            }`}>
              {label}
            </span>
          </div>
          <button
            onClick={onConfigure}
            className="p-1 hover:bg-surface rounded transition-colors"
            title="Configure data structuring"
          >
            <Settings className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!configured ? (
          <div className="text-center py-4">
            <Hash className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted mb-3">
              Configure regex patterns to extract structured data
            </p>
            <button
              onClick={onConfigure}
              className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs transition-colors"
            >
              Set Up Patterns
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Configuration Summary */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">Patterns:</span>
                <span className="text-text-primary font-medium">
                  {config?.patterns?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Format:</span>
                <span className="text-text-primary font-medium">
                  {config?.outputFormat || 'object'}
                </span>
              </div>
            </div>

            {/* Pattern Preview */}
            {config?.patterns && config.patterns.length > 0 && (
              <div className="bg-surface rounded p-2">
                <div className="text-xs text-text-muted mb-1">Key Patterns:</div>
                <div className="space-y-1">
                  {config.patterns.slice(0, 3).map((pattern) => (
                    <div key={pattern.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      <span className="text-text-primary font-mono truncate">
                        {pattern.name}
                      </span>
                    </div>
                  ))}
                  {config.patterns.length > 3 && (
                    <div className="text-xs text-text-muted pl-4">
                      +{config.patterns.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results Summary */}
            {results.length > 0 && (
              <div className="bg-surface rounded p-2">
                <div className="text-xs text-text-muted mb-1">Last Results:</div>
                <div className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Items processed:</span>
                    <span className="text-text-primary font-medium">{results.length}</span>
                  </div>
                  {results[0] && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Fields extracted:</span>
                      <span className="text-text-primary font-medium">
                        {Object.keys(results[0]).length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <div className="text-xs text-red-600">
                  <div className="font-medium mb-1">Error:</div>
                  <div>{error}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </div>
  );
};

export default DataStructuringNode;