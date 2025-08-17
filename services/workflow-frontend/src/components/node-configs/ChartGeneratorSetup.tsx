import React, { useState, useEffect } from "react";
import {
  BarChart3,
  LineChart,
  Radar,
  CheckCircle,
  Settings,
  X,
  Monitor,
} from "lucide-react";
import DashboardConnector from "../dashboard-connect/DashboardConnector";

interface ChartConfig {
  chartType: 'bar' | 'line' | 'radar';
  title: string;
  customPrompt?: string;
}

interface ChartGeneratorSetupProps {
  onClose: () => void;
  onSave: (config: ChartConfig) => void;
  initialConfig?: ChartConfig;
  inputData?: any[];
  onPreview?: () => void;
  isConfigured?: boolean;
  isExecuting?: boolean;
  executionResult?: any;
  agentId?: number;
  nodeId?: string;
}

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { value: 'line', label: 'Line Chart', icon: LineChart, description: 'Show trends over time' },
  { value: 'radar', label: 'Radar Chart', icon: Radar, description: 'Compare multiple metrics' },
];

const ChartGeneratorSetup: React.FC<ChartGeneratorSetupProps> = ({
  onClose,
  onSave,
  initialConfig,
  inputData = [],
  isConfigured = false,
  isExecuting = false,
  executionResult,
  agentId,
  nodeId,
}) => {
  const [config, setConfig] = useState<ChartConfig>({
    chartType: 'bar',
    title: '',
    customPrompt: '',
    ...initialConfig
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);

  // Auto-generate title based on chart type
  useEffect(() => {
    if (!config.title && config.chartType) {
      setConfig(prev => ({
        ...prev,
        title: `${config.chartType.charAt(0).toUpperCase() + config.chartType.slice(1)} Chart Analysis`
      }));
    }
  }, [config.chartType]);

  const handleSave = () => {
    onSave(config);
  };

  const selectedChartType = CHART_TYPES.find(type => type.value === config.chartType);
  const Icon = selectedChartType?.icon || BarChart3;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-text-primary">
                    Chart Generator Setup
                  </h2>
                  {isConfigured && !isExecuting && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {isExecuting && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                  )}
                </div>
                <p className="text-text-secondary">
                  Create interactive charts from your data
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-6">
            {/* Chart Type Selection */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Chart Type
              </label>
              <div className="grid grid-cols-1 gap-3">
                {CHART_TYPES.map(type => {
                  const TypeIcon = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setConfig(prev => ({ ...prev, chartType: type.value as 'bar' | 'line' | 'radar' }))}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                        config.chartType === type.value
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-border-subtle bg-surface-secondary hover:border-border-primary'
                      }`}
                    >
                      <TypeIcon className={`w-5 h-5 ${
                        config.chartType === type.value ? 'text-orange-500' : 'text-text-muted'
                      }`} />
                      <div className="text-left">
                        <div className={`font-medium ${
                          config.chartType === type.value ? 'text-orange-500' : 'text-text-primary'
                        }`}>
                          {type.label}
                        </div>
                        <div className="text-sm text-text-muted">
                          {type.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chart Title */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Chart Title
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                placeholder="Enter chart title..."
              />
            </div>

            {/* Chart Type Info */}
            <div className={`p-4 rounded-lg border ${
              config.chartType === 'bar' ? 'border-blue-500/30 bg-blue-500/10' :
              config.chartType === 'line' ? 'border-green-500/30 bg-green-500/10' : 
              'border-purple-500/30 bg-purple-500/10'
            }`}>
              <h4 className={`font-medium mb-2 ${
                config.chartType === 'bar' ? 'text-blue-400' :
                config.chartType === 'line' ? 'text-green-400' : 'text-purple-400'
              }`}>
                {selectedChartType?.label} Configuration
              </h4>
              <p className="text-sm text-text-muted">
                {selectedChartType?.description}. The AI will automatically structure your input data appropriately.
              </p>
            </div>

            {/* Input Data Preview */}
            {inputData.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-text-primary">Sample Input Data</h4>
                <div className="bg-surface rounded-lg border border-border-subtle p-4">
                  <div className="max-h-40 overflow-y-auto">
                    <pre className="text-xs text-text-muted font-mono">
                      {JSON.stringify(inputData.slice(0, 3), null, 2)}
                      {inputData.length > 3 && `\n... and ${inputData.length - 3} more items`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {inputData.length === 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  💡 <strong>Preview Note:</strong> Input data is available during workflow execution. Connect this node to a data source and use the Execute button in the workflow to see live results in the Dashboard tab.
                </p>
              </div>
            )}

            {/* Advanced Configuration */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                <Settings className="w-4 h-4" />
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 p-4 border border-border-subtle rounded-lg bg-surface-secondary">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Custom AI Instructions (Optional)
                    </label>
                    <textarea
                      value={config.customPrompt || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, customPrompt: e.target.value }))}
                      className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none resize-none"
                      rows={3}
                      placeholder="Leave empty to use optimized default prompts..."
                    />
                    <p className="text-xs text-text-muted mt-2">
                      Override the default AI instructions for chart generation.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Execution Result */}
            {executionResult && (
              <div className="space-y-4">
                <h4 className="font-medium text-text-primary">Generated Chart Data</h4>
                <div className="bg-surface rounded-lg border border-border-subtle p-4">
                  <div className="bg-background rounded border border-border-subtle p-3 max-h-64 overflow-y-auto">
                    <pre className="text-sm text-text-primary whitespace-pre-wrap">
                      {typeof executionResult === 'string' 
                        ? executionResult 
                        : JSON.stringify(executionResult, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
              >
                Cancel
              </button>
              {agentId && nodeId && (
                <button
                  onClick={() => setShowDashboardConnector(true)}
                  className="px-4 py-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  Connect to Dashboard
                </button>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={!config.title.trim()}
              className="px-8 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
            >
              <CheckCircle className="w-4 h-4" />
              Create Chart Generator
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Connector Modal */}
      {showDashboardConnector && agentId && nodeId && (
        <DashboardConnector
          agentId={agentId}
          nodeId={nodeId}
          nodeType="chartGenerator"
          nodeLabel="Chart Generator"
          nodeOutputType="chartData"
          onClose={() => setShowDashboardConnector(false)}
          onConnect={(widgetId) => {
            console.log('Connected to widget:', widgetId);
            setShowDashboardConnector(false);
          }}
        />
      )}
    </div>
  );
};

export default ChartGeneratorSetup;