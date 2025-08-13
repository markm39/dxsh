import React, { useState } from "react";
import { Globe2, CheckCircle, X, Eye, EyeOff, TestTube, Lock, Key, AlertCircle, Plus, Trash2, Settings, History, RotateCw } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { InputVariable } from "../workflow-builder/workflow-types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Authentication types
type AuthType = 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'custom';

// HTTP methods
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

interface AuthConfig {
  // API Key auth
  apiKeyLocation?: 'header' | 'query';
  apiKeyName?: string;
  apiKeyValue?: string;
  
  // Bearer token auth
  bearerToken?: string;
  
  // Basic auth
  basicUsername?: string;
  basicPassword?: string;
  
  // OAuth2 (future expansion)
  clientId?: string;
  clientSecret?: string;
  
  // Custom headers
  customHeaders?: { [key: string]: string };
}

// Loop parameter types
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

interface HttpRequestConfig {
  // Basic request configuration
  method: HttpMethod;
  url: string;
  
  // Authentication
  authType: AuthType;
  authConfig: AuthConfig;
  
  // Request options
  headers: { [key: string]: string };
  queryParams: { [key: string]: string };
  body?: string;
  
  // Advanced options
  timeout: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    retryOnStatus: number[];
  };
  
  // Response handling
  responseType: 'json' | 'text' | 'blob';
  followRedirects: boolean;
  
  // Loop parameters
  loopConfig: LoopConfiguration;
  
  // Presets
  presetId?: string;
  saveAsPreset?: boolean;
  presetName?: string;
}

interface HttpRequestSetupProps {
  onClose: () => void;
  onSave: (config: HttpRequestConfig) => void;
  initialConfig?: HttpRequestConfig;
  inputData?: any[];
  isConfigured?: boolean;
  inputVariables?: InputVariable[];
  agentId?: number;
  nodeId?: string;
}

