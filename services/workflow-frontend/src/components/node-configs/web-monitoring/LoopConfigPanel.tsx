import React from "react";
import { Plus, Trash2, RotateCw } from "lucide-react";

// Loop parameter types (reused from HttpRequestSetup)
type LoopParameterType = 'range' | 'list' | 'input_variable';

interface LoopParameter {
  id: string;
  name: string; // Variable name to use in {{variable}} substitution
  type: LoopParameterType;
  
  // Range parameters (for numbers: 1, 2, 3, ..., 10)
  start?: number;
  end?: number;
  step?: number;
  
  // List parameters (manual list of values)
  values?: string[];
  
  // Input variable parameters (use data from previous nodes)
  inputVariable?: string; // e.g., "data.ids" or "data.users[*].id"
  inputPath?: string; // JSONPath to extract values from input data
}

interface LoopConfiguration {
  enabled: boolean;
  parameters: LoopParameter[];
  concurrency: number; // How many requests to run in parallel (1-10)
  delayBetweenRequests: number; // Delay in milliseconds between requests
  aggregationMode: 'append' | 'merge'; // How to combine results
  stopOnError: boolean; // Whether to stop the loop if a request fails
}

interface LoopConfigPanelProps {
  loopConfig: LoopConfiguration;
  onLoopConfigChange: (config: LoopConfiguration) => void;
}

