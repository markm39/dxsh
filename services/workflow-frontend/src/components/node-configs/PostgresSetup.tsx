import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  CheckCircle,
  Loader,
  X,
  ArrowUpFromLine,
  ArrowDownToLine,
  Eye,
  EyeOff,
  TestTube,
  AlertCircle,
  Table,
  ChevronRight,
  Hash,
  Key,
  FileText,
  Code,
  ArrowRight,
  Info,
  Monitor,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  InputVariable,
  ColumnMapping,
  detectDataTypeInfo,
  substituteInputVariables,
  generateColumnMappings,
  DataShape
} from "../workflow-builder/workflow-types";
import ColumnMappingInterface from "../workflow-builder/components/ColumnMappingInterface";
import DashboardConnector from "../dashboard-connect/DashboardConnector";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Helper function to extract tables from multi-table structure (moved outside component)
const extractTablesFromInput = (data: any[]): { [tableName: string]: any[] } => {
  if (!data || data.length === 0) return {};
  
  // Check if this is a multi-table structure (array with objects containing table names as keys)
  const firstItem = data[0];
  if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
    const keys = Object.keys(firstItem);
    
    // Check if all values are arrays (indicating table structure)
    const isMultiTableStructure = keys.every(key => Array.isArray(firstItem[key]));
    
    if (isMultiTableStructure) {
      console.log(' Detected multi-table structure:', keys);
      return firstItem as { [tableName: string]: any[] };
    }
  }
  
  // Regular array structure - treat as single unnamed table
  console.log(' Detected regular array structure');
  return { 'input_data': data };
};

interface PostgresConfig {
  operationMode: 'source' | 'sink';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  
  // Source mode (query data)
  query?: string;
  
  // Sink mode (insert data) - support multiple tables
  selectedInputTables?: string[]; // Which input tables to process
  tableMappings?: Array<{
    inputTable: string;
    targetTable: string;
    insertMode: 'insert' | 'upsert';
    conflictColumns: string[];
    columnMappings: ColumnMapping[];
    createDynamically?: boolean;
  }>;
  
  // Legacy single table support (for backward compatibility)
  tableName?: string;
  insertMode?: 'insert' | 'upsert';
  conflictColumns?: string[];
  columnMappings?: ColumnMapping[];
  createTableDynamically?: boolean;
  dynamicTableName?: string;
  selectedColumnTypes?: { [key: string]: string }; // User-selected column types for dynamic table creation
}

interface PostgresSetupProps {
  onClose: () => void;
  onSave: (config: PostgresConfig) => void;
  initialConfig?: PostgresConfig;
  inputData?: any[];
  isConfigured?: boolean;
  inputVariables?: InputVariable[]; // Available input variables from connected nodes
  agentId?: number;
  nodeId?: string;
}

const PostgresSetup: React.FC<PostgresSetupProps> = ({
  onClose,
  onSave,
  initialConfig,
  inputData = [],
  isConfigured = false,
  inputVariables = [],
  agentId,
  nodeId,
}) => {
  const { authHeaders } = useAuth();
  const [config, setConfig] = useState<PostgresConfig>({
    operationMode: 'source',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    query: 'SELECT * FROM your_table LIMIT 10;',
    
    // Multi-table support
    selectedInputTables: [],
    tableMappings: [],
    
    // Legacy single table support
    tableName: '',
    insertMode: 'insert',
    conflictColumns: [],
    columnMappings: [],
    createTableDynamically: false,
    dynamicTableName: '',
    
    ...initialConfig
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; } | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Table exploration
  const [showTableExplorer, setShowTableExplorer] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [tableDetails, setTableDetails] = useState<any>(null);
  const [loadingTableDetails, setLoadingTableDetails] = useState(false);
  
  // Input variables and column mapping
  const [showInputVariables, setShowInputVariables] = useState(false);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>(config.columnMappings || []);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  
  // Schema analysis for dynamic table creation
  const [schemaAnalysis, setSchemaAnalysis] = useState<any>(null);
  const [loadingSchemaAnalysis, setLoadingSchemaAnalysis] = useState(false);
  const [selectedColumnTypes, setSelectedColumnTypes] = useState<{ [key: string]: string }>({});
  
  // Use useMemo to prevent infinite re-computation
  const { availableTables, tableNames, isMultiTableInput } = useMemo(() => {
    const tables = extractTablesFromInput(inputData);
    const names = Object.keys(tables);
    const isMultiTable = names.length > 1 || (names.length === 1 && names[0] !== 'input_data');
    
    return {
      availableTables: tables,
      tableNames: names,
      isMultiTableInput: isMultiTable
    };
  }, [inputData]);
  
  // Detect input data type info - use first available table for schema detection
  const inputDataTypeInfo = useMemo(() => {
    return tableNames.length > 0 
      ? detectDataTypeInfo(availableTables[tableNames[0]]) 
      : null;
  }, [availableTables, tableNames]);

  // State for managing selected input table for single-table mode
  const [selectedInputTable, setSelectedInputTable] = useState<string>('');
  
  // Dashboard connector state
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);
  
  // Update selected input table when available tables change
  useEffect(() => {
    if (tableNames.length > 0 && !selectedInputTable) {
      setSelectedInputTable(tableNames[0]);
    } else if (tableNames.length === 0) {
      setSelectedInputTable('');
    } else if (selectedInputTable && !tableNames.includes(selectedInputTable)) {
      // If the currently selected table is no longer available, select the first one
      setSelectedInputTable(tableNames[0] || '');
    }
  }, [tableNames, selectedInputTable]); // Fixed dependencies

  // Update config when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({
        ...prev,
        ...initialConfig
      }));
      setColumnMappings(initialConfig.columnMappings || []);
    }
  }, [initialConfig]);
  
  // Auto-generate column mappings when input data or table details change
  useEffect(() => {
    if (config.operationMode === 'sink' && inputDataTypeInfo && tableDetails && 
        (inputDataTypeInfo.shape === DataShape.ARRAY_OF_OBJECTS || inputDataTypeInfo.shape === DataShape.OBJECT)) {
      const schema = inputDataTypeInfo.schema || [];
      const autoMappings = generateColumnMappings(schema, tableDetails.columns || []);
      setColumnMappings(autoMappings);
      // Don't call handleConfigChange here to avoid infinite loop
      setConfig(prev => ({ ...prev, columnMappings: autoMappings }));
    }
  }, [inputDataTypeInfo, tableDetails]); // Removed config.operationMode to prevent loop

  const handleConfigChange = (field: keyof PostgresConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear test result when config changes
    setTestResult(null);
  };

  
  const insertInputVariable = (variableName: string) => {
    const currentQuery = config.query || '';
    const cursorPosition = (document.getElementById('postgres-query') as HTMLTextAreaElement)?.selectionStart || currentQuery.length;
    const beforeCursor = currentQuery.substring(0, cursorPosition);
    const afterCursor = currentQuery.substring(cursorPosition);
    const newQuery = beforeCursor + `$${variableName}` + afterCursor;
    handleConfigChange('query', newQuery);
  };
  
  const getPreviewQuery = () => {
    if (!config.query) return '';
    return substituteInputVariables(config.query, inputVariables);
  };
  
  const handleColumnMappingChange = (index: number, field: keyof ColumnMapping, value: any) => {
    const updatedMappings = [...columnMappings];
    updatedMappings[index] = { ...updatedMappings[index], [field]: value };
    setColumnMappings(updatedMappings);
    handleConfigChange('columnMappings', updatedMappings);
  };

  
  const addColumnMapping = () => {
    const newMapping: ColumnMapping = {
      sourceField: '',
      targetColumn: '',
      transform: 'string'
    };
    const updatedMappings = [...columnMappings, newMapping];
    setColumnMappings(updatedMappings);
    handleConfigChange('columnMappings', updatedMappings);
  };
  
  const removeColumnMapping = (index: number) => {
    const updatedMappings = columnMappings.filter((_, i) => i !== index);
    setColumnMappings(updatedMappings);
    handleConfigChange('columnMappings', updatedMappings);
  };

  const fetchTableDetails = async (tableName: string) => {
    // Only attempt to fetch if we have connection details
    if (!config.host || !config.database || !config.username || !config.password) {
      return;
    }

    setLoadingTableDetails(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/postgres/table-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port || 5432,
          database: config.database,
          username: config.username,
          password: config.password,
          table_name: tableName,
          schema: 'public' // Default schema
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTableDetails(result);
        console.log(` Fetched table details for ${tableName}:`, result);
      } else {
        console.warn(` Failed to fetch table details for ${tableName}:`, result.error);
        // Don't show error to user - table might not exist yet, which is okay
      }
    } catch (error) {
      console.warn(` Error fetching table details for ${tableName}:`, error);
      // Silent fail - table might not exist
    } finally {
      setLoadingTableDetails(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/postgres/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password,
          operation_mode: config.operationMode,
          query: config.operationMode === 'source' ? config.query : undefined,
          table_name: config.operationMode === 'sink' ? config.tableName : undefined
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTestResult({
          success: true,
          message: result.message || 'Connection successful!'
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadTables = async () => {
    setLoadingTables(true);
    setTables([]);
    setSelectedTable(null);
    setTableDetails(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/postgres/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTables(result.tables || []);
        setShowTableExplorer(true);
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Failed to load tables'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error loading tables: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoadingTables(false);
    }
  };

  const handleSelectTable = async (table: any) => {
    setSelectedTable(table);
    setLoadingTableDetails(true);
    setTableDetails(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/postgres/table-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password,
          table_name: table.table_name,
          schema: table.table_schema
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTableDetails(result);
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Failed to load table details'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error loading table details: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoadingTableDetails(false);
    }
  };

  const handleUseTable = (table: any) => {
    if (config.operationMode === 'source') {
      // Generate a SELECT query for the table
      const query = `SELECT * FROM ${table.table_schema}.${table.table_name} LIMIT 100;`;
      handleConfigChange('query', query);
    } else {
      // Set table name for sink mode
      handleConfigChange('tableName', table.table_name);
    }
    setShowTableExplorer(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Validate required fields
      const requiredFields = ['host', 'database', 'username', 'password'];
      const missingFields = requiredFields.filter(field => !config[field as keyof PostgresConfig]);
      
      if (missingFields.length > 0) {
        setTestResult({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
        return;
      }

      if (config.operationMode === 'source' && !config.query?.trim()) {
        setTestResult({
          success: false,
          message: 'Query is required for source mode'
        });
        return;
      }

      if (config.operationMode === 'sink' && !config.tableName?.trim() && !config.createTableDynamically) {
        setTestResult({
          success: false,
          message: 'Table name is required for sink mode (or enable dynamic table creation)'
        });
        return;
      }

      if (config.operationMode === 'sink' && config.createTableDynamically && !config.dynamicTableName?.trim()) {
        setTestResult({
          success: false,
          message: 'Dynamic table name is required when creating table dynamically'
        });
        return;
      }

      if (config.operationMode === 'sink' && config.insertMode === 'upsert' && (!config.conflictColumns || config.conflictColumns.length === 0)) {
        setTestResult({
          success: false,
          message: 'Conflict columns are required for upsert mode. Please select primary keys or unique columns.'
        });
        return;
      }

      // Include selected column types if dynamic table creation is enabled and schema was analyzed
      const finalConfig = {
        ...config,
        selectedColumnTypes: config.createTableDynamically && schemaAnalysis ? selectedColumnTypes : undefined
      };
      
      console.log(' Saving PostgreSQL config:', finalConfig);
      onSave(finalConfig);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-text-primary">
                    PostgreSQL Database
                  </h2>
                  {isConfigured && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <p className="text-text-secondary">
                  Connect to PostgreSQL for data extraction or insertion
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
          
          {/* Operation Mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-primary">
              Operation Mode
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => handleConfigChange('operationMode', 'source')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  config.operationMode === 'source'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-border-subtle bg-surface hover:bg-surface-secondary text-text-muted'
                }`}
              >
                <ArrowUpFromLine className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium">Source (Query)</div>
                  <div className="text-xs opacity-80">Extract data from database</div>
                </div>
              </button>
              <button
                onClick={() => handleConfigChange('operationMode', 'sink')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  config.operationMode === 'sink'
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-border-subtle bg-surface hover:bg-surface-secondary text-text-muted'
                }`}
              >
                <ArrowDownToLine className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium">Sink (Insert)</div>
                  <div className="text-xs opacity-80">Insert data into database</div>
                </div>
              </button>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Host</label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => handleConfigChange('host', e.target.value)}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Port</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value) || 5432)}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                placeholder="5432"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Database</label>
              <input
                type="text"
                value={config.database}
                onChange={(e) => handleConfigChange('database', e.target.value)}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                placeholder="database_name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Username</label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                placeholder="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={config.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none pr-10"
                placeholder="password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mode-specific Configuration */}
          {config.operationMode === 'source' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-primary">SQL Query</label>
                  {inputVariables.length > 0 && (
                    <button
                      onClick={() => setShowInputVariables(!showInputVariables)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <Code className="w-3 h-3" />
                      Input Variables ({inputVariables.length})
                    </button>
                  )}
                </div>
                <textarea
                  id="postgres-query"
                  value={config.query}
                  onChange={(e) => handleConfigChange('query', e.target.value)}
                  rows={4}
                  className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none font-mono text-sm"
                  placeholder="SELECT * FROM your_table WHERE condition = $input LIMIT 100;"
                />
                <p className="text-xs text-text-muted">
                  Write a SELECT query to extract data from your database. Use $input for input variables.
                </p>
              </div>
              
              {/* Input Variables Panel */}
              {showInputVariables && inputVariables.length > 0 && (
                <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-text-primary">Available Input Variables</span>
                  </div>
                  <div className="space-y-2">
                    {inputVariables.map((variable, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-surface rounded border border-border-subtle/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                              ${variable.name}
                            </code>
                            <span className="text-xs text-text-muted">
                              {variable.typeInfo.shape} • {variable.typeInfo.type}
                            </span>
                          </div>
                          {variable.typeInfo.exampleValue && (
                            <div className="text-xs text-text-muted mt-1 font-mono">
                              Example: {JSON.stringify(variable.typeInfo.exampleValue).substring(0, 50)}
                              {JSON.stringify(variable.typeInfo.exampleValue).length > 50 && '...'}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => insertInputVariable(variable.name)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          Insert
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Query Preview */}
              {inputVariables.length > 0 && config.query && config.query.includes('$') && (
                <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-text-primary">Query Preview (with substituted values)</span>
                  </div>
                  <pre className="text-xs text-green-300 font-mono bg-surface rounded p-2 border border-border-subtle/50">
                    {getPreviewQuery()}
                  </pre>
                </div>
              )}
            </div>
          )}

          {config.operationMode === 'sink' && (
            <div className="space-y-4">
              {/* Input Table Selection */}
              {isMultiTableInput && tableNames.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-text-primary">
                    Input Tables ({tableNames.length} available)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tableNames.map((tableName) => (
                      <div key={tableName} className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedInputTable === tableName
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                      }`}
                      onClick={() => setSelectedInputTable(tableName)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="inputTable"
                            checked={selectedInputTable === tableName}
                            onChange={() => setSelectedInputTable(tableName)}
                            className="w-4 h-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-text-primary text-sm">
                              {tableName}
                            </div>
                            <div className="text-xs text-text-muted">
                              {availableTables[tableName]?.length || 0} rows
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sink Mode Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-text-primary">Sink Mode</label>
                <div className="space-y-2">
                  <div className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    !config.createTableDynamically 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="existingTable"
                        name="sinkMode"
                        checked={!config.createTableDynamically}
                        onChange={() => handleConfigChange('createTableDynamically', false)}
                        className="w-4 h-4"
                      />
                      <div>
                        <label htmlFor="existingTable" className="font-medium text-text-primary cursor-pointer">
                          Insert into existing table
                        </label>
                        <p className="text-xs text-text-muted">Map input data to existing table columns</p>
                      </div>
                    </div>
                  </div>
                  
                  {inputData.length > 0 && inputDataTypeInfo && (
                    <div className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      config.createTableDynamically 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="createTableDynamically"
                          name="sinkMode"
                          checked={config.createTableDynamically || false}
                          onChange={() => handleConfigChange('createTableDynamically', true)}
                          className="w-4 h-4"
                        />
                        <div>
                          <label htmlFor="createTableDynamically" className="font-medium text-text-primary cursor-pointer">
                            Create table dynamically
                          </label>
                          <p className="text-xs text-text-muted">Auto-generate table from input data structure</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Table Configuration */}
              {!config.createTableDynamically && (
                <div className="space-y-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Table Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={config.tableName || ''}
                        onChange={(e) => {
                          handleConfigChange('tableName', e.target.value);
                          // Clear table details when table name changes
                          if (tableDetails) {
                            setTableDetails(null);
                          }
                        }}
                        onBlur={() => {
                          // Fetch table details when user finishes typing
                          if (config.tableName?.trim()) {
                            fetchTableDetails(config.tableName.trim());
                          }
                        }}
                        className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                        placeholder="existing_table_name"
                      />
                      {loadingTableDetails && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Table Details Preview */}
                    {tableDetails && (
                      <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3 text-xs">
                        <div className="text-text-primary font-medium mb-2">
                          Table: {tableDetails.schema}.{tableDetails.table_name} ({tableDetails.row_count} rows)
                        </div>
                        <div className="text-text-muted">
                          {tableDetails.columns?.length || 0} columns available for mapping
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Insert Mode</label>
                    <select
                      value={config.insertMode || 'insert'}
                      onChange={(e) => handleConfigChange('insertMode', e.target.value as 'insert' | 'upsert')}
                      className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                    >
                      <option value="insert">Insert (fail on duplicates)</option>
                      <option value="upsert">Upsert (update on conflict)</option>
                    </select>
                  </div>

                  {/* Conflict Columns Configuration for Upsert Mode */}
                  {config.insertMode === 'upsert' && tableDetails?.columns && (
                    <div className="space-y-3 bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">
                          Conflict Columns (Required for Upsert)
                        </label>
                        <p className="text-xs text-text-muted">
                          Select columns to check for conflicts. Usually primary keys or unique columns.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {tableDetails.columns.map((column: any) => {
                          const isSelected = (config.conflictColumns || []).includes(column.column_name);
                          const isPrimaryKey = tableDetails.primary_keys?.includes(column.column_name);
                          
                          return (
                            <div
                              key={column.column_name}
                              className={`p-2 rounded border cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-orange-500 bg-orange-500/10' 
                                  : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                              }`}
                              onClick={() => {
                                const currentConflictColumns = config.conflictColumns || [];
                                const updatedColumns = isSelected
                                  ? currentConflictColumns.filter(col => col !== column.column_name)
                                  : [...currentConflictColumns, column.column_name];
                                handleConfigChange('conflictColumns', updatedColumns);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // Handled by parent div click
                                  className="w-4 h-4"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-text-primary truncate">
                                      {column.column_name}
                                    </span>
                                    {isPrimaryKey && (
                                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1 rounded">
                                        PK
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-text-muted truncate">
                                    {column.data_type}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Auto-suggest primary keys */}
                      {tableDetails.primary_keys && tableDetails.primary_keys.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              handleConfigChange('conflictColumns', tableDetails.primary_keys);
                            }}
                            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            Use Primary Keys
                          </button>
                          <span className="text-xs text-text-muted">
                            Recommended: {tableDetails.primary_keys.join(', ')}
                          </span>
                        </div>
                      )}
                      
                      {/* Show current selection */}
                      {config.conflictColumns && config.conflictColumns.length > 0 && (
                        <div className="p-2 bg-surface-secondary rounded border border-border-subtle">
                          <div className="text-xs text-text-primary font-medium mb-1">
                            Selected conflict columns:
                          </div>
                          <div className="text-xs text-orange-400">
                            {config.conflictColumns.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Column Mapping Section */}
                  {(() => {
                    // Get data for the selected input table
                    const selectedTableData = selectedInputTable && availableTables[selectedInputTable] 
                      ? availableTables[selectedInputTable] 
                      : inputData;
                    
                    const selectedTableTypeInfo = selectedTableData.length > 0 
                      ? detectDataTypeInfo(selectedTableData) 
                      : null;
                    
                    // Transform PostgreSQL columns to match expected interface
                    const transformedColumns = tableDetails?.columns?.map((col: any) => ({
                      name: col.column_name,
                      type: col.data_type,
                      description: col.column_default ? `Default: ${col.column_default}` : undefined
                    })) || [];

                    return selectedTableData.length > 0 && selectedTableTypeInfo?.schema ? (
                      <ColumnMappingInterface
                        inputFields={selectedTableTypeInfo.schema}
                        targetColumns={transformedColumns}
                        mappings={config.columnMappings || []}
                        onMappingChange={(mappings) => handleConfigChange('columnMappings', mappings)}
                        disabled={!config.tableName?.trim()}
                      />
                    ) : null;
                  })()}
                  
                  {/* Show message to select table first */}
                  {!config.tableName?.trim() && inputData.length > 0 && inputDataTypeInfo && (
                    <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-center">
                      <Info className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                      <p className="text-sm text-text-muted">Enter a table name above to enable column mapping</p>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Table Creation Configuration */}
              {config.createTableDynamically && (() => {
                const selectedTableData = selectedInputTable && availableTables[selectedInputTable] 
                  ? availableTables[selectedInputTable] 
                  : inputData;
                
                const selectedTableTypeInfo = selectedTableData.length > 0 
                  ? detectDataTypeInfo(selectedTableData) 
                  : null;

                return selectedTableData.length > 0 && selectedTableTypeInfo ? (
                  <div className="space-y-3 bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Dynamic Table Name</label>
                      <input
                        type="text"
                        value={config.dynamicTableName || selectedInputTable || ''}
                        onChange={(e) => handleConfigChange('dynamicTableName', e.target.value)}
                        className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                        placeholder={selectedInputTable || "auto_generated_table"}
                      />
                      {isMultiTableInput && (
                        <div className="text-xs text-text-muted">
                           Processing table: <span className="font-medium text-blue-400">{selectedInputTable}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Schema Analysis Button */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={async () => {
                          setLoadingSchemaAnalysis(true);
                          try {
                            const response = await fetch(`${API_BASE_URL}/api/v1/postgres/analyze-schema`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...authHeaders
                              },
                              body: JSON.stringify({
                                data: selectedTableData
                              })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                              setSchemaAnalysis(result);
                              // Initialize selected types with inferred types
                              const initialTypes: { [key: string]: string } = {};
                              result.columns.forEach((col: any) => {
                                initialTypes[col.original_name] = col.inferred_type;
                              });
                              setSelectedColumnTypes(initialTypes);
                            } else {
                              setTestResult({
                                success: false,
                                message: result.error || 'Failed to analyze schema'
                              });
                            }
                          } catch (error) {
                            setTestResult({
                              success: false,
                              message: `Schema analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`
                            });
                          } finally {
                            setLoadingSchemaAnalysis(false);
                          }
                        }}
                        disabled={loadingSchemaAnalysis || selectedTableData.length === 0}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loadingSchemaAnalysis ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4" />
                            Analyze Schema
                          </>
                        )}
                      </button>
                      
                      {schemaAnalysis && (
                        <span className="text-xs text-text-muted">
                          {schemaAnalysis.row_count} rows analyzed
                        </span>
                      )}
                    </div>
                    
                    {/* Schema Analysis Results */}
                    {schemaAnalysis ? (
                      <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                        <div className="text-sm font-medium text-text-primary mb-3">Column Type Selection</div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {schemaAnalysis.columns.map((col: any, index: number) => (
                            <div key={index} className="p-3 bg-surface rounded-lg border border-border-subtle">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium text-text-primary text-sm">{col.original_name}</div>
                                  <div className="text-xs text-text-muted">→ {col.clean_name}</div>
                                </div>
                                <select
                                  value={selectedColumnTypes[col.original_name] || col.inferred_type}
                                  onChange={(e) => {
                                    setSelectedColumnTypes({
                                      ...selectedColumnTypes,
                                      [col.original_name]: e.target.value
                                    });
                                  }}
                                  className="px-2 py-1 bg-surface-secondary text-text-primary text-xs rounded border border-border-subtle focus:border-primary focus:outline-none"
                                >
                                  {col.possible_types.map((type: any, typeIndex: number) => (
                                    <option key={typeIndex} value={type.type}>
                                      {type.type} {type.confidence < 100 ? `(${type.confidence}%)` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              {/* Sample values */}
                              <div className="text-xs text-text-muted">
                                <span className="font-medium">Samples:</span>{' '}
                                {col.sample_values.slice(0, 3).map((val: any, i: number) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    <span className="text-blue-400">
                                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                    </span>
                                  </span>
                                ))}
                                {col.sample_values.length > 3 && '...'}
                              </div>
                              
                              {/* Type descriptions */}
                              <div className="mt-1 text-xs text-text-muted italic">
                                {col.possible_types.find((t: any) => t.type === (selectedColumnTypes[col.original_name] || col.inferred_type))?.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                        <div className="text-sm font-medium text-text-primary mb-2">Auto-Generated Schema Preview</div>
                        <div className="space-y-1">
                          {selectedTableTypeInfo.schema?.map((field, index) => (
                            <div key={index} className="flex items-center justify-between text-xs">
                              <span className="text-text-primary font-medium">{field.name}</span>
                              <span className="text-text-muted">{field.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Show message if no input data for dynamic table creation */}
              {config.createTableDynamically && (!inputData.length || !inputDataTypeInfo) && (
                <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-center">
                  <Info className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <p className="text-sm text-text-muted">Connect input data to enable dynamic table creation</p>
                </div>
              )}

              {/* Input Data Preview */}
              {inputData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-primary">Input Data</label>
                    {inputDataTypeInfo && (
                      <span className="text-xs text-text-muted">
                        {inputDataTypeInfo.shape} • {Array.isArray(inputData) ? inputData.length : 1} items
                      </span>
                    )}
                  </div>
                  <div className="bg-surface rounded-lg border border-border-subtle p-3 max-h-32 overflow-y-auto">
                    <pre className="text-xs text-text-secondary font-mono">
                      {JSON.stringify(inputData.slice(0, 3), null, 2)}
                    </pre>
                    {inputData.length > 3 && (
                      <p className="text-xs text-text-muted mt-2">
                        ...and {inputData.length - 3} more records
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Column Mapping */}
              {inputDataTypeInfo && tableDetails && 
               (inputDataTypeInfo.shape === DataShape.ARRAY_OF_OBJECTS || inputDataTypeInfo.shape === DataShape.OBJECT) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-primary">Column Mapping</label>
                    <button
                      onClick={() => setShowColumnMapping(!showColumnMapping)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {showColumnMapping ? 'Hide' : 'Show'} Mapping ({columnMappings.length})
                    </button>
                  </div>
                  
                  {(showColumnMapping || columnMappings.length === 0) && (
                    <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                      <div className="space-y-3">
                        {columnMappings.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-sm text-text-muted mb-2">No column mappings defined</p>
                            <button
                              onClick={addColumnMapping}
                              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              Add Mapping
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-text-primary">
                              <div className="col-span-4">Source Field</div>
                              <div className="col-span-1 text-center">→</div>
                              <div className="col-span-4">Target Column</div>
                              <div className="col-span-2">Transform</div>
                              <div className="col-span-1"></div>
                            </div>
                            {columnMappings.map((mapping, index) => (
                              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                <select
                                  value={mapping.sourceField}
                                  onChange={(e) => handleColumnMappingChange(index, 'sourceField', e.target.value)}
                                  className="col-span-4 bg-surface text-text-primary p-2 rounded border border-border-subtle text-xs"
                                >
                                  <option value="">Select source field...</option>
                                  {inputDataTypeInfo.schema?.map(field => (
                                    <option key={field.name} value={field.name}>{field.name}</option>
                                  ))}
                                </select>
                                <ArrowRight className="col-span-1 w-3 h-3 text-text-muted mx-auto" />
                                <select
                                  value={mapping.targetColumn}
                                  onChange={(e) => handleColumnMappingChange(index, 'targetColumn', e.target.value)}
                                  className="col-span-4 bg-surface text-text-primary p-2 rounded border border-border-subtle text-xs"
                                >
                                  <option value="">Select target column...</option>
                                  {tableDetails.columns?.map((col: any) => (
                                    <option key={col.column_name} value={col.column_name}>
                                      {col.column_name} ({col.data_type})
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={mapping.transform || 'string'}
                                  onChange={(e) => handleColumnMappingChange(index, 'transform', e.target.value)}
                                  className="col-span-2 bg-surface text-text-primary p-2 rounded border border-border-subtle text-xs"
                                >
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="date">Date</option>
                                  <option value="json">JSON</option>
                                </select>
                                <button
                                  onClick={() => removeColumnMapping(index)}
                                  className="col-span-1 p-1 text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={addColumnMapping}
                              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              Add Mapping
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Test Connection & Browse Tables */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {testing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>

              <button
                onClick={handleLoadTables}
                disabled={loadingTables || !config.host || !config.database || !config.username || !config.password}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loadingTables ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Table className="w-4 h-4" />
                    Browse Tables
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border ${
                testResult.success 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table Explorer Modal */}
        {showTableExplorer && (
          <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-6xl w-full max-h-[80vh] flex">
              {/* Tables List */}
              <div className="w-1/3 border-r border-border-subtle">
                <div className="p-4 border-b border-border-subtle">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-text-primary">Database Tables</h3>
                    <button
                      onClick={() => setShowTableExplorer(false)}
                      className="p-1 rounded hover:bg-surface transition-colors"
                    >
                      <X className="w-4 h-4 text-text-muted" />
                    </button>
                  </div>
                  <p className="text-sm text-text-muted mt-1">{tables.length} tables found</p>
                </div>
                
                <div className="overflow-y-auto max-h-[60vh]">
                  {tables.map((table, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectTable(table)}
                      className={`w-full text-left p-3 border-b border-border-subtle/50 hover:bg-surface transition-colors ${
                        selectedTable?.table_name === table.table_name ? 'bg-primary/10 border-primary/30' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-text-primary text-sm">
                            {table.table_name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {table.table_schema} • {table.estimated_rows || 0} rows • {table.column_count} columns
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Details */}
              <div className="flex-1 flex flex-col">
                {selectedTable ? (
                  <>
                    <div className="p-4 border-b border-border-subtle">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-text-primary">
                            {selectedTable.table_schema}.{selectedTable.table_name}
                          </h3>
                          <p className="text-sm text-text-muted">
                            {tableDetails?.row_count || selectedTable.estimated_rows || 0} rows • {selectedTable.column_count} columns
                          </p>
                        </div>
                        <button
                          onClick={() => handleUseTable(selectedTable)}
                          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm transition-colors"
                        >
                          Use This Table
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {loadingTableDetails ? (
                        <div className="flex items-center justify-center h-32">
                          <Loader className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : tableDetails ? (
                        <div className="space-y-4">
                          {/* Columns */}
                          <div>
                            <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                              <Hash className="w-4 h-4" />
                              Columns ({tableDetails.columns.length})
                            </h4>
                            <div className="space-y-1">
                              {tableDetails.columns.map((column: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-surface rounded border border-border-subtle/50">
                                  <div className="flex items-center gap-2">
                                    {tableDetails.primary_keys.includes(column.column_name) && (
                                      <Key className="w-3 h-3 text-yellow-500" />
                                    )}
                                    <span className="font-medium text-text-primary text-sm">
                                      {column.column_name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-text-muted">
                                    {column.data_type}
                                    {column.character_maximum_length && `(${column.character_maximum_length})`}
                                    {column.is_nullable === 'NO' && ' • NOT NULL'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Sample Data */}
                          {tableDetails.sample_data && tableDetails.sample_data.length > 0 && (
                            <div>
                              <h4 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Sample Data ({tableDetails.sample_data.length} rows)
                              </h4>
                              <div className="overflow-x-auto">
                                <div className="bg-surface rounded border border-border-subtle p-3">
                                  <pre className="text-xs text-text-secondary font-mono">
                                    {JSON.stringify(tableDetails.sample_data, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-text-muted">
                          <div className="text-center">
                            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Select a table to view details</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-text-muted">
                    <div className="text-center">
                      <Table className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg">Select a table to explore</p>
                      <p className="text-sm">Choose a table from the list to view its structure and sample data</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              {agentId && nodeId && (
                <button
                  onClick={() => setShowDashboardConnector(true)}
                  className="px-4 py-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  Connect to Dashboard
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Configuration
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
          nodeType="postgres"
          nodeLabel={config.operationMode === 'source' ? 'PostgreSQL Query' : 'PostgreSQL Insert'}
          nodeOutputType={config.operationMode === 'source' ? "structuredData" : "textData"}
          onClose={() => setShowDashboardConnector(false)}
          onConnect={(widgetId) => {
            console.log(`Connected PostgreSQL ${nodeId} to widget ${widgetId}`);
            setShowDashboardConnector(false);
          }}
        />
      )}
    </div>
  );
};

export default PostgresSetup;