const HttpRequestSetup: React.FC<HttpRequestSetupProps> = ({
  onClose,
  onSave,
  initialConfig,
  inputData = [],
  isConfigured = false,
  agentId,
  nodeId,
}) => {
  const { authHeaders } = useAuth();
  
  const [config, setConfig] = useState<HttpRequestConfig>({
    method: 'GET',
    url: '',
    authType: 'none',
    authConfig: {},
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Chatmark-Workflow/1.0'
    },
    queryParams: {},
    body: '',
    timeout: 30000,
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000,
      retryOnStatus: [408, 429, 500, 502, 503, 504]
    },
    responseType: 'json',
    followRedirects: true,
    loopConfig: {
      enabled: false,
      parameters: [],
      concurrency: 1,
      delayBetweenRequests: 100,
      aggregationMode: 'append',
      stopOnError: true
    },
    ...initialConfig
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'basic' | 'auth' | 'headers' | 'loop' | 'advanced' | 'results'>('basic');
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleConfigChange = (field: keyof HttpRequestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const fetchExecutionHistory = async () => {
    if (!agentId || !nodeId) return;
    
    console.log('🔍 Fetching execution history for:', { agentId, nodeId });
    setLoadingHistory(true);
    try {
      const url = `${API_BASE_URL}/api/v1/agents/${agentId}/nodes/${nodeId}/executions`;
      console.log('🔍 Request URL:', url);
      
      const response = await fetch(url, {
        headers: authHeaders
      });
      
      const data = await response.json();
      console.log('🔍 Response data:', data);
      
      if (data.success) {
        setExecutionHistory(data.executions || []);
        console.log('🔍 Set execution history with', data.executions?.length || 0, 'executions');
      } else {
        console.error('🔍 API request failed:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch execution history when Results tab is opened
  React.useEffect(() => {
    if (activeTab === 'results') {
      fetchExecutionHistory();
    }
  }, [activeTab, agentId, nodeId]);

  const handleAuthConfigChange = (field: keyof AuthConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      authConfig: { ...prev.authConfig, [field]: value }
    }));
  };

  const handleHeaderChange = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      headers: { ...prev.headers, [key]: value }
    }));
  };

  const handleQueryParamChange = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      queryParams: { ...prev.queryParams, [key]: value }
    }));
  };

  const addHeader = () => {
    const key = `custom-header-${Object.keys(config.headers).length}`;
    handleHeaderChange(key, '');
  };

  const removeHeader = (key: string) => {
    const { [key]: removed, ...rest } = config.headers;
    setConfig(prev => ({ ...prev, headers: rest }));
  };

  const addQueryParam = () => {
    const key = `param${Object.keys(config.queryParams).length + 1}`;
    handleQueryParamChange(key, '');
  };

  const removeQueryParam = (key: string) => {
    const { [key]: removed, ...rest } = config.queryParams;
    setConfig(prev => ({ ...prev, queryParams: rest }));
  };

  // Loop parameter functions
  const addLoopParameter = () => {
    const newParam: LoopParameter = {
      id: `param_${Date.now()}`,
      name: `param${config.loopConfig.parameters.length + 1}`,
      type: 'range',
      start: 1,
      end: 10,
      step: 1
    };
    
    handleConfigChange('loopConfig', {
      ...config.loopConfig,
      parameters: [...config.loopConfig.parameters, newParam]
    });
  };

  const updateLoopParameter = (index: number, updates: Partial<LoopParameter>) => {
    const updatedParams = [...config.loopConfig.parameters];
    updatedParams[index] = { ...updatedParams[index], ...updates };
    
    handleConfigChange('loopConfig', {
      ...config.loopConfig,
      parameters: updatedParams
    });
  };

  const removeLoopParameter = (index: number) => {
    const updatedParams = config.loopConfig.parameters.filter((_, i) => i !== index);
    
    handleConfigChange('loopConfig', {
      ...config.loopConfig,
      parameters: updatedParams
    });
  };

  const renderLoopParameter = (param: LoopParameter, index: number) => (
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
              <label className="text-sm font-medium text-text-primary">Start - End</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={param.start || 1}
                  onChange={(e) => updateLoopParameter(index, { start: parseInt(e.target.value) || 1 })}
                  className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                  placeholder="1"
                />
                <input
                  type="number"
                  value={param.end || 10}
                  onChange={(e) => updateLoopParameter(index, { end: parseInt(e.target.value) || 10 })}
                  className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                  placeholder="10"
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
                placeholder="1"
              />
            </div>
          </>
        )}

        {param.type === 'list' && (
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-text-primary">Values (one per line)</label>
            <textarea
              value={(param.values || []).join('\n')}
              onChange={(e) => updateLoopParameter(index, { values: e.target.value.split('\n').filter(v => v.trim()) })}
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm font-mono"
              placeholder="value1&#10;value2&#10;value3"
              rows={3}
            />
          </div>
        )}

        {param.type === 'input_variable' && (
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-text-primary">Input Variable Path</label>
            <input
              type="text"
              value={param.inputPath || ''}
              onChange={(e) => updateLoopParameter(index, { inputPath: e.target.value })}
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm font-mono"
              placeholder="data.ids or data.users[*].id"
            />
            <div className="text-xs text-text-muted">JSONPath to extract values from input data</div>
          </div>
        )}
      </div>

      {/* Preview of values */}
      <div className="pt-2 border-t border-border-subtle">
        <div className="text-xs text-text-muted">
          <span className="font-medium">Preview: </span>
          {param.type === 'range' && param.start !== undefined && param.end !== undefined && param.step !== undefined && (
            <span className="font-mono">
              {Array.from({ length: Math.ceil((param.end - param.start + 1) / param.step) }, (_, i) => param.start! + i * param.step!).slice(0, 5).join(', ')}
              {param.end - param.start + 1 > 5 && '...'}
            </span>
          )}
          {param.type === 'list' && param.values && (
            <span className="font-mono">
              {param.values.slice(0, 3).join(', ')}
              {param.values.length > 3 && '...'}
            </span>
          )}
          {param.type === 'input_variable' && (
            <span className="font-mono">Values from: {param.inputPath || 'Not configured'}</span>
          )}
        </div>
      </div>
    </div>
  );

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const testRequest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/http-request/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          config,
          inputData: inputData.slice(0, 1) // Test with first item only
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTestResult({
          success: true,
          message: `Success! Status: ${result.response?.status || 'Unknown'}`,
          data: result.response?.data
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Test request failed'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Validate required fields
      if (!config.url.trim()) {
        setTestResult({
          success: false,
          message: 'URL is required'
        });
        return;
      }

      // Validate URL format
      try {
        new URL(config.url);
      } catch {
        setTestResult({
          success: false,
          message: 'Please enter a valid URL'
        });
        return;
      }

      // Validate authentication configuration
      if (config.authType === 'apiKey' && !config.authConfig.apiKeyValue) {
        setTestResult({
          success: false,
          message: 'API Key value is required'
        });
        return;
      }

      if (config.authType === 'bearer' && !config.authConfig.bearerToken) {
        setTestResult({
          success: false,
          message: 'Bearer token is required'
        });
        return;
      }

      if (config.authType === 'basic' && (!config.authConfig.basicUsername || !config.authConfig.basicPassword)) {
        setTestResult({
          success: false,
          message: 'Username and password are required for basic auth'
        });
        return;
      }

      console.log('💾 Saving HTTP Request config:', config);
      onSave(config);
    } finally {
      setSaving(false);
    }
  };

  const renderBasicTab = () => (
    <div className="space-y-6">
      {/* Method and URL */}
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Method</label>
          <select
            value={config.method}
            onChange={(e) => handleConfigChange('method', e.target.value as HttpMethod)}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
          >
            {HTTP_METHODS.map(method => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
        <div className="col-span-3 space-y-2">
          <label className="text-sm font-medium text-text-primary">URL</label>
          <input
            type="url"
            value={config.url}
            onChange={(e) => handleConfigChange('url', e.target.value)}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
            placeholder="https://api.example.com/users/{{userId}}/posts"
          />
          <div className="text-xs text-text-muted">
            Use variables like <code className="bg-surface-secondary px-1 rounded">{`{{userId}}`}</code> in URL path for dynamic requests
          </div>
        </div>
      </div>

      {/* Query Parameters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Query Parameters</label>
          <button
            onClick={addQueryParam}
            className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
            title="Add query parameter"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {Object.entries(config.queryParams).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const { [key]: oldValue, ...rest } = config.queryParams;
                  handleQueryParamChange(e.target.value, value);
                  if (e.target.value !== key) {
                    setConfig(prev => ({ ...prev, queryParams: rest }));
                  }
                }}
                className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                placeholder="Parameter name"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleQueryParamChange(key, e.target.value)}
                className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                placeholder="Parameter value"
              />
              <button
                onClick={() => removeQueryParam(key)}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Remove parameter"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {Object.keys(config.queryParams).length === 0 && (
            <div className="text-sm text-text-muted italic">No query parameters</div>
          )}
        </div>
      </div>

      {/* Request Body (for non-GET methods) */}
      {config.method !== 'GET' && config.method !== 'HEAD' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Request Body</label>
          <textarea
            value={config.body || ''}
            onChange={(e) => handleConfigChange('body', e.target.value)}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none font-mono text-sm"
            placeholder='{"key": "value"} or use $input variables'
            rows={4}
          />
          <div className="text-xs text-text-muted">
            Use variables like <code className="bg-surface-secondary px-1 rounded">$input</code> for dynamic data
          </div>
        </div>
      )}
    </div>
  );

  const renderAuthTab = () => (
    <div className="space-y-6">
      {/* Auth Type Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Authentication Type</label>
        <select
          value={config.authType}
          onChange={(e) => handleConfigChange('authType', e.target.value as AuthType)}
          className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
        >
          <option value="none">No Authentication</option>
          <option value="apiKey">API Key</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="oauth2">OAuth 2.0 (Coming Soon)</option>
          <option value="custom">Custom Headers</option>
        </select>
      </div>

      {/* API Key Configuration */}
      {config.authType === 'apiKey' && (
        <div className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-text-primary">API Key Configuration</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Location</label>
              <select
                value={config.authConfig.apiKeyLocation || 'header'}
                onChange={(e) => handleAuthConfigChange('apiKeyLocation', e.target.value)}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              >
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Key Name</label>
              <input
                type="text"
                value={config.authConfig.apiKeyName || ''}
                onChange={(e) => handleAuthConfigChange('apiKeyName', e.target.value)}
                placeholder="X-API-Key"
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">API Key Value</label>
            <div className="relative">
              <input
                type={showSecrets.apiKey ? 'text' : 'password'}
                value={config.authConfig.apiKeyValue || ''}
                onChange={(e) => handleAuthConfigChange('apiKeyValue', e.target.value)}
                placeholder="Enter your API key"
                className="w-full bg-surface text-text-primary p-2 pr-10 rounded border border-border-subtle focus:border-primary focus:outline-none font-mono"
              />
              <button
                onClick={() => toggleSecretVisibility('apiKey')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showSecrets.apiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bearer Token Configuration */}
      {config.authType === 'bearer' && (
        <div className="space-y-4 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-text-primary">Bearer Token Configuration</span>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Bearer Token</label>
            <div className="relative">
              <input
                type={showSecrets.bearerToken ? 'text' : 'password'}
                value={config.authConfig.bearerToken || ''}
                onChange={(e) => handleAuthConfigChange('bearerToken', e.target.value)}
                placeholder="Enter your bearer token"
                className="w-full bg-surface text-text-primary p-2 pr-10 rounded border border-border-subtle focus:border-primary focus:outline-none font-mono"
              />
              <button
                onClick={() => toggleSecretVisibility('bearerToken')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showSecrets.bearerToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Auth Configuration */}
      {config.authType === 'basic' && (
        <div className="space-y-4 p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-text-primary">Basic Authentication</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Username</label>
              <input
                type="text"
                value={config.authConfig.basicUsername || ''}
                onChange={(e) => handleAuthConfigChange('basicUsername', e.target.value)}
                placeholder="Username"
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Password</label>
              <div className="relative">
                <input
                  type={showSecrets.basicPassword ? 'text' : 'password'}
                  value={config.authConfig.basicPassword || ''}
                  onChange={(e) => handleAuthConfigChange('basicPassword', e.target.value)}
                  placeholder="Password"
                  className="w-full bg-surface text-text-primary p-2 pr-10 rounded border border-border-subtle focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => toggleSecretVisibility('basicPassword')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showSecrets.basicPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderHeadersTab = () => (
    <div className="space-y-6">
      {/* Headers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Request Headers</label>
          <button
            onClick={addHeader}
            className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
            title="Add header"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Object.entries(config.headers).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const { [key]: oldValue, ...rest } = config.headers;
                  handleHeaderChange(e.target.value, value);
                  if (e.target.value !== key) {
                    setConfig(prev => ({ ...prev, headers: rest }));
                  }
                }}
                className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm font-mono"
                placeholder="Header name"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleHeaderChange(key, e.target.value)}
                className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                placeholder="Header value"
              />
              <button
                onClick={() => removeHeader(key)}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Remove header"
                disabled={key === 'Content-Type' || key === 'User-Agent'} // Prevent removal of default headers
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAdvancedTab = () => (
    <div className="space-y-6">
      {/* Timeout */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Timeout (ms)</label>
        <input
          type="number"
          value={config.timeout}
          onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value) || 30000)}
          min="1000"
          max="300000"
          className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
        />
      </div>

      {/* Retry Configuration */}
      <div className="space-y-4 p-4 bg-surface-secondary/30 rounded-lg border border-border-subtle">
        <div className="text-sm font-medium text-text-primary">Retry Configuration</div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Max Retries</label>
            <input
              type="number"
              value={config.retryConfig.maxRetries}
              onChange={(e) => handleConfigChange('retryConfig', {
                ...config.retryConfig,
                maxRetries: parseInt(e.target.value) || 0
              })}
              min="0"
              max="10"
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Retry Delay (ms)</label>
            <input
              type="number"
              value={config.retryConfig.retryDelay}
              onChange={(e) => handleConfigChange('retryConfig', {
                ...config.retryConfig,
                retryDelay: parseInt(e.target.value) || 1000
              })}
              min="100"
              max="10000"
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Response Options */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Response Type</label>
          <select
            value={config.responseType}
            onChange={(e) => handleConfigChange('responseType', e.target.value)}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
          >
            <option value="json">JSON</option>
            <option value="text">Text</option>
            <option value="blob">Binary</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="followRedirects"
            checked={config.followRedirects}
            onChange={(e) => handleConfigChange('followRedirects', e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="followRedirects" className="text-sm text-text-primary">
            Follow redirects automatically
          </label>
        </div>
      </div>
    </div>
  );

  const renderResultsTab = () => (
    <div className="space-y-6">
      {/* Execution History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-text-primary">Request History</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">
              {executionHistory.length} executions
            </span>
            <button
              onClick={fetchExecutionHistory}
              disabled={loadingHistory}
              className="p-1 text-text-muted hover:text-primary transition-colors"
              title="Refresh history"
            >
              <History className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {loadingHistory ? (
          <div className="text-center py-8">
            <History className="w-8 h-8 text-text-muted mx-auto mb-2 animate-spin" />
            <p className="text-text-muted">Loading execution history...</p>
          </div>
        ) : executionHistory.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {executionHistory.map((execution: any, index: number) => (
              <div key={index} className="p-4 bg-surface-secondary/30 rounded-lg border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {execution.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${execution.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                      {execution.status === 'completed' ? 'Success' : 'Failed'}
                    </span>
                    {execution.status_code && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        execution.status_code < 300 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {execution.status_code}
                      </span>
                    )}
                    {execution.response_time && (
                      <span className="text-xs bg-surface-secondary px-2 py-1 rounded">
                        {execution.response_time}ms
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(execution.started_at).toLocaleString()}
                  </span>
                </div>
                
                {(execution.url || execution.node_specific_data?.url) && (
                  <div className="mb-2">
                    <span className="text-xs text-text-muted">URL: </span>
                    <span className="text-xs font-mono text-text-primary break-all">
                      {execution.url || execution.node_specific_data?.url}
                    </span>
                  </div>
                )}
                
                {(execution.method || execution.node_specific_data?.method) && (
                  <div className="mb-2">
                    <span className="text-xs text-text-muted">Method: </span>
                    <span className="text-xs font-mono text-text-primary">
                      {execution.method || execution.node_specific_data?.method}
                    </span>
                  </div>
                )}

                {execution.node_specific_data?.auth_type && (
                  <div className="mb-2">
                    <span className="text-xs text-text-muted">Auth: </span>
                    <span className="text-xs font-mono text-text-primary">
                      {execution.node_specific_data.auth_type}
                    </span>
                  </div>
                )}
                
                <div className="mt-3">
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-primary hover:text-primary/80 list-none">
                      <span className="flex items-center gap-1">
                        Response Data
                        <span className="group-open:rotate-90 transition-transform">▶</span>
                      </span>
                    </summary>
                    <div className="mt-2 p-3 bg-background/50 rounded border border-border-subtle/30">
                      <pre className="text-xs text-text-muted overflow-x-auto whitespace-pre-wrap font-mono">
                        {execution.output_data 
                          ? JSON.stringify(execution.output_data, null, 2)
                          : execution.error_message || 'No response data'
                        }
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <History className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-muted">No executions yet</p>
            <p className="text-sm text-text-muted mt-1">
              Execute this node in a workflow to see results here
            </p>
          </div>
        )}
      </div>
      
      {/* Current Configuration Summary */}
      {config.url && (
        <div className="p-4 bg-surface-secondary/30 rounded-lg border border-border-subtle">
          <h4 className="text-sm font-medium text-text-primary mb-2">Current Configuration</h4>
          <div className="space-y-1 text-xs">
            <div><span className="text-text-muted">Method:</span> <span className="font-mono">{config.method}</span></div>
            <div><span className="text-text-muted">URL:</span> <span className="font-mono break-all">{config.url}</span></div>
            {config.authType && config.authType !== 'none' && (
              <div><span className="text-text-muted">Auth:</span> <span className="font-mono">{config.authType}</span></div>
            )}
            <div><span className="text-text-muted">Timeout:</span> <span className="font-mono">{config.timeout}ms</span></div>
          </div>
        </div>
      )}
    </div>
  );

  const renderLoopTab = () => (
    <div className="space-y-6">
      {/* Loop Configuration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-text-primary">Parameter Looping</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.loopConfig.enabled}
              onChange={(e) => handleConfigChange('loopConfig', { 
                ...config.loopConfig, 
                enabled: e.target.checked 
              })}
              className="rounded border-border-subtle"
            />
            <span className="text-sm text-text-secondary">Enable parameter looping</span>
          </label>
        </div>
        
        <div className="text-sm text-text-muted space-y-2">
          <p>Loop over different parameter values to make multiple HTTP requests and aggregate the results.</p>
          <div className="p-3 bg-surface-secondary/20 rounded border border-border-subtle">
            <div className="text-xs font-medium text-text-primary mb-2">Variable Usage Examples:</div>
            <div className="space-y-1 text-xs font-mono">
              <div><span className="text-text-muted">URL Path:</span> <code>https://api.example.com/users/{`{{userId}}`}/posts</code></div>
              <div><span className="text-text-muted">Query Params:</span> <code>page={`{{page}}`}&limit={`{{limit}}`}</code></div>
              <div><span className="text-text-muted">Headers:</span> <code>X-API-Key: {`{{apiKey}}`}</code></div>
              <div><span className="text-text-muted">Body:</span> <code>{`{"userId": "{{userId}}", "action": "{{action}}"}`}</code></div>
            </div>
          </div>
        </div>
      </div>

      {config.loopConfig.enabled && (
        <>
          {/* Loop Parameters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-text-primary">Loop Parameters</h4>
              <button
                onClick={addLoopParameter}
                className="flex items-center gap-2 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Parameter
              </button>
            </div>
            
            {config.loopConfig.parameters.map((param, index) => renderLoopParameter(param, index))}
            
            {config.loopConfig.parameters.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                <RotateCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No loop parameters defined</p>
                <p className="text-sm mt-1">Add parameters to enable looping</p>
              </div>
            )}
          </div>

          {/* Loop Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-text-primary">Loop Settings</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Concurrency</label>
                <select
                  value={config.loopConfig.concurrency}
                  onChange={(e) => handleConfigChange('loopConfig', { 
                    ...config.loopConfig, 
                    concurrency: parseInt(e.target.value) 
                  })}
                  className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                >
                  <option value={1}>1 (Sequential)</option>
                  <option value={2}>2 requests</option>
                  <option value={3}>3 requests</option>
                  <option value={5}>5 requests</option>
                  <option value={10}>10 requests</option>
                </select>
                <div className="text-xs text-text-muted">How many requests to run in parallel</div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Delay Between Requests</label>
                <input
                  type="number"
                  value={config.loopConfig.delayBetweenRequests}
                  onChange={(e) => handleConfigChange('loopConfig', { 
                    ...config.loopConfig, 
                    delayBetweenRequests: parseInt(e.target.value) || 0 
                  })}
                  className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                  placeholder="100"
                />
                <div className="text-xs text-text-muted">Milliseconds delay between requests</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Result Aggregation</label>
              <select
                value={config.loopConfig.aggregationMode}
                onChange={(e) => handleConfigChange('loopConfig', { 
                  ...config.loopConfig, 
                  aggregationMode: e.target.value as 'append' | 'merge' 
                })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
              >
                <option value="append">Append Results (array of responses)</option>
                <option value="merge">Merge Results (combined object/array)</option>
              </select>
              <div className="text-xs text-text-muted">How to combine results from all iterations</div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.loopConfig.stopOnError}
                onChange={(e) => handleConfigChange('loopConfig', { 
                  ...config.loopConfig, 
                  stopOnError: e.target.checked 
                })}
                className="rounded border-border-subtle"
              />
              <label className="text-sm text-text-secondary">Stop loop on first error</label>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Globe2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-text-primary">HTTP Request</h2>
                  {isConfigured && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <p className="text-text-secondary">Configure API requests with authentication</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-subtle">
          <div className="flex">
            {[
              { id: 'basic', label: 'Basic', icon: Globe2 },
              { id: 'auth', label: 'Authentication', icon: Lock },
              { id: 'headers', label: 'Headers', icon: Key },
              { id: 'loop', label: 'Loop', icon: RotateCw },
              { id: 'advanced', label: 'Advanced', icon: Settings },
              { id: 'results', label: 'Results', icon: History }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && renderBasicTab()}
          {activeTab === 'auth' && renderAuthTab()}
          {activeTab === 'headers' && renderHeadersTab()}
          {activeTab === 'loop' && renderLoopTab()}
          {activeTab === 'advanced' && renderAdvancedTab()}
          {activeTab === 'results' && renderResultsTab()}

          {/* Test Result */}
          {testResult && (
            <div className={`mt-6 p-4 rounded-lg border ${
              testResult.success 
                ? 'bg-green-500/5 border-green-500/20 text-green-400'
                : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="font-medium">Test Result</span>
              </div>
              <div className="text-sm">{testResult.message}</div>
              {testResult.data && (
                <div className="mt-2 p-2 bg-background/50 rounded border border-border-subtle font-mono text-xs overflow-x-auto">
                  {typeof testResult.data === 'string' 
                    ? testResult.data.slice(0, 200) + (testResult.data.length > 200 ? '...' : '')
                    : JSON.stringify(testResult.data, null, 2).slice(0, 400) + '...'
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={testRequest}
                disabled={testing || !config.url}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <TestTube className="w-4 h-4" />
                {testing ? 'Testing...' : 'Test Request'}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
              >
                <CheckCircle className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HttpRequestSetup;