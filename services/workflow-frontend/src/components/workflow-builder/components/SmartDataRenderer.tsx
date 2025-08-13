import React from 'react';

interface SmartDataRendererProps {
  data: any[];
}

interface DataStructure {
  type: 'table' | 'list' | 'cards' | 'raw';
  headers?: string[];
  isUniform: boolean;
}

const SmartDataRenderer: React.FC<SmartDataRendererProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8 text-text-muted">
        No data extracted yet
      </div>
    );
  }

  const analyzeDataStructure = (data: any[]): DataStructure => {
    if (data.length === 0) return { type: 'raw', isUniform: false };

    // Check if all items have the same keys (uniform structure)
    const firstKeys = Object.keys(data[0] || {}).sort();
    const isUniform = data.every(item => {
      const itemKeys = Object.keys(item || {}).sort();
      return itemKeys.length === firstKeys.length && 
             itemKeys.every((key, idx) => key === firstKeys[idx]);
    });

    // Determine if it looks like tabular data
    const hasMultipleColumns = firstKeys.length > 1;
    const hasStructuredData = firstKeys.some(key => 
      data.some(item => typeof item[key] === 'object' && item[key]?.text)
    );

    if (isUniform && hasMultipleColumns) {
      return { type: 'table', headers: firstKeys, isUniform: true };
    }

    // Check if it looks like a list (single meaningful field)
    if (firstKeys.length === 1 || firstKeys.some(key => key === 'text' || key === 'title')) {
      return { type: 'list', isUniform };
    }

    // If items have complex structure but aren't uniform, show as cards
    if (hasStructuredData) {
      return { type: 'cards', isUniform };
    }

    return { type: 'raw', isUniform };
  };

  const renderValue = (value: any, key?: string) => {
    if (value === null || value === undefined) return '—';
    
    if (typeof value === 'object') {
      // Handle extracted element data
      if (value.text || value.href || value.src) {
        const parts = [];
        
        if (value.text) {
          parts.push(
            <span key="text" className="text-text-primary">
              {value.text}
            </span>
          );
        }
        
        if (value.href) {
          parts.push(
            <a 
              key="href" 
              href={value.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs ml-2"
            >
              🔗 Link
            </a>
          );
        }
        
        if (value.src) {
          parts.push(
            <span key="src" className="text-text-muted text-xs ml-2">
              📷 {value.alt || 'Image'}
            </span>
          );
        }

        return <div className="flex items-center flex-wrap gap-1">{parts}</div>;
      }
      
      return <pre className="text-xs text-text-muted">{JSON.stringify(value, null, 2)}</pre>;
    }
    
    // Handle URLs
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 break-all"
        >
          {value.length > 50 ? value.substring(0, 50) + '...' : value}
        </a>
      );
    }
    
    return String(value);
  };

  const structure = analyzeDataStructure(data);

  if (structure.type === 'table' && structure.headers) {
    return (
      <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-secondary border-b border-border-subtle">
              <tr>
                {structure.headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.slice(0, 20).map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-secondary/50">
                  {structure.headers!.map((header) => (
                    <td
                      key={header}
                      className="px-4 py-3 text-sm align-top"
                    >
                      {renderValue(row[header], header)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 20 && (
          <div className="px-4 py-3 bg-surface-secondary border-t border-border-subtle text-center text-sm text-text-muted">
            Showing 20 of {data.length} items
          </div>
        )}
      </div>
    );
  }

  if (structure.type === 'list') {
    return (
      <div className="space-y-2">
        {data.slice(0, 50).map((item, idx) => (
          <div 
            key={idx} 
            className="bg-surface rounded-lg border border-border-subtle p-4 hover:bg-surface-secondary/50 transition-colors"
          >
            {Object.entries(item).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                {key !== 'text' && (
                  <span className="text-xs text-text-muted uppercase font-medium">
                    {key}:
                  </span>
                )}
                <div className={key === 'text' ? 'text-text-primary' : 'text-text-secondary text-sm'}>
                  {renderValue(value, key)}
                </div>
              </div>
            ))}
          </div>
        ))}
        {data.length > 50 && (
          <div className="text-center text-sm text-text-muted py-4">
            Showing 50 of {data.length} items
          </div>
        )}
      </div>
    );
  }

  if (structure.type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.slice(0, 12).map((item, idx) => (
          <div 
            key={idx} 
            className="bg-surface rounded-lg border border-border-subtle p-4 hover:bg-surface-secondary/50 transition-colors"
          >
            {Object.entries(item).map(([key, value]) => (
              <div key={key} className="mb-2 last:mb-0">
                <div className="text-xs text-text-muted uppercase font-medium mb-1">
                  {key}:
                </div>
                <div className="text-text-primary text-sm">
                  {renderValue(value, key)}
                </div>
              </div>
            ))}
          </div>
        ))}
        {data.length > 12 && (
          <div className="col-span-full text-center text-sm text-text-muted py-4">
            Showing 12 of {data.length} items
          </div>
        )}
      </div>
    );
  }

  // Raw/fallback rendering
  return (
    <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-secondary border-b border-border-subtle">
            <tr>
              {Object.keys(data[0] || {}).map((key) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.slice(0, 10).map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-secondary/50">
                {Object.values(row).map((value: any, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-4 py-3 text-sm text-text-primary align-top"
                  >
                    {renderValue(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-4 py-3 bg-surface-secondary border-t border-border-subtle text-center text-sm text-text-muted">
          Showing 10 of {data.length} items
        </div>
      )}
    </div>
  );
};

export default SmartDataRenderer;