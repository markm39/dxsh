/**
 * Chart Widget Configuration Component
 * 
 * Interactive field selection for chart widgets consuming node data
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  LineChart,
  PieChart,
  Settings,
  X,
  Eye,
  CheckCircle,
  AlertCircle,
  Palette,
  Grid,
  Info,
  Database,
  Table,
  ChevronDown,
  ChevronRight,
  Layers,
  Activity,
  Zap,
  TrendingUp,
  Disc,
} from 'lucide-react';
import type { DashboardWidget, ChartWidgetConfig } from '@shared/types';
import { useWidgetData } from '../../hooks/useWidgetData';
import { analyzeDataStructure, getPrimaryTable, getChartFieldOptions, type FieldInfo, type TableInfo } from '../../utils/dataAnalysis';

interface ChartWidgetConfigProps {
  dashboardId: string;
  widget: DashboardWidget;
  onSave: (config: ChartWidgetConfig) => void;
  onClose: () => void;
}

// Chart type options with icons and descriptions
const CHART_TYPES = [
  { 
    value: 'bar', 
    label: 'Bar', 
    icon: BarChart3, 
    description: 'Compare values across categories',
    xAxisType: 'categorical',
    yAxisType: 'numeric',
    allowMultipleY: true
  },
  { 
    value: 'line', 
    label: 'Line', 
    icon: LineChart, 
    description: 'Show trends over time',
    xAxisType: 'any',
    yAxisType: 'numeric',
    allowMultipleY: true
  },
  { 
    value: 'pie', 
    label: 'Pie', 
    icon: PieChart, 
    description: 'Show proportions of a whole',
    xAxisType: 'categorical',
    yAxisType: 'numeric',
    allowMultipleY: false
  },
  { 
    value: 'radar', 
    label: 'Radar', 
    icon: Disc, 
    description: 'Compare multiple metrics',
    xAxisType: 'none',
    yAxisType: 'none',
    allowMultipleY: false,
    customFields: ['categoricalField', 'selectedValues', 'numericFields']
  },
  { 
    value: 'histogram', 
    label: 'Histogram', 
    icon: Activity, 
    description: 'Show distribution of values',
    xAxisType: 'numeric',
    yAxisType: 'none',
    allowMultipleY: false
  },
  { 
    value: 'scatter', 
    label: 'Scatter', 
    icon: Zap, 
    description: 'Show correlation between two variables',
    xAxisType: 'numeric',
    yAxisType: 'numeric',
    allowMultipleY: false,
    customFields: ['labelField']
  },
  { 
    value: 'area', 
    label: 'Area', 
    icon: TrendingUp, 
    description: 'Show trends with filled areas',
    xAxisType: 'any',
    yAxisType: 'numeric',
    allowMultipleY: true
  },
] as const;

// Default color palette
const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
];

const ChartWidgetConfig: React.FC<ChartWidgetConfigProps> = ({
  dashboardId,
  widget,
  onSave,
  onClose,
}) => {
  const { data, isLoading, error } = useWidgetData(dashboardId, widget);
  
  console.log('📊 ChartWidgetConfig - Raw Data:', data);
  console.log('📊 ChartWidgetConfig - Loading:', isLoading);
  console.log('📊 ChartWidgetConfig - Error:', error);
  
  const [config, setConfig] = useState<ChartWidgetConfig>(
    widget.config as ChartWidgetConfig || {
      chartType: 'bar',
      showLegend: true,
      showGrid: true,
      showTooltip: true,
    }
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Analyze data structure using modular utility
  const dataAnalysis = useMemo(() => {
    if (!data) return null;
    return analyzeDataStructure(data);
  }, [data]);

  // Get the primary table and available fields
  const { primaryTable, availableFields } = useMemo(() => {
    if (!dataAnalysis) return { primaryTable: null, availableFields: [] };
    
    const table = getPrimaryTable(dataAnalysis);
    return {
      primaryTable: table,
      availableFields: table ? table.fields : []
    };
  }, [dataAnalysis]);

  // Categorize fields by type for easier selection
  const fieldsByType = useMemo(() => {
    if (!primaryTable) return { numeric: [], categorical: [], temporal: [], other: [] };
    return getChartFieldOptions(primaryTable);
  }, [primaryTable]);

  // Generate preview data when config changes
  useEffect(() => {
    if (!primaryTable || !config.xAxis || !config.yAxis) {
      setPreviewData([]);
      return;
    }

    const preview = primaryTable.data.slice(0, 5).map((item, index) => ({
      ...item,
      _index: index,
    }));
    setPreviewData(preview);
  }, [primaryTable, config.xAxis, config.yAxis]);

  const handleConfigChange = (updates: Partial<ChartWidgetConfig>) => {
    console.log('🔧 Config change:', updates);
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      console.log('🔧 New config:', newConfig);
      return newConfig;
    });
  };

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  // Suggest appropriate field combinations based on data
  const getFieldSuggestions = () => {
    if (!availableFields.length) return null;
    
    const suggestions = [];
    
    // Suggest X-axis (categorical or temporal fields)
    const categoricalFields = fieldsByType.categorical.concat(fieldsByType.temporal);
    if (categoricalFields.length > 0 && !config.xAxis) {
      suggestions.push({
        type: 'xAxis',
        field: categoricalFields[0].key,
        reason: `"${categoricalFields[0].key}" appears to be a good category field for X-axis`,
      });
    }
    
    // Suggest Y-axis (numeric fields)
    const numericFields = fieldsByType.numeric;
    if (numericFields.length > 0 && !config.yAxis) {
      suggestions.push({
        type: 'yAxis',
        field: numericFields[0].key,
        reason: `"${numericFields[0].key}" appears to be a numeric field suitable for Y-axis`,
      });
    }
    
    return suggestions;
  };

  const suggestions = getFieldSuggestions();

  // Get current chart type configuration
  const currentChartType = CHART_TYPES.find(type => type.value === config.chartType);

  // Helper to get appropriate fields for chart type and axis
  const getFieldsForAxis = (axisType: string) => {
    switch (axisType) {
      case 'categorical':
        return [...fieldsByType.categorical, ...fieldsByType.temporal];
      case 'numeric':
        return fieldsByType.numeric;
      case 'any':
        return [...fieldsByType.numeric, ...fieldsByType.categorical, ...fieldsByType.temporal];
      case 'none':
        return [];
      default:
        return [];
    }
  };

  // Check if chart type supports multiple Y-axis fields
  // For single-object arrays (like HTTP request data), allow multiple selection even for pie charts
  const isSingleObjectArray = primaryTable && primaryTable.rowCount === 1 && primaryTable.fields.length > 1;
  const supportsMultipleY = (currentChartType as any)?.allowMultipleY || 
    (config.chartType === 'pie' && isSingleObjectArray);

  // Helper function to get nested values
  const getNestedValue = (obj: any, path: string): any => {
    if (!path) return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  };

  // Get unique values for a categorical field
  const getUniqueValuesForField = (fieldPath: string): string[] => {
    console.log('🔍 getUniqueValuesForField called with:', fieldPath);
    console.log('🔍 Data available:', data?.length || 0, 'items');
    console.log('🔍 Data structure:', data?.[0]);
    
    if (!data || data.length === 0) {
      console.log('❌ No data available');
      return [];
    }
    
    const values = new Set<string>();
    
    // First, let's try to find the data from the primary table analysis
    if (primaryTable && primaryTable.data) {
      console.log('🔍 Using primary table data:', primaryTable.data.length, 'items');
      console.log('🔍 Sample item from primary table:', primaryTable.data[0]);
      
      primaryTable.data.forEach((item: any, index: number) => {
        const value = getNestedValue(item, fieldPath);
        if (index < 3) { // Log first 3 items for debugging
          console.log(`🔍 Primary table item ${index}:`, { item, fieldPath, extractedValue: value });
        }
        if (value !== undefined && value !== null && value !== '') {
          values.add(String(value));
        }
      });
    } else {
      // Fallback to raw data
      console.log('🔍 Using raw data fallback');
      data.forEach((item: any, index: number) => {
        const value = getNestedValue(item, fieldPath);
        if (index < 3) { // Log first 3 items for debugging
          console.log(`🔍 Raw data item ${index}:`, { item, fieldPath, extractedValue: value });
        }
        if (value !== undefined && value !== null && value !== '') {
          values.add(String(value));
        }
      });
    }
    
    const uniqueValues = Array.from(values).sort();
    console.log('🔍 Unique values found:', uniqueValues);
    return uniqueValues;
  };

  // Get display labels for axis based on chart type
  const getAxisLabel = (axis: 'x' | 'y') => {
    if (!currentChartType) return axis === 'x' ? 'X-Axis' : 'Y-Axis';
    
    const chartType = currentChartType.value;
    
    if (axis === 'x') {
      switch (chartType) {
        case 'pie':
          return 'Categories';
        case 'histogram':
          return 'Values';
        case 'radar':
          return 'Metrics';
        default:
          return currentChartType.xAxisType === 'categorical' ? 'Categories' : 
                 currentChartType.xAxisType === 'numeric' ? 'X Values' : 'X-Axis';
      }
    } else {
      switch (chartType) {
        case 'pie':
          return 'Values';
        case 'histogram':
          return null; // No Y-axis for histogram
        case 'radar':
          return supportsMultipleY ? 'Metrics (Multiple)' : 'Values';
        default:
          return supportsMultipleY ? 'Y Values (Multiple)' : 'Values';
      }
    }
  };

  // Check if Y-axis should be hidden for this chart type
  const shouldShowYAxis = currentChartType?.yAxisType !== 'none';

  // Helper functions for nested field management
  const toggleFieldExpansion = (fieldPath: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldPath)) {
      newExpanded.delete(fieldPath);
    } else {
      newExpanded.add(fieldPath);
    }
    setExpandedFields(newExpanded);
  };

  const isFieldExpanded = (fieldPath: string) => expandedFields.has(fieldPath);

  // Helper to get field display value (handles nested paths)
  const getFieldDisplayValue = (field: FieldInfo) => {
    if (field.path && field.path !== field.key) {
      // This is a nested field, show the path
      return field.path;
    }
    return field.key;
  };

  // Helper to determine if a field is selectable for chart axes
  const isFieldSelectable = (field: FieldInfo): boolean => {
    // Direct selectable types
    if (field.type === 'numeric' || field.type === 'categorical' || field.type === 'temporal') {
      return true;
    }
    
    // Object/array fields are selectable if they contain the right nested types
    if (field.type === 'object' || field.type === 'array') {
      if (field.nestedFields) {
        return field.nestedFields.some(nested => 
          nested.type === 'numeric' || nested.type === 'categorical' || nested.type === 'temporal'
        );
      }
    }
    
    return false;
  };

  // Recursive component for rendering nested fields
  const NestedFieldItem: React.FC<{ 
    field: FieldInfo, 
    level: number,
    onFieldSelect: (fieldPath: string) => void
  }> = ({ field, level, onFieldSelect }) => {
    const hasNestedFields = field.nestedFields && field.nestedFields.length > 0;
    const isExpanded = isFieldExpanded(field.path || field.key);
    const isSelected = config.xAxis === (field.path || field.key) || config.yAxis === (field.path || field.key);
    const indentLevel = level * 16; // 16px per level

    return (
      <div className="relative">
        <div
          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
            isSelected
              ? 'border-primary/30 bg-primary/5'
              : 'border-border-subtle/50 hover:border-border-subtle hover:bg-surface-secondary/30'
          }`}
          style={{ marginLeft: `${indentLevel}px` }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {hasNestedFields && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFieldExpansion(field.path || field.key);
                  }}
                  className="p-0.5 rounded hover:bg-surface-secondary transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted" />
                  )}
                </button>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {field.key}
                </span>
                
                {field.path && field.path !== field.key && (
                  <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded font-mono">
                    {field.path}
                  </span>
                )}
                
                {field.uniqueCount !== undefined && (
                  <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">
                    {field.uniqueCount} unique
                  </span>
                )}
                
                {field.depth !== undefined && field.depth > 0 && (
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                    L{field.depth}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                field.type === 'numeric' ? 'bg-blue-500/10 text-blue-400' :
                field.type === 'categorical' ? 'bg-green-500/10 text-green-400' :
                field.type === 'temporal' ? 'bg-purple-500/10 text-purple-400' :
                field.type === 'array' ? 'bg-orange-500/10 text-orange-400' :
                field.type === 'object' ? 'bg-red-500/10 text-red-400' :
                'bg-gray-500/10 text-gray-400'
              }`}>
                {field.type}
              </span>
              
              {/* Clickable for selectable fields */}
              {isFieldSelectable(field) && (
                <button
                  onClick={() => onFieldSelect(field.path || field.key)}
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors"
                >
                  Select
                </button>
              )}
            </div>
          </div>
          
          <p className="text-xs text-text-muted mb-2">{field.description}</p>
          
          <div className="space-y-1">
            <div className="text-xs text-text-muted bg-background/50 px-2 py-1 rounded font-mono">
              Sample: {JSON.stringify(field.sample)?.slice(0, 100)}
              {JSON.stringify(field.sample)?.length > 100 && '...'}
            </div>
            
            {/* Enhanced stats for numeric fields */}
            {field.type === 'numeric' && field.stats && (
              <div className="text-xs text-blue-400/80 bg-blue-500/5 px-2 py-1 rounded">
                Min: {field.stats.min?.toFixed(2)} | Max: {field.stats.max?.toFixed(2)} | Avg: {field.stats.mean?.toFixed(2)}
              </div>
            )}
            
            {/* Null count if significant */}
            {field.nullCount && field.nullCount > 0 && (
              <div className="text-xs text-yellow-400/80 bg-yellow-500/5 px-2 py-1 rounded">
                {field.nullCount} null values
              </div>
            )}
          </div>
        </div>
        
        {/* Nested fields */}
        {hasNestedFields && isExpanded && (
          <div className="mt-2 space-y-2">
            {field.nestedFields!.map((nestedField, index) => (
              <NestedFieldItem
                key={`${nestedField.path || nestedField.key}-${index}`}
                field={nestedField}
                level={level + 1}
                onFieldSelect={onFieldSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Handler for field selection
  const handleFieldSelect = (fieldPath: string, axisType: 'x' | 'y') => {
    if (axisType === 'x') {
      handleConfigChange({ xAxis: fieldPath });
    } else {
      handleConfigChange({ yAxis: fieldPath });
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Configure Chart Widget
                </h2>
                <p className="text-text-secondary text-sm">
                  {widget.title || 'Untitled Chart'} • Interactive field selection
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
          {/* Data Analysis */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-text-secondary">Loading data structure...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">Data Loading Error</p>
                <p className="text-sm text-red-400/80">{error.message}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && (!dataAnalysis || !dataAnalysis.isTable) && (
            <div className="p-6 text-center border-2 border-dashed border-border-subtle rounded-lg">
              <AlertCircle className="w-8 w-8 text-text-muted mx-auto mb-2" />
              <p className="font-medium text-text-primary mb-1">No Table Data Available</p>
              <p className="text-sm text-text-muted mb-2">
                {!dataAnalysis 
                  ? "Execute the connected workflow node to see available fields for charting"
                  : "The connected node doesn't output structured table data suitable for charts"
                }
              </p>
              {dataAnalysis && !dataAnalysis.isTable && (
                <div className="text-xs text-text-muted bg-surface-secondary/30 p-2 rounded">
                  <p>Detected data type: <strong>{dataAnalysis.dataType}</strong></p>
                  {dataAnalysis.dataType === 'array' && <p>Array contains non-tabular data</p>}
                  {dataAnalysis.dataType === 'object' && <p>Object doesn't contain table arrays</p>}
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && dataAnalysis?.isTable && primaryTable && (
            <>
              {/* Enhanced Table Detection Info */}
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Database className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-green-400">Table Data Detected</p>
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                        {Math.round(primaryTable.confidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-green-400/80">
                      <div>
                        <p><strong>Table:</strong> "{primaryTable.name}"</p>
                        <p><strong>Rows:</strong> {primaryTable.rowCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p><strong>Fields:</strong> {primaryTable.fields.length}</p>
                        <p><strong>Type Mix:</strong> {[...new Set(primaryTable.fields.map(f => f.type))].join(', ')}</p>
                      </div>
                    </div>
                    {dataAnalysis.tables.length > 1 && (
                      <p className="text-xs text-green-400/60 mt-2">
                        Found {dataAnalysis.tables.length} tables total. Using highest confidence table.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Field Suggestions */}
              {suggestions && suggestions.length > 0 && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-400 mb-2">Suggested Configuration</p>
                      <div className="space-y-1">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleConfigChange({ [suggestion.type]: suggestion.field })}
                            className="block text-left text-sm text-blue-400/80 hover:text-blue-400 transition-colors"
                          >
                            • {suggestion.reason}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart Configuration */}
                <div className="space-y-6">
                  {/* Chart Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-3">
                      Chart Type
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {CHART_TYPES.map(type => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            onClick={() => handleConfigChange({ chartType: type.value })}
                            className={`p-3 rounded-lg border transition-colors ${
                              config.chartType === type.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border-subtle hover:border-border'
                            }`}
                            title={type.description}
                          >
                            <Icon className="w-5 h-5 mx-auto mb-1" />
                            <div className="text-xs font-medium">{type.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conditional Field Selection */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* X-Axis Field (conditional) */}
                    {currentChartType && currentChartType.xAxisType !== 'none' && 
                     !(config.chartType === 'pie' && isSingleObjectArray) && (
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          {getAxisLabel('x')}
                          <span className="text-text-muted ml-1">
                            ({currentChartType.xAxisType === 'categorical' ? 'Categories' : 
                              currentChartType.xAxisType === 'numeric' ? 'Numbers' : 
                              currentChartType.xAxisType === 'any' ? 'Any Type' : 'Fields'})
                          </span>
                        </label>
                        <select
                          value={config.xAxis || ''}
                          onChange={(e) => handleConfigChange({ xAxis: e.target.value })}
                          className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                        >
                          <option value="">Select field...</option>
                          {getFieldsForAxis(currentChartType.xAxisType).map(field => (
                            <option key={field.path || field.key} value={field.path || field.key}>
                              {getFieldDisplayValue(field)} ({field.description})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Y-Axis Field (conditional) */}
                    {shouldShowYAxis && currentChartType && (
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          {getAxisLabel('y')}
                          <span className="text-text-muted ml-1">
                            ({supportsMultipleY ? 'Multiple selections supported' : 'Single selection'})
                          </span>
                        </label>
                        
                        {supportsMultipleY ? (
                          // Multiple selection for charts like radar, line, area
                          <div className="space-y-2">
                            {getFieldsForAxis(currentChartType.yAxisType).map(field => (
                              <label key={field.path || field.key} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Array.isArray(config.yAxis) ? 
                                    config.yAxis.includes(field.path || field.key) : 
                                    config.yAxis === (field.path || field.key)
                                  }
                                  onChange={(e) => {
                                    const fieldPath = field.path || field.key;
                                    let newYAxis: string | string[];
                                    
                                    if (e.target.checked) {
                                      // Add field
                                      if (Array.isArray(config.yAxis)) {
                                        newYAxis = [...config.yAxis, fieldPath];
                                      } else if (config.yAxis) {
                                        newYAxis = [config.yAxis, fieldPath];
                                      } else {
                                        newYAxis = [fieldPath];
                                      }
                                    } else {
                                      // Remove field
                                      if (Array.isArray(config.yAxis)) {
                                        newYAxis = config.yAxis.filter(y => y !== fieldPath);
                                        if (newYAxis.length === 1) newYAxis = newYAxis[0];
                                      } else {
                                        newYAxis = '';
                                      }
                                    }
                                    
                                    handleConfigChange({ yAxis: newYAxis });
                                  }}
                                  className="rounded border-border-subtle"
                                />
                                <span className="text-sm text-text-primary">
                                  {getFieldDisplayValue(field)} 
                                  <span className="text-text-muted ml-1">({field.description})</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          // Single selection dropdown for most chart types
                          <select
                            value={Array.isArray(config.yAxis) ? config.yAxis[0] || '' : config.yAxis as string || ''}
                            onChange={(e) => handleConfigChange({ yAxis: e.target.value })}
                            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                          >
                            <option value="">Select field...</option>
                            {getFieldsForAxis(currentChartType.yAxisType).map(field => (
                              <option key={field.path || field.key} value={field.path || field.key}>
                                {getFieldDisplayValue(field)} ({field.description})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom Fields for Special Chart Types */}
                  {(currentChartType as any)?.customFields && (
                    <div className="space-y-4 border-t border-border-subtle pt-4">
                      {/* Radar Chart Custom Fields */}
                      {config.chartType === 'radar' && (
                        <>
                          {/* Categorical Field Selection */}
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                              Categorical Field
                              <span className="text-text-muted ml-1">(Lines/Series)</span>
                            </label>
                            <select
                              value={config.categoricalField || ''}
                              onChange={(e) => {
                                handleConfigChange({ 
                                  categoricalField: e.target.value,
                                  selectedValues: [] // Reset selected values when field changes
                                });
                              }}
                              className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                            >
                              <option value="">Select categorical field...</option>
                              {getFieldsForAxis('categorical').map(field => (
                                <option key={field.path || field.key} value={field.path || field.key}>
                                  {getFieldDisplayValue(field)} ({field.description})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Selected Values Checkboxes */}
                          {config.categoricalField && (
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-3">
                                Select Values to Display
                              </label>
                              <div className="max-h-40 overflow-y-auto space-y-2 border border-border-subtle rounded-lg p-3">
                                {getUniqueValuesForField(config.categoricalField).map(value => (
                                  <label key={value} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={config.selectedValues?.includes(value) || false}
                                      onChange={(e) => {
                                        const selectedValues = config.selectedValues || [];
                                        let newValues: string[];
                                        
                                        if (e.target.checked) {
                                          newValues = [...selectedValues, value];
                                        } else {
                                          newValues = selectedValues.filter(v => v !== value);
                                        }
                                        
                                        handleConfigChange({ selectedValues: newValues });
                                      }}
                                      className="rounded border-border-subtle"
                                    />
                                    <span className="text-sm text-text-primary">{value}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Numeric Fields Selection */}
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-3">
                              Numeric Fields
                              <span className="text-text-muted ml-1">(Radar Axes)</span>
                            </label>
                            <div className="space-y-2">
                              {getFieldsForAxis('numeric').map(field => (
                                <label key={field.path || field.key} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={config.numericFields?.includes(field.path || field.key) || false}
                                    onChange={(e) => {
                                      const numericFields = config.numericFields || [];
                                      let newFields: string[];
                                      
                                      if (e.target.checked) {
                                        newFields = [...numericFields, field.path || field.key];
                                      } else {
                                        newFields = numericFields.filter(f => f !== (field.path || field.key));
                                      }
                                      
                                      handleConfigChange({ numericFields: newFields });
                                    }}
                                    className="rounded border-border-subtle"
                                  />
                                  <span className="text-sm text-text-primary">
                                    {getFieldDisplayValue(field)} 
                                    <span className="text-text-muted ml-1">({field.description})</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Scatter Chart Custom Fields */}
                      {config.chartType === 'scatter' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">
                              Label Field
                              <span className="text-text-muted ml-1">(Optional)</span>
                            </label>
                            <select
                              value={config.labelField || ''}
                              onChange={(e) => handleConfigChange({ labelField: e.target.value })}
                              className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                            >
                              <option value="">No labels</option>
                              {getFieldsForAxis('any').map(field => (
                                <option key={field.path || field.key} value={field.path || field.key}>
                                  {getFieldDisplayValue(field)} ({field.description})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Label Display Options */}
                          {config.labelField && (
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-3">
                                Label Display Options
                              </label>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={config.showLabelsOnChart || false}
                                    onChange={(e) => handleConfigChange({ showLabelsOnChart: e.target.checked })}
                                    className="rounded border-border-subtle"
                                  />
                                  <span className="text-sm text-text-primary">Show labels on chart</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={config.showLabelsInTooltip || false}
                                    onChange={(e) => handleConfigChange({ showLabelsInTooltip: e.target.checked })}
                                    className="rounded border-border-subtle"
                                  />
                                  <span className="text-sm text-text-primary">Show labels in tooltip</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chart Options */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-3">
                      Chart Options
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={config.showLegend}
                          onChange={(e) => handleConfigChange({ showLegend: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-text-primary">Show Legend</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={config.showGrid}
                          onChange={(e) => handleConfigChange({ showGrid: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-text-primary">Show Grid</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={config.showTooltip}
                          onChange={(e) => handleConfigChange({ showTooltip: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-text-primary">Show Tooltip</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Data Preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-text-secondary" />
                      <h3 className="text-sm font-medium text-text-primary">
                        Available Fields ({availableFields.length})
                      </h3>
                      {primaryTable && (
                        <span className="text-xs text-text-muted bg-surface-secondary px-2 py-0.5 rounded">
                          from "{primaryTable.name}"
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Palette className="w-3 h-3" />
                      Advanced
                    </button>
                  </div>

                  {/* Enhanced Field List with Nested Navigation */}
                  <div className="bg-surface rounded-lg border border-border-subtle max-h-96 overflow-y-auto">
                    <div className="p-3 space-y-2">
                      {availableFields.map((field, index) => (
                        <NestedFieldItem
                          key={`${field.path || field.key}-${index}`}
                          field={field}
                          level={0}
                          onFieldSelect={(fieldPath) => {
                            // For now, just update the config - later we can add UI to choose axis
                            if (!config.xAxis) {
                              handleConfigChange({ xAxis: fieldPath });
                            } else if (!config.yAxis) {
                              handleConfigChange({ yAxis: fieldPath });
                            }
                          }}
                        />
                      ))}
                      
                      {availableFields.length === 0 && (
                        <div className="text-center py-8 text-text-muted">
                          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No fields available for selection</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Preview */}
                  {previewData.length > 0 && config.xAxis && config.yAxis && (
                    <div>
                      <h4 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Chart Preview (First 5 rows)
                      </h4>
                      <div className="bg-surface rounded-lg border border-border-subtle p-3">
                        <div className="space-y-1">
                          {previewData.map((item, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span className="text-text-primary">{item[config.xAxis!]}</span>
                              <span className="text-text-secondary">{item[config.yAxis as string]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="p-4 bg-surface-secondary rounded-lg border border-border-subtle">
                  <h4 className="font-medium text-text-primary mb-3">Advanced Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        X-Axis Title
                      </label>
                      <input
                        type="text"
                        value={config.xAxisTitle || ''}
                        onChange={(e) => handleConfigChange({ xAxisTitle: e.target.value })}
                        className="w-full bg-background text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                        placeholder="Auto-generated from field name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Y-Axis Title
                      </label>
                      <input
                        type="text"
                        value={config.yAxisTitle || ''}
                        onChange={(e) => handleConfigChange({ yAxisTitle: e.target.value })}
                        className="w-full bg-background text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                        placeholder="Auto-generated from field name"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                (!(config.chartType === 'pie' && isSingleObjectArray) && !config.xAxis) || 
                !config.yAxis
              }
              className="px-8 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save Chart Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Note: Field type inference and description functions are now handled by the modular dataAnalysis utility

export default ChartWidgetConfig;