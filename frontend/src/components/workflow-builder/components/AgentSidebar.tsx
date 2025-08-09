import React from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Agent } from "../types";

interface AgentSidebarProps {
  agents: Agent[];
  selectedAgentId: number | null;
  onSelectAgent: (agentId: number) => void;
  onCreateAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: number) => void;
}

const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
}) => {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="w-80 bg-background border-r border-border-subtle p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">Dxsh Agents</h2>
        <button
          onClick={onCreateAgent}
          className="p-2 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
          title="Create new agent"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`p-4 rounded-lg border cursor-pointer transition-colors group ${
              selectedAgentId === agent.id
                ? "border-primary bg-primary/5"
                : "border-border-subtle hover:border-primary/50 hover:bg-surface"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-text-primary truncate">
                  {agent.name}
                </h3>
                <p className="text-sm text-text-muted mt-1 line-clamp-2">
                  {agent.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      agent.status
                    )}`}
                  >
                    {agent.status}
                  </span>
                  <span className="text-xs text-text-muted">
                    {agent.executionCountToday} runs today
                  </span>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAgent(agent);
                  }}
                  className="p-1 rounded hover:bg-surface-secondary transition-colors text-text-muted hover:text-primary"
                  title="Edit agent"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAgent(agent.id);
                  }}
                  className="p-1 rounded hover:bg-surface-secondary transition-colors text-text-muted hover:text-red-500"
                  title="Delete agent"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-muted mb-4">No agents created yet</p>
            <button
              onClick={onCreateAgent}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
            >
              Create Your First Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSidebar;
