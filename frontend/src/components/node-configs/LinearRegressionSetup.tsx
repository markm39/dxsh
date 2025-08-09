import React, { useState, useEffect } from "react";
import {
  Brain,
  CheckCircle,
  Loader,
  X,
  TrendingUp,
  BarChart3,
  Settings,
  Target,
  Database,
  ArrowRight,
  Monitor,
} from "lucide-react";
import SmartDataRenderer from "../workflow-builder/components/SmartDataRenderer";
import DashboardConnector from "../dashboard-connect/DashboardConnector";

interface ModelConfig {
  modelType: 'linear_regression';
  modelName: string;
  features: string[];
  target: string;
  testSize: number;
  normalize: boolean;
  randomState: number;
}

interface LinearRegressionSetupProps {
  onClose: () => void;
  onSave: (config: ModelConfig) => void;
  initialConfig?: ModelConfig;
  inputData?: any[];
  isConfigured?: boolean;
  isTraining?: boolean;
  trainingResult?: any;
  agentId?: number;
  nodeId?: string;
}

const LinearRegressionSetup: React.FC<LinearRegressionSetupProps> = ({
  onClose,
  onSave,
  initialConfig,
  inputData = [],
  isConfigured = false,
  isTraining = false,
  trainingResult,
  agentId,
  nodeId,
}) => {
  const [config, setConfig] = useState<ModelConfig>({
    modelType: 'linear_regression',
    modelName: 'Linear Regression Model',
    features: [],
    target: '',
    testSize: 0.2,
    normalize: true,
    randomState: 42,
    ...initialConfig
  });

  // Enhanced numeric column detection similar to PostgreSQL node
  const inferColumnType = (values: any[], columnName: string): 'numeric' | 'text' => {
    console.log(`🔍 Analyzing column "${columnName}":`, values);
    
    if (values.length === 0) {
      console.log(`❌ Column "${columnName}": No values, returning text`);
      return 'text';
    }
    
    let numericCount = 0;
    let validValues = 0;
    const debugInfo: any[] = [];
    
    for (const value of values.slice(0, Math.min(100, values.length))) {
      const analysis = { value, type: typeof value, isNull: false, isNumeric: false, reason: '' };
      
      if (value === null || value === undefined || value === '') {
        analysis.isNull = true;
        analysis.reason = 'null/undefined/empty';
        debugInfo.push(analysis);
        continue;
      }
      
      validValues++;
      
      // Check if it's already a number
      if (typeof value === 'number' && !isNaN(value)) {
        numericCount++;
        analysis.isNumeric = true;
        analysis.reason = 'already number';
        debugInfo.push(analysis);
        continue;
      }
      
      // Check if string can be converted to number
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // Handle common numeric formats: "123", "123.45", "$123", "123%", "123,456", ".000", "0"
        const cleaned = trimmed.replace(/[$,%]/g, '');
        
        // Special handling for values like ".000" - add leading zero
        const normalizedValue = cleaned.startsWith('.') ? '0' + cleaned : cleaned;
        
        const canParse = normalizedValue !== '' && !isNaN(parseFloat(normalizedValue)) && isFinite(parseFloat(normalizedValue));
        
        if (canParse) {
          numericCount++;
          analysis.isNumeric = true;
          analysis.reason = `parsed "${trimmed}" -> "${normalizedValue}" -> ${parseFloat(normalizedValue)}`;
        } else {
          analysis.reason = `failed to parse "${trimmed}" -> "${normalizedValue}"`;
        }
        debugInfo.push(analysis);
      } else {
        analysis.reason = `unsupported type: ${typeof value}`;
        debugInfo.push(analysis);
      }
    }
    
    const numericPercentage = validValues > 0 ? (numericCount / validValues) : 0;
    const isNumeric = numericPercentage >= 0.8;
    
    console.log(`📊 Column "${columnName}" analysis:`, {
      totalValues: values.length,
      validValues,
      numericCount,
      numericPercentage: Math.round(numericPercentage * 100) + '%',
      threshold: '80%',
      result: isNumeric ? 'NUMERIC' : 'TEXT',
      debugInfo: debugInfo.slice(0, 5) // Show first 5 for debugging
    });
    
    return isNumeric ? 'numeric' : 'text';
  };

  // Extract available columns from input data
  useEffect(() => {
    if (inputData && inputData.length > 0) {
      const firstRecord = inputData[0];
      if (typeof firstRecord === 'object' && firstRecord !== null) {
        const allColumns = Object.keys(firstRecord);
        
        // Filter out metadata columns (starting with underscore) and analyze numeric columns
        const dataColumns = allColumns.filter(key => !key.startsWith('_'));
        
        const columns = dataColumns.filter(key => {
          // Get sample values for this column
          const sampleValues = inputData.slice(0, Math.min(50, inputData.length))
            .map(record => record[key]);
          
          return inferColumnType(sampleValues, key) === 'numeric';
        });
        
        setAvailableColumns(columns);
        console.log('📊 Available numeric columns:', columns);
        
        // Add overall debugging
        console.log('🔍 INPUT DATA DEBUG:', {
          inputDataLength: inputData.length,
          firstRecord: inputData[0],
          allColumns: allColumns,
          dataColumns: dataColumns,
          finalNumericColumns: columns
        });
      }
    }
  }, [inputData]);

  // Update config when initialConfig changes (e.g., when opening an existing node)
  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({
        ...prev,
        ...initialConfig
      }));
    }
  }, [initialConfig]);

  // No auto-save - only save when user clicks the save button

  const [loading] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'features' | 'advanced'>('features');
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);

  const handleSave = () => {
    // Validate configuration
    if (config.features.length === 0) {
      alert('Please select at least one feature column.');
      return;
    }
    if (!config.target) {
      alert('Please select a target column.');
      return;
    }
    if (config.features.includes(config.target)) {
      alert('Target column cannot be the same as a feature column.');
      return;
    }

    const finalConfig = {
      modelType: config.modelType,
      modelName: config.modelName.trim() || 'Linear Regression Model',
      features: config.features,
      target: config.target,
      testSize: config.testSize,
      normalize: config.normalize,
      randomState: config.randomState
    };
    
    console.log('💾 Saving linear regression config:', finalConfig);
    onSave(finalConfig);
  };

  const toggleFeature = (column: string) => {
    setConfig(prev => ({
      ...prev,
      features: prev.features.includes(column)
        ? prev.features.filter(f => f !== column)
        : [...prev.features, column]
    }));
  };

  const setTarget = (column: string) => {
    setConfig(prev => ({ ...prev, target: column }));
  };


  return (
    <>
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-text-primary">
                    Linear Regression Setup
                  </h2>
                  {isConfigured && !isTraining && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {isTraining && (
                    <Loader className="h-5 w-5 animate-spin text-blue-500" />
                  )}
                </div>
                <p className="text-text-secondary">
                  Train machine learning models on your data
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
            {/* Model Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Model Name
              </label>
              <input
                type="text"
                value={config.modelName}
                onChange={(e) => setConfig(prev => ({ ...prev, modelName: e.target.value }))}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                placeholder="Enter model name..."
              />
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-surface rounded-lg p-1">
              <button
                onClick={() => setActiveTab('features')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'features'
                    ? 'bg-background text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Target className="w-4 h-4" />
                  Feature Selection
                </div>
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'advanced'
                    ? 'bg-background text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" />
                  Advanced Options
                </div>
              </button>
            </div>

            {/* Feature Selection Tab */}
            {activeTab === 'features' && (
              <div className="space-y-6">
                {availableColumns.length > 0 ? (
                  <>
                    {/* Features Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        <label className="text-sm font-medium text-text-primary">
                          Feature Columns (Inputs)
                        </label>
                      </div>
                      <p className="text-xs text-text-muted">
                        Select the columns to use as input features for prediction.
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {availableColumns.map((column) => (
                          <label
                            key={column}
                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                              config.features.includes(column)
                                ? 'border-blue-500 bg-blue-500/10 text-blue-700'
                                : 'border-border-subtle bg-surface hover:border-border hover:bg-surface-secondary'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={config.features.includes(column)}
                              onChange={() => toggleFeature(column)}
                              disabled={column === config.target}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="text-sm font-medium truncate">{column}</span>
                          </label>
                        ))}
                      </div>
                      {config.features.length > 0 && (
                        <div className="text-xs text-text-muted">
                          Selected {config.features.length} feature{config.features.length !== 1 ? 's' : ''}: {config.features.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Target Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-orange-500" />
                        <label className="text-sm font-medium text-text-primary">
                          Target Column (Output)
                        </label>
                      </div>
                      <p className="text-xs text-text-muted">
                        Select the column you want to predict.
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {availableColumns.map((column) => (
                          <label
                            key={column}
                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                              config.target === column
                                ? 'border-orange-500 bg-orange-500/10 text-orange-700'
                                : 'border-border-subtle bg-surface hover:border-border hover:bg-surface-secondary'
                            }`}
                          >
                            <input
                              type="radio"
                              name="target"
                              checked={config.target === column}
                              onChange={() => setTarget(column)}
                              disabled={config.features.includes(column)}
                              className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 focus:ring-orange-500 focus:ring-2"
                            />
                            <span className="text-sm font-medium truncate">{column}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Configuration Summary */}
                    {config.features.length > 0 && config.target && (
                      <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowRight className="w-4 h-4 text-green-600" />
                          <h4 className="font-medium text-green-700">Model Configuration</h4>
                        </div>
                        <div className="text-sm text-green-700">
                          <div><strong>Features:</strong> {config.features.join(', ')}</div>
                          <div><strong>Target:</strong> {config.target}</div>
                          <div><strong>Prediction:</strong> Use {config.features.join(', ')} to predict {config.target}</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <p className="text-yellow-700 text-sm">
                      <strong>⚠️ No numeric data detected.</strong> This node requires structured data with numeric columns. Connect a data source with numeric columns (like CSV data, API responses with numbers, etc.) to configure the model.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Model Type Info */}
            <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h4 className="font-medium text-blue-400">
                  Linear Regression
                </h4>
              </div>
              <p className="text-sm text-text-muted">
                Predicts continuous numerical values using linear relationships between features. 
                Best for problems where the target increases/decreases proportionally with features.
              </p>
            </div>

            {/* Sample Input Data */}
            {activeTab === 'features' && inputData.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-text-primary">Sample Input Data</h4>
                <div className="bg-surface rounded-lg border border-border-subtle p-4">
                  <div className="max-h-40 overflow-y-auto">
                    <SmartDataRenderer data={inputData.slice(0, 3)} />
                  </div>
                  {inputData.length > 3 && (
                    <p className="text-xs text-text-muted mt-2">
                      ...and {inputData.length - 3} more records
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'features' && inputData.length === 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  💡 <strong>Preview Note:</strong> Input data is available during workflow execution. Connect this node to a data source and use the Execute button in the workflow to train models with live data.
                </p>
              </div>
            )}

            {/* Advanced Configuration Tab */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Test Size */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Test Size ({Math.round(config.testSize * 100)}% of data)
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.4"
                      step="0.05"
                      value={config.testSize}
                      onChange={(e) => setConfig(prev => ({ ...prev, testSize: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-1">
                      <span>10%</span>
                      <span>40%</span>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      Percentage of data reserved for testing model performance
                    </p>
                  </div>

                  {/* Normalize Features */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-text-primary">
                        Normalize Features
                      </label>
                      <p className="text-xs text-text-muted">
                        Scale features to similar ranges for better performance
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.normalize}
                        onChange={(e) => setConfig(prev => ({ ...prev, normalize: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Random State */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Random State (for reproducible results)
                    </label>
                    <input
                      type="number"
                      value={config.randomState}
                      onChange={(e) => setConfig(prev => ({ ...prev, randomState: parseInt(e.target.value) || 42 }))}
                      className="w-full bg-background text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                      min="0"
                      max="1000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Training Result */}
            {trainingResult && (
              <div className="space-y-4">
                <h4 className="font-medium text-text-primary">Training Results</h4>
                <div className="bg-surface rounded-lg border border-border-subtle p-4">
                  <div className="bg-background rounded border border-border-subtle p-3 max-h-64 overflow-y-auto">
                    <pre className="text-sm text-text-primary whitespace-pre-wrap">
                      {typeof trainingResult === 'string' 
                        ? trainingResult 
                        : JSON.stringify(trainingResult, null, 2)
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
            <div className="flex gap-3">
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
              disabled={loading || config.features.length === 0 || !config.target}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create ML Model
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Dashboard Connector Modal */}
    {showDashboardConnector && agentId && nodeId && (
      <DashboardConnector
        agentId={agentId}
        nodeId={nodeId}
        nodeType="linearRegression"
        nodeLabel="Linear Regression Model"
        nodeOutputType="modelData"
        onClose={() => setShowDashboardConnector(false)}
        onConnect={(widgetId) => {
          console.log('Connected to widget:', widgetId);
          setShowDashboardConnector(false);
        }}
      />
    )}
    </>
  );
};

export default LinearRegressionSetup;