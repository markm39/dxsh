import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  CheckCircle,
  Loader,
  X,
  ArrowUpFromLine,
  ArrowDownToLine,
  Upload,
  Download,
  TestTube,
  AlertCircle,
  File,
  FileJson,
  FileSpreadsheet,
  FileType,
  FolderOpen,
  Eye,
  Save,
  Monitor
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  InputVariable,
  detectDataTypeInfo,
  DataShape,
  ColumnMapping,
  SchemaField
} from "../workflow-builder/workflow-types";
import ColumnMappingInterface from "../workflow-builder/components/ColumnMappingInterface";
import DashboardConnector from "../dashboard-connect/DashboardConnector";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// File type configurations
const FILE_TYPES = {
  json: { 
    icon: FileJson, 
    extensions: ['.json'], 
    description: 'JSON files - JavaScript Object Notation',
    supports: { source: true, sink: true }
  },
  csv: { 
    icon: FileSpreadsheet, 
    extensions: ['.csv'], 
    description: 'CSV files - Comma Separated Values',
    supports: { source: true, sink: true }
  },
  excel: { 
    icon: FileSpreadsheet, 
    extensions: ['.xlsx', '.xls'], 
    description: 'Excel spreadsheets',
    supports: { source: true, sink: true }
  },
  txt: { 
    icon: FileType, 
    extensions: ['.txt'], 
    description: 'Text files - Plain text',
    supports: { source: true, sink: true }
  },
  doc: { 
    icon: FileType, 
    extensions: ['.doc', '.docx'], 
    description: 'Word documents',
    supports: { source: true, sink: false }
  }
};

interface FileNodeConfig {
  operationMode: 'source' | 'sink';
  
  // File selection
  fileName?: string;
  filePath?: string;
  fileType?: string;
  
  // Source mode options
  loadFile?: boolean;
  sheetName?: string; // For Excel files
  hasHeaders?: boolean; // For CSV/Excel files
  delimiter?: string; // For CSV files
  encoding?: string; // Text encoding
  
  // Sink mode options
  saveFile?: boolean;
  outputFileName?: string;
  outputPath?: string;
  overwriteExisting?: boolean;
  createDirectories?: boolean;
  
  // Advanced options
  maxRows?: number; // Limit for source mode
  skipRows?: number; // Skip rows for source mode
  dateFormat?: string; // Date parsing format
  includeMetadata?: boolean; // Include file metadata in output
  
  // Field selection
  selectedFields?: string[]; // For source mode - which fields to output
  fieldMappings?: ColumnMapping[]; // For sink mode - how to map input fields to file columns
}

interface FileNodeSetupProps {
  onClose: () => void;
  onSave: (config: FileNodeConfig) => void;
  initialConfig?: FileNodeConfig;
  inputData?: any[];
  isConfigured?: boolean;
  inputVariables?: InputVariable[];
  agentId?: number;
  nodeId?: string;
}