const LoopConfigPanel: React.FC<LoopConfigPanelProps> = ({
  loopConfig,
  onLoopConfigChange,
}) => {
  const addLoopParameter = () => {
    const newParam: LoopParameter = {
      id: `param_${Date.now()}`,
      name: `param${loopConfig.parameters.length + 1}`,
      type: 'range',
      start: 1,
      end: 10,
      step: 1
    };
    
    onLoopConfigChange({
      ...loopConfig,
      parameters: [...loopConfig.parameters, newParam]
    });
  };

  const updateLoopParameter = (index: number, updates: Partial<LoopParameter>) => {
    const updatedParams = [...loopConfig.parameters];
    updatedParams[index] = { ...updatedParams[index], ...updates };
    
    onLoopConfigChange({
      ...loopConfig,
      parameters: updatedParams
    });
  };

  const removeLoopParameter = (index: number) => {
    const updatedParams = loopConfig.parameters.filter((_, i) => i !== index);
    
    onLoopConfigChange({
      ...loopConfig,
      parameters: updatedParams
    });
  };

  const renderLoopParameter = (param: LoopParameter, index: number) => {
    return (
      <div key={param.id} className="p-4 bg-surface-secondary/30 rounded-lg border border-border-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-mono text-sm bg-surface px-2 py-1 rounded border">
              {`{{${param.name}}}`}
            </div>
            <input
              type="text"
              value={param.name}
              onChange={(e) => updateLoopParameter(index, { name: e.target.value })}
              className="bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
              placeholder="Variable name"
            />
          </div>
          <button
            onClick={() => removeLoopParameter(index)}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Remove parameter"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Type</label>
            <select
              value={param.type}
              onChange={(e) => updateLoopParameter(index, { type: e.target.value as LoopParameterType })}
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
            >
              <option value="range">Number Range</option>
              <option value="list">Value List</option>
              <option value="input_variable">Input Variable</option>
            </select>
          </div>

          {param.type === 'range' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={param.start || 1}
                    onChange={(e) => updateLoopParameter(index, { start: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                    placeholder="Start"
                  />
                  <input
                    type="number"
                    value={param.end || 10}
                    onChange={(e) => updateLoopParameter(index, { end: parseInt(e.target.value) || 10 })}
                    className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                    placeholder="End"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Step</label>
                <input
                  type="number"
                  value={param.step || 1}
                  onChange={(e) => updateLoopParameter(index, { step: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                  placeholder="Step"
                />
              </div>
            </>
          )}

          {param.type === 'list' && (
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium text-text-primary">Values (comma-separated)</label>
              <textarea
                value={(param.values || []).join(', ')}
                onChange={(e) => updateLoopParameter(index, { 
                  values: e.target.value.split(',').map(v => v.trim()).filter(v => v) 
                })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                placeholder="value1, value2, value3"
                rows={3}
              />
            </div>
          )}

          {param.type === 'input_variable' && (
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium text-text-primary">Input Path</label>
              <input
                type="text"
                value={param.inputPath || ''}
                onChange={(e) => updateLoopParameter(index, { inputPath: e.target.value })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                placeholder="e.g., data.items[*].id"
              />
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="p-3 bg-background rounded border border-border-subtle">
          <div className="text-xs font-medium text-text-secondary mb-1">Preview:</div>
          {param.type === 'range' && (
            <span className="font-mono text-sm">
              {Array.from(
                { length: Math.ceil(((param.end || 10) - (param.start || 1)) / (param.step || 1)) + 1 },
                (_, i) => (param.start || 1) + i * (param.step || 1)
              ).slice(0, 5).join(', ')}
              {Array.from(
                { length: Math.ceil(((param.end || 10) - (param.start || 1)) / (param.step || 1)) + 1 }
              ).length > 5 && '...'}
            </span>
          )}
          {param.type === 'list' && param.values && (
            <span className="font-mono text-sm">
              {param.values.slice(0, 3).join(', ')}
              {param.values.length > 3 && '...'}
            </span>
          )}
          {param.type === 'input_variable' && (
            <span className="font-mono text-sm">Values from: {param.inputPath || 'Not configured'}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Loop Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Loop Configuration</h3>
          <p className="text-sm text-text-secondary">
            Execute this monitoring with different parameters
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={loopConfig.enabled}
            onChange={(e) => onLoopConfigChange({ ...loopConfig, enabled: e.target.checked })}
            className="rounded border border-border-subtle focus:border-primary"
          />
          <span className="text-sm text-text-primary">Enable Loop</span>
        </label>
      </div>

      {loopConfig.enabled && (
        <div className="space-y-6">
          {/* Loop Parameters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-text-primary">Loop Parameters</h4>
              <button
                onClick={addLoopParameter}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Parameter
              </button>
            </div>

            {loopConfig.parameters.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <RotateCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No loop parameters configured</p>
                <p className="text-sm">Add parameters to iterate through different values</p>
              </div>
            ) : (
              <div className="space-y-4">
                {loopConfig.parameters.map((param, index) => renderLoopParameter(param, index))}
              </div>
            )}
          </div>

          {/* Loop Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Concurrency</label>
              <select
                value={loopConfig.concurrency}
                onChange={(e) => onLoopConfigChange({ ...loopConfig, concurrency: parseInt(e.target.value) })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              >
                {[1, 2, 3, 5, 10].map(n => (
                  <option key={n} value={n}>{n} request{n > 1 ? 's' : ''} at a time</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Delay Between Requests (ms)</label>
              <select
                value={loopConfig.delayBetweenRequests}
                onChange={(e) => onLoopConfigChange({ ...loopConfig, delayBetweenRequests: parseInt(e.target.value) })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              >
                <option value={0}>No delay</option>
                <option value={100}>100ms</option>
                <option value={500}>500ms</option>
                <option value={1000}>1 second</option>
                <option value={2000}>2 seconds</option>
                <option value={5000}>5 seconds</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Result Aggregation</label>
              <select
                value={loopConfig.aggregationMode}
                onChange={(e) => onLoopConfigChange({ ...loopConfig, aggregationMode: e.target.value as 'append' | 'merge' })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              >
                <option value="append">Append (array of results)</option>
                <option value="merge">Merge (single combined object)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loopConfig.stopOnError}
                  onChange={(e) => onLoopConfigChange({ ...loopConfig, stopOnError: e.target.checked })}
                  className="rounded border border-border-subtle focus:border-primary"
                />
                <span className="text-sm text-text-primary">Stop on Error</span>
              </label>
              <p className="text-xs text-text-secondary">
                Stop the loop if any request fails
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoopConfigPanel;