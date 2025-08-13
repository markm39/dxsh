import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  Link as LinkIcon,
  ExternalLink,
  BarChart3,
  Table,
  TrendingUp,
  FileText,
  FileCode
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DataType, getAvailableWidgetTypes, stringToDataType, type ConnectableWidgetType } from '../../types/compatibility';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface DashboardWidget {
  id: number;
  title: string;
  type: string;
  dashboard_id: number;
  dataSource?: {
    agentId?: number;
    nodeId?: string;
  };
}

interface Dashboard {
  id: number;
  name: string;
  widgets: DashboardWidget[];
}

interface DashboardConnectorProps {
  agentId: number;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  nodeOutputType?: string; // Dynamic output type from the node's current configuration
  onClose: () => void;
  onConnect?: (widgetId: number) => void;
}

const DashboardConnector: React.FC<DashboardConnectorProps> = ({
  agentId,
  nodeId,
  nodeType,
  nodeLabel,
  nodeOutputType,
  onClose,
  onConnect
}) => {
  const { authHeaders } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedWidgets, setConnectedWidgets] = useState<DashboardWidget[]>([]);
  const [showCreateWidget, setShowCreateWidget] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<number | null>(null);
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetType, setNewWidgetType] = useState<ConnectableWidgetType>('chart');

  // Get available widget types based on node output type
  const availableWidgetTypes = React.useMemo(() => {
    const dataType = nodeOutputType ? stringToDataType(nodeOutputType) : null;
    return getAvailableWidgetTypes(dataType);
  }, [nodeOutputType]);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load dashboards
      const dashboardsResponse = await fetch(`${API_BASE_URL}/api/v1/dashboards`, {
        headers: authHeaders
      });
      
      if (!dashboardsResponse.ok) {
        throw new Error('Failed to load dashboards');
      }
      
      const dashboardsData = await dashboardsResponse.json();
      
      if (dashboardsData.success) {
        setDashboards(dashboardsData.data);
        
        // Find widgets already connected to this node
        const allWidgets = dashboardsData.data.flatMap((dashboard: Dashboard) => 
          dashboard.widgets.filter(widget => 
            widget.dataSource?.agentId === agentId && 
            widget.dataSource?.nodeId === nodeId
          )
        );
        setConnectedWidgets(allWidgets);
      } else {
        throw new Error(dashboardsData.error || 'Failed to load dashboards');
      }
    } catch (err) {
      console.error('Error loading dashboards:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const connectToWidget = async (widget: DashboardWidget) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/dashboards/${widget.dashboard_id}/widgets/${widget.id}`,
        {
          method: 'PUT',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dataSource: {
              agentId,
              nodeId,
              refreshOnWorkflowComplete: true
            }
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setConnectedWidgets(prev => [...prev, { ...widget, dataSource: { agentId, nodeId } }]);
        onConnect?.(widget.id);
      } else {
        throw new Error(data.error || 'Failed to connect widget');
      }
    } catch (err) {
      console.error('Error connecting widget:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect widget');
    }
  };

  const disconnectWidget = async (widget: DashboardWidget) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/dashboards/${widget.dashboard_id}/widgets/${widget.id}`,
        {
          method: 'PUT',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dataSource: null
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setConnectedWidgets(prev => prev.filter(w => w.id !== widget.id));
      } else {
        throw new Error(data.error || 'Failed to disconnect widget');
      }
    } catch (err) {
      console.error('Error disconnecting widget:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect widget');
    }
  };

  const createAndConnectWidget = async () => {
    if (!selectedDashboard || !newWidgetTitle.trim()) {
      setError('Please select a dashboard and provide a widget title');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/dashboards/${selectedDashboard}/widgets`,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: newWidgetType,
            title: newWidgetTitle,
            dataSource: {
              agentId,
              nodeId,
              refreshOnWorkflowComplete: true
            },
            config: getDefaultWidgetConfig(newWidgetType)
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        const newWidget = data.data;
        setConnectedWidgets(prev => [...prev, newWidget]);
        setShowCreateWidget(false);
        setNewWidgetTitle('');
        setSelectedDashboard(null);
        onConnect?.(newWidget.id);
        
        // Refresh dashboards to show the new widget
        await loadDashboards();
      } else {
        throw new Error(data.error || 'Failed to create widget');
      }
    } catch (err) {
      console.error('Error creating widget:', err);
      setError(err instanceof Error ? err.message : 'Failed to create widget');
    }
  };

  const getDefaultWidgetConfig = (type: 'chart' | 'metric') => {
    switch (type) {
      case 'chart':
        return {
          chartType: 'line',
          showLegend: true,
          showGrid: true,
          showTooltip: true
        };
      case 'metric':
        return {
          valueKey: 'value',
          format: 'number',
          precision: 0,
          showTrend: true
        };
      default:
        return {};
    }
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'webSource':
        return '🌐';
      case 'httpRequest':
        return '📡';
      case 'aiProcessor':
        return '🤖';
      case 'chartGenerator':
        return '📊';
      case 'linearRegression':
      case 'randomForest':
        return '🤖';
      default:
        return '⚙️';
    }
  };

  const openDashboard = (dashboardId: number) => {
    window.open(`http://localhost:3001/dashboard/${dashboardId}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border-subtle max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Monitor className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Connect to Dashboard
                </h2>
                <p className="text-text-secondary text-sm">
                  Connect "{nodeLabel}" to dashboard widgets
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Node Info */}
          <div className="mb-6 p-4 bg-surface border border-border-subtle rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getNodeTypeIcon(nodeType)}</span>
              <div>
                <div className="font-medium text-text-primary">{nodeLabel}</div>
                <div className="text-sm text-text-muted">
                  {nodeType} • Node ID: {nodeId}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 hover:bg-red-500/20 rounded"
              >
                <X className="w-3 h-3 text-red-400" />
              </button>
            </div>
          )}

          {/* Currently Connected Widgets */}
          {connectedWidgets.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-text-primary mb-3">
                Connected Widgets ({connectedWidgets.length})
              </h3>
              <div className="space-y-2">
                {connectedWidgets.map(widget => {
                  const dashboard = dashboards.find(d => d.id === widget.dashboard_id);
                  return (
                    <div key={widget.id} className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="font-medium text-text-primary">{widget.title}</div>
                          <div className="text-xs text-text-muted">
                            {widget.type} widget in "{dashboard?.name || 'Unknown Dashboard'}"
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDashboard(widget.dashboard_id)}
                          className="p-1 hover:bg-surface rounded text-text-muted hover:text-text-primary"
                          title="Open dashboard"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => disconnectWidget(widget)}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          title="Disconnect widget"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-text-secondary">Loading dashboards...</span>
            </div>
          ) : (
            <>
              {/* Available Widgets */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-text-primary">
                    Available Widgets
                  </h3>
                  <button
                    onClick={() => setShowCreateWidget(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Widget
                  </button>
                </div>

                {dashboards.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-border-subtle rounded-lg">
                    <Monitor className="w-8 h-8 text-text-muted mx-auto mb-2" />
                    <p className="text-text-secondary mb-2">No dashboards found</p>
                    <p className="text-sm text-text-muted">
                      Create a dashboard first to connect widgets to this node
                    </p>
                    <button
                      onClick={() => window.open('http://localhost:3001', '_blank')}
                      className="mt-3 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg transition-colors"
                    >
                      Open Dashboard App
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboards.map(dashboard => (
                      <div key={dashboard.id} className="border border-border-subtle rounded-lg">
                        <div className="p-4 border-b border-border-subtle bg-surface">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-text-primary">{dashboard.name}</div>
                            <button
                              onClick={() => openDashboard(dashboard.id)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open
                            </button>
                          </div>
                          <div className="text-sm text-text-muted">
                            {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        
                        {dashboard.widgets.length > 0 ? (
                          <div className="p-2">
                            {dashboard.widgets.map(widget => {
                              const isConnected = connectedWidgets.some(cw => cw.id === widget.id);
                              const isConnectedToOtherNode = widget.dataSource && 
                                (widget.dataSource.agentId !== agentId || widget.dataSource.nodeId !== nodeId);
                              
                              return (
                                <div key={widget.id} className="flex items-center justify-between p-3 hover:bg-surface-secondary/30 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="text-sm font-medium text-text-primary">
                                      {widget.title}
                                    </div>
                                    <div className="text-xs text-text-muted bg-surface px-2 py-1 rounded">
                                      {widget.type}
                                    </div>
                                    {isConnectedToOtherNode && (
                                      <div className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
                                        Connected to other node
                                      </div>
                                    )}
                                  </div>
                                  
                                  {isConnected ? (
                                    <div className="flex items-center gap-1 text-green-500 text-sm">
                                      <CheckCircle className="w-4 h-4" />
                                      Connected
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => connectToWidget(widget)}
                                      disabled={isConnectedToOtherNode}
                                      className="flex items-center gap-1 px-3 py-1 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                                    >
                                      <LinkIcon className="w-3 h-3" />
                                      Connect
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-text-muted text-sm">
                            No widgets in this dashboard
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create New Widget Form */}
              {showCreateWidget && (
                <div className="p-4 bg-surface border border-border-subtle rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-text-primary">Create New Widget</h4>
                    <button
                      onClick={() => setShowCreateWidget(false)}
                      className="p-1 hover:bg-surface-secondary rounded"
                    >
                      <X className="w-4 h-4 text-text-muted" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Dashboard
                      </label>
                      <select
                        value={selectedDashboard || ''}
                        onChange={(e) => setSelectedDashboard(Number(e.target.value) || null)}
                        className="w-full bg-background text-text-primary p-2 border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                      >
                        <option value="">Select a dashboard</option>
                        {dashboards.map(dashboard => (
                          <option key={dashboard.id} value={dashboard.id}>
                            {dashboard.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Widget Title
                      </label>
                      <input
                        type="text"
                        value={newWidgetTitle}
                        onChange={(e) => setNewWidgetTitle(e.target.value)}
                        placeholder={`${nodeLabel} - ${newWidgetType === 'chart' ? 'Chart' : 'Metric'}`}
                        className="w-full bg-background text-text-primary p-2 border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Widget Type
                        {nodeOutputType && (
                          <span className="text-xs text-text-muted ml-2">
                            (Compatible with {nodeOutputType} data)
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {availableWidgetTypes.map(({ widgetType, available, reason }) => {
                          const getWidgetInfo = (type: ConnectableWidgetType) => {
                            switch (type) {
                              case 'chart':
                                return { Icon: BarChart3, label: 'Chart', desc: 'Visual data display' };
                              case 'table':
                                return { Icon: Table, label: 'Table', desc: 'Tabular data view' };
                              case 'metric':
                                return { Icon: TrendingUp, label: 'Metric', desc: 'Key performance indicator' };
                              case 'text':
                                return { Icon: FileText, label: 'Text', desc: 'Text content display' };
                              case 'markdown':
                                return { Icon: FileCode, label: 'Markdown', desc: 'Formatted text display' };
                            }
                          };
                          
                          const info = getWidgetInfo(widgetType);
                          const Icon = info.Icon;
                          
                          return (
                            <button
                              key={widgetType}
                              onClick={() => available && setNewWidgetType(widgetType)}
                              disabled={!available}
                              className={`p-3 rounded-lg border transition-colors ${
                                newWidgetType === widgetType && available
                                  ? 'border-primary bg-primary/10 text-primary' 
                                  : available
                                  ? 'border-border-subtle hover:border-border'
                                  : 'border-border-subtle opacity-50 cursor-not-allowed bg-surface/30'
                              }`}
                              title={available ? undefined : reason}
                            >
                              <div className="text-center">
                                <Icon className="w-5 h-5 mx-auto mb-1" />
                                <div className="font-medium text-sm">{info.label}</div>
                                <div className="text-xs opacity-70">{info.desc}</div>
                                {!available && (
                                  <div className="text-xs text-red-400 mt-1">Not compatible</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    <button
                      onClick={createAndConnectWidget}
                      disabled={!selectedDashboard || !newWidgetTitle.trim()}
                      className="w-full px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      Create & Connect Widget
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle">
          <div className="flex justify-between items-center text-sm text-text-muted">
            <div>
              {connectedWidgets.length > 0 && (
                <span>{connectedWidgets.length} widget{connectedWidgets.length !== 1 ? 's' : ''} connected</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-secondary hover:bg-surface-secondary/70 text-text-primary rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardConnector;