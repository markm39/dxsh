import React from "react";
import { Eye, Database } from "lucide-react";

interface SelectorConfig {
  id: string;
  selector: string;
  label: string;
  attribute: string;
  elementCount?: number;
  name?: string;
  type?: string;
  fields?: Array<{
    name: string;
    sub_selector: string;
    attribute: string;
  }>;
}

interface DataPreviewPanelProps {
  selectors: SelectorConfig[];
  previewData: any[];
  previewFormat: 'json' | 'table';
  onPreviewFormatChange: (format: 'json' | 'table') => void;
}

const DataPreviewPanel: React.FC<DataPreviewPanelProps> = ({
  selectors,
  previewData,
  previewFormat,
  onPreviewFormatChange,
}) => {
  const renderTablePreview = () => {
    if (previewData.length === 0) return null;

    // Check if we have structured data that should be displayed as tables
    const hasStructuredRows = previewData.length > 0 && 
      typeof previewData[0] === 'object' && 
      !Array.isArray(previewData[0]);

    if (hasStructuredRows) {
      // Handle structured container data (repeating elements)
      const containerData = previewData[0];
      const containerKeys = Object.keys(containerData);
      
      // Look for keys that contain arrays (the actual row data)
      const rowDataKey = containerKeys.find(key => 
        Array.isArray(containerData[key]) && containerData[key].length > 0
      );
      
      if (rowDataKey) {
        const rows = containerData[rowDataKey];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  {columns.map((col) => (
                    <th key={col} className="text-left p-3 text-sm font-medium text-text-primary bg-surface-secondary/30">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row: any, index: number) => (
                  <tr key={index} className="border-b border-border-subtle/50">
                    {columns.map((col) => (
                      <td key={col} className="p-3 text-sm text-text-secondary max-w-xs truncate">
                        {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <div className="text-center py-2 text-sm text-text-secondary">
                ... and {rows.length - 10} more rows
              </div>
            )}
          </div>
        );
      }
    }

    // Handle table data extraction
    const tableSelector = selectors.find(sel => sel.type === 'table');
    
    if (tableSelector) {
      const tableName = tableSelector.name || 'table';
      // Look for table data in the preview
      const tableData = previewData.length > 0 && previewData[0][tableName];
      
      if (tableData && Array.isArray(tableData) && tableData.length > 0) {
        const columns = Object.keys(tableData[0]);

        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  {columns.map((col) => (
                    <th key={col} className="text-left p-3 text-sm font-medium text-text-primary bg-surface-secondary/30">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.slice(0, 10).map((row: any, index: number) => (
                  <tr key={index} className="border-b border-border-subtle/50">
                    {columns.map((col) => (
                      <td key={col} className="p-3 text-sm text-text-secondary max-w-xs truncate">
                        {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {tableData.length > 10 && (
              <div className="text-center py-2 text-sm text-text-secondary">
                ... and {tableData.length - 10} more rows
              </div>
            )}
          </div>
        );
      }
    }

    // Handle other structured data
    const repeatingSelector = selectors.find(sel => sel.type === 'repeating');
    
    if (repeatingSelector) {
      const containerName = repeatingSelector.name || 'container';
      const containerData = previewData.find(item => item[containerName]);
      
      if (containerData && containerData[containerName] && Array.isArray(containerData[containerName])) {
        const items = containerData[containerName];
        if (items.length > 0) {
          const columns = Object.keys(items[0]);

          return (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {columns.map((col) => (
                      <th key={col} className="text-left p-3 text-sm font-medium text-text-primary bg-surface-secondary/30">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 10).map((item: any, index: number) => (
                    <tr key={index} className="border-b border-border-subtle/50">
                      {columns.map((col) => (
                        <td key={col} className="p-3 text-sm text-text-secondary max-w-xs truncate">
                          {typeof item[col] === 'object' ? JSON.stringify(item[col]) : String(item[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length > 10 && (
                <div className="text-center py-2 text-sm text-text-secondary">
                  ... and {items.length - 10} more rows
                </div>
              )}
            </div>
          );
        }
      }
    }

    // Fallback: try to create a simple table from available data
    if (previewData.length > 0) {
      return (
        <div className="space-y-4">
          {selectors.map((selector, index) => (
            <div key={selector.id}>
              <h4 className="font-medium text-text-primary mb-2">{selector.label}</h4>
              <div className="bg-surface rounded p-3 border border-border-subtle">
                <pre className="text-sm text-text-secondary overflow-auto">
                  {JSON.stringify(previewData[index] || 'No data', null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="text-center py-8 text-text-secondary">
        <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No data to display</p>
      </div>
    );
  };

  const renderJsonPreview = () => {
    return (
      <div className="bg-surface rounded-lg p-4 border border-border-subtle overflow-auto max-h-96">
        <pre className="text-sm text-text-secondary">
          {JSON.stringify(previewData, null, 2)}
        </pre>
      </div>
    );
  };

  if (selectors.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <h3 className="text-lg font-medium text-text-primary mb-2">No Preview Available</h3>
        <p>Add selectors and extract data to see a preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Data Preview</h3>
          <p className="text-sm text-text-secondary">
            {previewData.length > 0 
              ? `Showing extracted data from ${selectors.length} selector(s)`
              : "No data extracted yet"
            }
          </p>
        </div>

        {previewData.length > 0 && (
          <div className="flex rounded-lg border border-border-subtle overflow-hidden">
            <button
              onClick={() => onPreviewFormatChange('table')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                previewFormat === 'table'
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => onPreviewFormatChange('json')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                previewFormat === 'json'
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              JSON
            </button>
          </div>
        )}
      </div>

      {/* Preview Content */}
      {previewData.length > 0 ? (
        <div className="border border-border-subtle rounded-lg overflow-hidden">
          {previewFormat === 'table' ? renderTablePreview() : renderJsonPreview()}
        </div>
      ) : (
        <div className="text-center py-12 text-text-secondary border border-border-subtle rounded-lg border-dashed">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h4 className="text-lg font-medium text-text-primary mb-2">No Data Extracted</h4>
          <p>Extract data from your selectors to see a preview here</p>
        </div>
      )}
    </div>
  );
};

export default DataPreviewPanel;