const FileNodeSetup: React.FC<FileNodeSetupProps> = ({
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
  
  // State management
  const [config, setConfig] = useState<FileNodeConfig>({
    operationMode: 'source',
    hasHeaders: true,
    delimiter: ',',
    encoding: 'utf-8',
    overwriteExisting: false,
    createDirectories: true,
    includeMetadata: false,
    ...initialConfig
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isPreviewingFile, setIsPreviewingFile] = useState(false);
  const [filePreview, setFilePreview] = useState<any>(null);
  const [fileDataTypeInfo, setFileDataTypeInfo] = useState<any>(null);
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Detect file type from filename
  const getFileType = useCallback((fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    for (const [type, info] of Object.entries(FILE_TYPES)) {
      if (info.extensions.some(extension => extension === `.${ext}`)) {
        return type;
      }
    }
    return 'txt'; // Default fallback
  }, []);

  // Update file type when filename changes
  useEffect(() => {
    if (config.fileName) {
      const detectedType = getFileType(config.fileName);
      setConfig(prev => ({ ...prev, fileType: detectedType }));
    }
  }, [config.fileName, getFileType]);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setConfig(prev => ({
        ...prev,
        fileName: file.name,
        fileType: getFileType(file.name)
      }));
    }
  }, [getFileType]);

  // Upload file to server
  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // For FormData uploads, don't set Content-Type header - let browser set it with boundary
      const uploadHeaders = { ...authHeaders };
      delete uploadHeaders['Content-Type'];

      const response = await fetch(`${API_BASE_URL}/api/v1/file-node/upload`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📁 Upload response:', result);
      
      if (!result.file?.path) {
        throw new Error('Upload response missing file path');
      }
      
      setConfig(prev => ({
        ...prev,
        filePath: result.file.path,
        fileName: selectedFile.name,
        fileType: getFileType(selectedFile.name)
      }));

      console.log('📁 Updated config with filePath:', result.file.path);
      setSelectedFile(null);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, authHeaders]);

  // Test file loading
  const testFileOperation = useCallback(async () => {
    if (config.operationMode === 'source' && !config.filePath && !selectedFile) {
      setTestError('Please select a file first');
      return;
    }

    // For source mode, require either filePath or uploaded file
    if (config.operationMode === 'source' && !config.filePath) {
      setTestError('Please upload the file first before testing');
      return;
    }

    setIsTestingConnection(true);
    setTestError(null);
    setTestResult(null);

    try {
      const endpoint = config.operationMode === 'source' ? 'load' : 'save';
      
      // Prepare request body with proper validation
      let requestBody;
      if (config.operationMode === 'source') {
        // For source mode, ensure we have required fields
        requestBody = {
          ...config,
          // Ensure we have the essential fields
          filePath: config.filePath,
          fileName: config.fileName,
          fileType: config.fileType,
          operationMode: 'source',
          // Include file parsing options
          hasHeaders: config.hasHeaders ?? true,
          delimiter: config.delimiter || ',',
          encoding: config.encoding || 'utf-8',
          maxRows: config.maxRows || 100, // Limit for testing
          skipRows: config.skipRows || 0
        };
      } else {
        // For sink mode
        if (inputData.length === 0) {
          setTestError('No input data available for testing');
          return;
        }
        requestBody = { 
          ...config, 
          inputData: inputData.slice(0, 10), // Sample data for save test
          operationMode: 'sink'
        };
      }

      console.log('🧪 Testing file operation with payload:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/v1/file-node/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ File operation test failed:', errorText);
        throw new Error(`Test failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      setTestResult(result);
      console.log('✅ File operation test successful:', result);
    } catch (error) {
      console.error('❌ File operation test error:', error);
      setTestError(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setIsTestingConnection(false);
    }
  }, [config, inputData, authHeaders, selectedFile]);

  // Preview file content
  const previewFileContent = useCallback(async () => {
    if (!config.filePath && !selectedFile) {
      setTestError('Please select a file first');
      return;
    }

    setIsPreviewingFile(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/file-node/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ ...config, maxRows: 10 }),
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }

      const result = await response.json();
      setFilePreview(result.data);
      
      // Detect data types from the preview
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const dataTypeInfo = detectDataTypeInfo(result.data);
        setFileDataTypeInfo(dataTypeInfo);
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setIsPreviewingFile(false);
    }
  }, [config, selectedFile, authHeaders]);

  // Handle save
  const handleSave = useCallback(() => {
    // Validate configuration
    if (config.operationMode === 'source') {
      if (!config.filePath) {
        if (selectedFile) {
          setTestError('Please upload the selected file first by clicking the Upload button');
        } else {
          setTestError('Please select and upload a file for loading');
        }
        return;
      }
      
      // Additional validation for source mode
      if (!config.fileName) {
        setTestError('File name is missing');
        return;
      }
    }

    if (config.operationMode === 'sink' && !config.outputFileName) {
      setTestError('Please specify an output filename for saving');
      return;
    }

    console.log('💾 Saving FileNode config:', config);
    console.log('💾 FilePath check:', config.filePath ? 'PRESENT' : 'MISSING');
    onSave(config);
  }, [config, selectedFile, onSave]);

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    const typeInfo = FILE_TYPES[fileType as keyof typeof FILE_TYPES];
    const IconComponent = typeInfo?.icon || File;
    return <IconComponent className="w-4 h-4" />;
  };

  // Handle config changes
  const handleConfigChange = useCallback((field: keyof FileNodeConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
    setTestError(null);
  }, []);

  const currentFileType = config.fileType ? FILE_TYPES[config.fileType as keyof typeof FILE_TYPES] : null;
  const canOperateInMode = currentFileType?.supports[config.operationMode] ?? true;

  return (
    <>
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-text-primary">File Node</h2>
                  {isConfigured && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <p className="text-text-secondary">Load data from files or save data to files</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Operation Mode Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">Operation Mode</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleConfigChange('operationMode', 'source')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  config.operationMode === 'source'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-border-subtle hover:border-orange-500/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <ArrowUpFromLine className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-text-primary">Load from File (Source)</span>
                </div>
                <p className="text-sm text-text-secondary text-left">
                  Read data from files and output structured data
                </p>
              </button>

              <button
                onClick={() => handleConfigChange('operationMode', 'sink')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  config.operationMode === 'sink'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-border-subtle hover:border-orange-500/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <ArrowDownToLine className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-text-primary">Save to File (Sink)</span>
                </div>
                <p className="text-sm text-text-secondary text-left">
                  Save input data to files in various formats
                </p>
              </button>
            </div>
          </div>

          {/* File Selection for Source Mode */}
          {config.operationMode === 'source' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">File Selection</h3>
              
              {/* File Upload */}
              <div className="border-2 border-dashed border-border-subtle rounded-lg p-6 text-center">
                <FolderOpen className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <div className="space-y-4">
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".json,.csv,.xlsx,.xls,.txt,.doc,.docx"
                      onChange={handleFileSelect}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Select File
                    </label>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        {getFileTypeIcon(getFileType(selectedFile.name))}
                        <span>{selectedFile.name}</span>
                        <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        onClick={handleFileUpload}
                        disabled={isUploading}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors disabled:opacity-50"
                      >
                        {isUploading ? (
                          <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                          'Upload'
                        )}
                      </button>
                    </div>
                  )}

                  {config.fileName && (
                    <div className="text-sm text-green-600 flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Current file: {config.fileName}
                    </div>
                  )}
                </div>
              </div>

              {/* File Type Specific Options */}
              {config.fileType && (
                <div className="space-y-4">
                  <h4 className="font-medium text-text-primary">File Options</h4>
                  
                  {(config.fileType === 'csv' || config.fileType === 'excel') && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.hasHeaders ?? true}
                          onChange={(e) => handleConfigChange('hasHeaders', e.target.checked)}
                          className="rounded border-border-subtle"
                        />
                        <span className="text-sm text-text-secondary">First row contains headers</span>
                      </label>

                      {config.fileType === 'csv' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-text-primary">Delimiter</label>
                          <select
                            value={config.delimiter || ','}
                            onChange={(e) => handleConfigChange('delimiter', e.target.value)}
                            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                          >
                            <option value=",">Comma (,)</option>
                            <option value=";">Semicolon (;)</option>
                            <option value="\t">Tab</option>
                            <option value="|">Pipe (|)</option>
                          </select>
                        </div>
                      )}

                      {config.fileType === 'excel' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-text-primary">Sheet Name (optional)</label>
                          <input
                            type="text"
                            value={config.sheetName || ''}
                            onChange={(e) => handleConfigChange('sheetName', e.target.value)}
                            placeholder="Leave empty for first sheet"
                            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Max Rows (optional)</label>
                      <input
                        type="number"
                        value={config.maxRows || ''}
                        onChange={(e) => handleConfigChange('maxRows', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="All rows"
                        className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Skip Rows</label>
                      <input
                        type="number"
                        value={config.skipRows || 0}
                        onChange={(e) => handleConfigChange('skipRows', parseInt(e.target.value) || 0)}
                        className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Output Configuration for Sink Mode */}
          {config.operationMode === 'sink' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Output Configuration</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Output Filename</label>
                  <input
                    type="text"
                    value={config.outputFileName || ''}
                    onChange={(e) => handleConfigChange('outputFileName', e.target.value)}
                    placeholder="output_data.json"
                    className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Output Path (optional)</label>
                  <input
                    type="text"
                    value={config.outputPath || ''}
                    onChange={(e) => handleConfigChange('outputPath', e.target.value)}
                    placeholder="/path/to/output/directory"
                    className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.overwriteExisting ?? false}
                      onChange={(e) => handleConfigChange('overwriteExisting', e.target.checked)}
                      className="rounded border-border-subtle"
                    />
                    <span className="text-sm text-text-secondary">Overwrite existing files</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.createDirectories ?? true}
                      onChange={(e) => handleConfigChange('createDirectories', e.target.checked)}
                      className="rounded border-border-subtle"
                    />
                    <span className="text-sm text-text-secondary">Create directories if needed</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Input Data Preview for Sink Mode */}
          {config.operationMode === 'sink' && inputData.length > 0 && (() => {
            // Use existing table extraction utility (from PostgresSetup)
            const extractTablesFromInput = (data: any[]): { [tableName: string]: any[] } => {
              if (!data || data.length === 0) return {};
              
              // Check if this is a multi-table structure (array with objects containing table names as keys)
              const firstItem = data[0];
              if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
                const keys = Object.keys(firstItem);
                
                // Check if all values are arrays (indicating table structure)
                const isMultiTableStructure = keys.every(key => Array.isArray(firstItem[key]));
                
                if (isMultiTableStructure) {
                  console.log('🗂️ Detected multi-table structure:', keys);
                  return firstItem as { [tableName: string]: any[] };
                }
              }
              
              // Regular array structure - treat as single unnamed table
              console.log('📋 Detected regular array structure');
              return { 'input_data': data };
            };
            
            const extractedTables = extractTablesFromInput(inputData);
            const tableNames = Object.keys(extractedTables);
            const isMultiTable = tableNames.length > 1 || (tableNames.length === 1 && tableNames[0] !== 'input_data');
            
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-primary">Input Data Analysis</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                      {tableNames.length} {isMultiTable ? 'tables' : 'table'} detected
                    </span>
                    <span className="text-xs text-text-muted">
                      {inputData.length} records
                    </span>
                  </div>
                </div>

                {/* Show detected tables */}
                <div className="space-y-4">
                  {tableNames.map((tableName, tableIndex) => {
                    const tableData = extractedTables[tableName];
                    const tableSchema = detectDataTypeInfo(tableData);
                    
                    return (
                      <div key={tableName} className="border border-border-subtle rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-text-primary">
                              {tableName === 'input_data' ? 'Main Data' : tableName}
                            </h4>
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                              {tableSchema.schema?.length || 0} fields
                            </span>
                          </div>
                          <span className="text-xs text-text-muted">
                            {tableData.length} records
                          </span>
                        </div>
                        
                        {/* Table Schema */}
                        {tableSchema.schema && tableSchema.schema.length > 0 && (
                          <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                            <div className="text-xs font-medium text-text-primary mb-2">
                              Available Fields ({tableSchema.schema.length})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {tableSchema.schema.map((field: SchemaField, fieldIndex: number) => (
                                <div key={fieldIndex} className="flex items-center gap-2 text-xs">
                                  <span className="font-medium text-text-primary">{field.name}</span>
                                  <span className="text-text-muted">({field.type})</span>
                                  {field.optional && <span className="text-yellow-400">optional</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Sample Data */}
                        <div className="bg-surface rounded-lg border border-border-subtle p-3">
                          <div className="text-xs font-medium text-text-primary mb-2">Sample Data</div>
                          <div className="max-h-32 overflow-y-auto">
                            <pre className="text-xs text-text-secondary font-mono">
                              {JSON.stringify(tableData.slice(0, 3), null, 2)}
                            </pre>
                            {tableData.length > 3 && (
                              <div className="text-xs text-text-muted mt-2">
                                ...and {tableData.length - 3} more records
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Field Selection for this table */}
                        {tableSchema.schema && tableSchema.schema.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-text-primary">Select Fields to Save</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const allMappings = tableSchema.schema!.map((field: SchemaField) => ({
                                      sourceField: isMultiTable ? `${tableName}.${field.name}` : field.name,
                                      targetColumn: field.name,
                                      dataType: field.type,
                                      transform: 'string' as const,
                                      tableName: tableName,
                                      tableIndex
                                    }));
                                    const currentMappings = config.fieldMappings || [];
                                    const otherTableMappings = currentMappings.filter((m: any) => m.tableIndex !== tableIndex);
                                    handleConfigChange('fieldMappings', [...otherTableMappings, ...allMappings]);
                                  }}
                                  className="px-2 py-1 text-xs bg-primary hover:bg-primary-hover text-white rounded transition-colors"
                                >
                                  Select All
                                </button>
                                <button
                                  onClick={() => {
                                    const currentMappings = config.fieldMappings || [];
                                    const filteredMappings = currentMappings.filter((m: any) => m.tableIndex !== tableIndex);
                                    handleConfigChange('fieldMappings', filteredMappings);
                                  }}
                                  className="px-2 py-1 text-xs bg-surface-secondary hover:bg-surface text-text-muted rounded transition-colors"
                                >
                                  Clear All
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-surface-secondary rounded-lg border border-border-subtle p-3">
                              {tableSchema.schema.map((field: SchemaField, fieldIndex: number) => {
                                const fieldPath = isMultiTable ? `${tableName}.${field.name}` : field.name;
                                const isSelected = (config.fieldMappings || []).some((m: any) => 
                                  m.sourceField === fieldPath && m.tableIndex === tableIndex
                                );
                                return (
                                  <div
                                    key={fieldIndex}
                                    className={`p-2 rounded border cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                        : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                                    }`}
                                    onClick={() => {
                                      const currentMappings = config.fieldMappings || [];
                                      const newMappings = isSelected
                                        ? currentMappings.filter((m: any) => !(m.sourceField === fieldPath && m.tableIndex === tableIndex))
                                        : [...currentMappings, {
                                            sourceField: fieldPath,
                                            targetColumn: field.name,
                                            dataType: field.type,
                                            transform: 'string' as const,
                                            tableName: tableName,
                                            tableIndex
                                          }];
                                      handleConfigChange('fieldMappings', newMappings);
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                          {field.name}
                                        </div>
                                        <div className="text-xs text-text-muted">
                                          {field.type} {field.optional && '(optional)'}
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center ml-2">
                                          <span className="text-white text-xs">✓</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Selected Fields Summary */}
                  {config.fieldMappings && config.fieldMappings.length > 0 && (
                    <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                      <div className="text-xs font-medium text-text-primary mb-2">
                        Selected fields to save ({config.fieldMappings.length}):
                      </div>
                      <div className="space-y-1">
                        {tableNames.map((tableName, tableIndex) => {
                          const tableFields = (config.fieldMappings || []).filter((m: any) => m.tableIndex === tableIndex);
                          if (tableFields.length === 0) return null;
                          return (
                            <div key={tableIndex} className="text-xs">
                              <span className="font-medium text-orange-400">
                                {tableName === 'input_data' ? 'Main Data' : tableName}:
                              </span>
                              <span className="text-orange-300 ml-2">
                                {tableFields.map((m: any) => m.targetColumn).join(', ')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Raw data option */}
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-text-primary">
                        Save Mode
                      </div>
                      <button
                        onClick={() => handleConfigChange('fieldMappings', [])}
                        className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                      >
                        Save Raw Data Instead
                      </button>
                    </div>
                    <div className="text-xs text-blue-400">
                      Choose "Save Raw Data Instead" to preserve the original nested structure without field selection.
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Enhanced File Preview for Source Mode */}
          {config.operationMode === 'source' && filePreview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">File Data Preview</label>
                {fileDataTypeInfo && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                      {fileDataTypeInfo.shape}
                    </span>
                    <span className="text-xs text-text-muted">
                      {Array.isArray(filePreview) ? `${filePreview.length} rows` : '1 record'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Data Type Schema */}
              {fileDataTypeInfo?.schema && (
                <div className="bg-surface-secondary rounded-lg border border-border-subtle p-3">
                  <div className="text-xs font-medium text-text-primary mb-2">
                    Detected Fields ({fileDataTypeInfo.schema.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {fileDataTypeInfo.schema.map((field: SchemaField, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-text-primary">{field.name}</span>
                        <span className="text-text-muted">({field.type})</span>
                        {field.optional && <span className="text-yellow-400">optional</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sample Data */}
              <div className="bg-surface rounded-lg border border-border-subtle p-3">
                <div className="text-xs font-medium text-text-primary mb-2">Sample Data</div>
                <div className="max-h-32 overflow-y-auto">
                  <pre className="text-xs text-text-secondary font-mono">
                    {JSON.stringify(Array.isArray(filePreview) ? filePreview.slice(0, 3) : filePreview, null, 2)}
                  </pre>
                  {Array.isArray(filePreview) && filePreview.length > 3 && (
                    <div className="text-xs text-text-muted mt-2">
                      ...and {filePreview.length - 3} more records
                    </div>
                  )}
                </div>
              </div>
              
              {/* Field Selection for Source Mode */}
              {fileDataTypeInfo?.schema && fileDataTypeInfo.schema.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-primary">Select Fields to Output</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const allFields = fileDataTypeInfo.schema.map((f: SchemaField) => f.name);
                          handleConfigChange('selectedFields', allFields);
                        }}
                        className="px-2 py-1 text-xs bg-primary hover:bg-primary-hover text-white rounded transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleConfigChange('selectedFields', [])}
                        className="px-2 py-1 text-xs bg-surface-secondary hover:bg-surface text-text-muted rounded transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-surface-secondary rounded-lg border border-border-subtle p-3">
                    {fileDataTypeInfo.schema.map((field: SchemaField, index: number) => {
                      const isSelected = (config.selectedFields || []).includes(field.name);
                      return (
                        <div
                          key={field.name}
                          className={`p-2 rounded border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                              : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                          }`}
                          onClick={() => {
                            const currentFields = config.selectedFields || [];
                            const newFields = isSelected
                              ? currentFields.filter(f => f !== field.name)
                              : [...currentFields, field.name];
                            handleConfigChange('selectedFields', newFields);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {field.name}
                              </div>
                              <div className="text-xs text-text-muted">
                                {field.type} {field.optional && '(optional)'}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center ml-2">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {config.selectedFields && config.selectedFields.length > 0 && (
                    <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                      <div className="text-xs font-medium text-text-primary mb-1">
                        Selected fields ({config.selectedFields.length}):
                      </div>
                      <div className="text-xs text-orange-400">
                        {config.selectedFields.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Test Results */}
          {testResult && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">Test Successful</span>
              </div>
              <div className="text-xs text-text-secondary">
                {config.operationMode === 'source' 
                  ? `Loaded ${Array.isArray(testResult.data) ? testResult.data.length : 1} records`
                  : 'File saved successfully'
                }
              </div>
            </div>
          )}

          {/* Test Error */}
          {testError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">Test Failed</span>
              </div>
              <div className="text-xs text-red-400">{testError}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {config.operationMode === 'source' && (config.filePath || selectedFile) && (
                <button
                  onClick={previewFileContent}
                  disabled={isPreviewingFile}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {isPreviewingFile ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Preview
                </button>
              )}
              
              <button
                onClick={testFileOperation}
                disabled={isTestingConnection || (!config.filePath && !selectedFile && config.operationMode === 'source')}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isTestingConnection ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
              >
                Cancel
              </button>
              {agentId && nodeId && (
                <button
                  onClick={() => {
                    setShowDashboardConnector(true);
                    setConnectionSuccess(null); // Reset success state when opening
                  }}
                  className="px-4 py-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  Connect to Dashboard
                </button>
              )}
              <button
                onClick={handleSave}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
              >
                <Save className="w-4 h-4" />
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Dashboard Connector Modal */}
    {showDashboardConnector && agentId && nodeId && config.operationMode === 'source' && (
      <DashboardConnector
        agentId={agentId}
        nodeId={nodeId}
        nodeType="fileNode"
        nodeLabel="File Node"
        nodeOutputType={
          config.fileType === 'json' ? 'STRUCTURED_DATA' :
          config.fileType === 'csv' || config.fileType === 'excel' ? 'STRUCTURED_DATA' :
          config.fileType === 'txt' ? 'TEXT_DATA' :
          'RAW_DATA'
        }
        onClose={() => {
          setShowDashboardConnector(false);
          setConnectionSuccess(null); // Reset success state when closing
        }}
        onConnect={(widgetId) => {
          console.log('Connected to widget:', widgetId);
          setConnectionSuccess(`Successfully connected to widget ${widgetId}`);
          // Don't immediately close - let user see success and choose to close
        }}
        successMessage={connectionSuccess}
      />
    )}
    </>
  );
};

export default FileNodeSetup;