import React, { useState, useCallback } from 'react';
import { ArrowRight, Database, FileText, Trash2, Plus } from 'lucide-react';
import { ColumnMapping, SchemaField } from '../workflow-types';

interface ColumnMappingInterfaceProps {
  inputFields: SchemaField[];
  targetColumns: Array<{ name: string; type: string; description?: string }>;
  mappings: ColumnMapping[];
  onMappingChange: (mappings: ColumnMapping[]) => void;
  disabled?: boolean;
}

interface DraggedField {
  type: 'input' | 'target';
  field: SchemaField | { name: string; type: string; description?: string };
  index: number;
}

const ColumnMappingInterface: React.FC<ColumnMappingInterfaceProps> = ({
  inputFields,
  targetColumns,
  mappings,
  onMappingChange,
  disabled = false
}) => {
  const [draggedField, setDraggedField] = useState<DraggedField | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const handleDragStart = useCallback((
    e: React.DragEvent,
    type: 'input' | 'target',
    field: SchemaField | { name: string; type: string; description?: string },
    index: number
  ) => {
    const dragData: DraggedField = { type, field, index };
    setDraggedField(dragData);
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetFieldName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetFieldName);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetFieldName: string) => {
    e.preventDefault();
    setDragOverTarget(null);

    if (!draggedField || draggedField.type !== 'input') return;

    const sourceField = draggedField.field as SchemaField;
    const targetColumn = targetColumns.find(col => col.name === targetFieldName);
    
    if (!targetColumn) return;

    // Check if mapping already exists for this source field
    const existingMappingIndex = mappings.findIndex(m => m.sourceField === sourceField.name);
    
    let newMappings = [...mappings];
    
    if (existingMappingIndex >= 0) {
      // Update existing mapping
      newMappings[existingMappingIndex] = {
        ...newMappings[existingMappingIndex],
        targetColumn: targetColumn.name,
        dataType: targetColumn.type
      };
    } else {
      // Create new mapping
      newMappings.push({
        sourceField: sourceField.name,
        targetColumn: targetColumn.name,
        dataType: targetColumn.type,
        transform: inferTransform(sourceField.type, targetColumn.type)
      });
    }

    onMappingChange(newMappings);
    setDraggedField(null);
  }, [draggedField, mappings, onMappingChange, targetColumns]);

  const handleDragEnd = useCallback(() => {
    setDraggedField(null);
    setDragOverTarget(null);
  }, []);

  const removeMapping = useCallback((sourceFieldName: string) => {
    const newMappings = mappings.filter(m => m.sourceField !== sourceFieldName);
    onMappingChange(newMappings);
  }, [mappings, onMappingChange]);

  const inferTransform = (sourceType: string, targetType: string): ColumnMapping['transform'] => {
    if (targetType.toLowerCase().includes('json')) return 'json';
    if (targetType.toLowerCase().includes('timestamp') || targetType.toLowerCase().includes('date')) return 'date';
    if (targetType.toLowerCase().includes('int') || targetType.toLowerCase().includes('numeric')) return 'number';
    if (targetType.toLowerCase().includes('bool')) return 'boolean';
    return 'string';
  };

  const getMappingForField = (fieldName: string) => {
    return mappings.find(m => m.sourceField === fieldName);
  };

  const getMappingForTarget = (targetName: string) => {
    return mappings.find(m => m.targetColumn === targetName);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-text-primary mb-3">
        Column Mapping - Drag input fields to target columns
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Fields */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <FileText className="w-4 h-4 text-blue-400" />
            Input Fields ({inputFields.length})
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto bg-surface-secondary rounded-lg border border-border-subtle p-3">
            {inputFields.map((field, index) => {
              const mapping = getMappingForField(field.name);
              const isMapped = !!mapping;
              
              return (
                <div
                  key={field.name}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, 'input', field, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-3 rounded-lg border cursor-move transition-all ${
                    isMapped 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary text-sm truncate">
                        {field.name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {field.type} {field.optional && '(optional)'}
                      </div>
                      {field.description && (
                        <div className="text-xs text-text-muted mt-1 truncate">
                          {field.description}
                        </div>
                      )}
                    </div>
                    
                    {isMapped && (
                      <div className="flex items-center gap-2 ml-2">
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">
                          {mapping?.targetColumn}
                        </span>
                        <button
                          onClick={() => removeMapping(field.name)}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300"
                          disabled={disabled}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {inputFields.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No input fields available</p>
                <p className="text-xs">Connect a data source to see input fields</p>
              </div>
            )}
          </div>
        </div>

        {/* Target Columns */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Database className="w-4 h-4 text-purple-400" />
            Target Columns ({targetColumns.length})
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto bg-surface-secondary rounded-lg border border-border-subtle p-3">
            {targetColumns.map((column, index) => {
              const mapping = getMappingForTarget(column.name);
              const isMapped = !!mapping;
              const isDragOver = dragOverTarget === column.name;
              
              return (
                <div
                  key={column.name}
                  onDragOver={(e) => handleDragOver(e, column.name)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.name)}
                  className={`p-3 rounded-lg border transition-all ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-500/20'
                      : isMapped
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-border-subtle bg-surface hover:bg-surface-secondary'
                  } ${disabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary text-sm truncate">
                        {column.name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {column.type}
                      </div>
                      {column.description && (
                        <div className="text-xs text-text-muted mt-1 truncate">
                          {column.description}
                        </div>
                      )}
                    </div>
                    
                    {isMapped && (
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-purple-400 font-medium">
                          ← {mapping?.sourceField}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {isDragOver && (
                    <div className="mt-2 text-xs text-blue-400 text-center">
                      Drop to create mapping
                    </div>
                  )}
                </div>
              );
            })}
            
            {targetColumns.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No target columns available</p>
                <p className="text-xs">Select a table to see its columns</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mapping Summary */}
      {mappings.length > 0 && (
        <div className="mt-6 p-4 bg-surface-secondary rounded-lg border border-border-subtle">
          <div className="text-sm font-medium text-text-primary mb-3">
            Active Mappings ({mappings.length})
          </div>
          <div className="space-y-2">
            {mappings.map((mapping, index) => (
              <div key={`${mapping.sourceField}-${mapping.targetColumn}`} 
                   className="flex items-center justify-between p-2 bg-surface rounded border border-border-subtle">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-blue-400 font-medium">{mapping.sourceField}</span>
                  <ArrowRight className="w-4 h-4 text-text-muted" />
                  <span className="text-purple-400 font-medium">{mapping.targetColumn}</span>
                  <span className="text-xs text-text-muted">({mapping.dataType})</span>
                </div>
                <button
                  onClick={() => removeMapping(mapping.sourceField)}
                  className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300"
                  disabled={disabled}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnMappingInterface;