/**
 * Text Widget Configuration Component
 * 
 * Configuration interface for text widgets
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Type, Palette, Settings } from 'lucide-react';
import type { DashboardWidget, TextWidgetConfig as TextWidgetConfigType } from '@shared/types';

interface TextWidgetConfigProps {
  dashboardId: string;
  widget: DashboardWidget;
  onSave: (config: TextWidgetConfigType) => void;
  onClose: () => void;
}

const TextWidgetConfig: React.FC<TextWidgetConfigProps> = ({
  dashboardId,
  widget,
  onSave,
  onClose,
}) => {
  const [config, setConfig] = useState<TextWidgetConfigType>(
    widget.config as TextWidgetConfigType || {
      content: '',
      format: 'markdown',
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'left',
      templateVariables: {},
    }
  );

  const handleConfigChange = (updates: Partial<TextWidgetConfigType>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border-subtle max-w-2xl w-full max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Type className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Text Widget Configuration</h2>
              <p className="text-sm text-text-secondary">Configure how text content is displayed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-secondary/30 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            
            {/* Content Format */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Content Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'plain', label: 'Plain Text', desc: 'Raw text without formatting' },
                  { value: 'markdown', label: 'Markdown', desc: 'Markdown with syntax highlighting' },
                  { value: 'html', label: 'HTML', desc: 'Rich HTML content' },
                ].map(format => (
                  <label key={format.value} className="relative">
                    <input
                      type="radio"
                      name="format"
                      value={format.value}
                      checked={config.format === format.value}
                      onChange={(e) => handleConfigChange({ format: e.target.value as any })}
                      className="sr-only"
                    />
                    <div className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${config.format === format.value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border-subtle hover:border-border-subtle-hover bg-surface'
                      }
                    `}>
                      <div className="font-medium text-text-primary mb-1">{format.label}</div>
                      <div className="text-xs text-text-secondary">{format.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview Content */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Preview Content
                <span className="text-text-muted ml-1">(Static content for preview - actual content comes from connected nodes)</span>
              </label>
              <textarea
                value={config.content}
                onChange={(e) => handleConfigChange({ content: e.target.value })}
                placeholder={
                  config.format === 'markdown' 
                    ? '# Sample Heading\n\nThis is **bold** text and *italic* text.\n\n```javascript\nconsole.log("Hello World");\n```'
                    : config.format === 'html'
                    ? '<h2>Sample Heading</h2>\n<p>This is <strong>bold</strong> text.</p>'
                    : 'Plain text content will appear here...'
                }
                rows={8}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none resize-vertical"
              />
            </div>

            {/* Styling Options */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Font Size
                </label>
                <input
                  type="number"
                  value={config.fontSize || 14}
                  onChange={(e) => handleConfigChange({ fontSize: parseInt(e.target.value) || 14 })}
                  min="8"
                  max="72"
                  className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                />
              </div>

              {/* Font Weight */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Font Weight
                </label>
                <select
                  value={config.fontWeight || 'normal'}
                  onChange={(e) => handleConfigChange({ fontWeight: e.target.value as any })}
                  className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>

              {/* Text Alignment */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Text Alignment
                </label>
                <select
                  value={config.textAlign || 'left'}
                  onChange={(e) => handleConfigChange({ textAlign: e.target.value as any })}
                  className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {/* Text Color */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Text Color
                </label>
                <input
                  type="color"
                  value={config.color || '#ffffff'}
                  onChange={(e) => handleConfigChange({ color: e.target.value })}
                  className="w-full h-12 bg-surface rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Template Variables */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Template Variables
                <span className="text-text-muted ml-1">(Use {`{{variableName}}`} in content)</span>
              </label>
              <div className="space-y-2">
                {Object.entries(config.templateVariables || {}).map(([key, value], index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Variable name"
                      value={key}
                      onChange={(e) => {
                        const newVars = { ...config.templateVariables };
                        delete newVars[key];
                        newVars[e.target.value] = value;
                        handleConfigChange({ templateVariables: newVars });
                      }}
                      className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Variable value"
                      value={value}
                      onChange={(e) => {
                        const newVars = { ...config.templateVariables };
                        newVars[key] = e.target.value;
                        handleConfigChange({ templateVariables: newVars });
                      }}
                      className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const newVars = { ...config.templateVariables };
                        delete newVars[key];
                        handleConfigChange({ templateVariables: newVars });
                      }}
                      className="px-3 py-2 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newVars = { ...config.templateVariables, '': '' };
                    handleConfigChange({ templateVariables: newVars });
                  }}
                  className="px-3 py-2 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors text-sm"
                >
                  Add Variable
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TextWidgetConfig;