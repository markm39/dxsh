import React from "react";
import { Check, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { ExecutionHistory as ExecutionHistoryType } from "../types";

interface ExecutionHistoryProps {
  history: ExecutionHistoryType[];
  isLoading?: boolean;
}

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ history, isLoading }) => {
  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />;
      case "failed":
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
      case "error":
        return "bg-red-100 text-red-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-text-muted">Loading execution history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-text-primary">
        Execution History
      </h3>
      
      {history.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted">No executions yet</p>
          <p className="text-sm text-text-muted mt-2">
            Run your workflow to see execution history here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((execution) => (
            <div
              key={execution.id}
              className="p-4 bg-surface border border-border-subtle rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(execution.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          execution.status
                        )}`}
                      >
                        {execution.status}
                      </span>
                      <span className="text-sm text-text-muted">
                        {getDuration(execution.started_at, execution.completed_at)}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mt-1">
                      Started: {formatDate(execution.started_at)}
                    </p>
                    {execution.completed_at && (
                      <p className="text-sm text-text-muted">
                        Completed: {formatDate(execution.completed_at)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-text-muted">
                  {execution.workflow_nodes.length} nodes
                </div>
              </div>
              
              {execution.error_message && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {execution.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExecutionHistory;