import React from "react";
import { Trash2, Eye, Sparkles } from "lucide-react";

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

interface SelectorsListProps {
  selectors: SelectorConfig[];
  onRemoveSelector: (id: string) => void;
  onShowAiModal: () => void;
  onShowVisualSelector: () => void;
  isUrlValid: boolean;
}

const SelectorsList: React.FC<SelectorsListProps> = ({
  selectors,
  onRemoveSelector,
  onShowAiModal,
  onShowVisualSelector,
  isUrlValid,
}) => {
  if (selectors.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 text-text-secondary border border-border-subtle rounded-lg border-dashed">
          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-medium text-text-primary mb-2">No Selectors Added</h3>
          <p className="mb-6">Choose how you'd like to select elements from the webpage</p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onShowAiModal}
              disabled={!isUrlValid}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AI Selector
            </button>
            
            <button
              onClick={onShowVisualSelector}
              disabled={!isUrlValid}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Eye className="w-4 h-4" />
              Visual Selector
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">CSS Selectors</h3>
          <p className="text-sm text-text-secondary">
            {selectors.length} selector{selectors.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onShowAiModal}
            disabled={!isUrlValid}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI Selector
          </button>
          
          <button
            onClick={onShowVisualSelector}
            disabled={!isUrlValid}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Eye className="w-4 h-4" />
            Visual Selector
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {selectors.map((selector, index) => (
          <div
            key={selector.id}
            className="p-4 bg-surface rounded-lg border border-border-subtle hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-text-primary">
                    {selector.label}
                  </span>
                  {selector.type && (
                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                      {selector.type}
                    </span>
                  )}
                  {selector.elementCount !== undefined && (
                    <span className="text-xs text-text-secondary">
                      ({selector.elementCount} element{selector.elementCount !== 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                
                <div className="font-mono text-xs text-text-secondary bg-background p-2 rounded border truncate">
                  {selector.selector}
                </div>
                
                {selector.fields && selector.fields.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs font-medium text-text-primary">Fields:</div>
                    {selector.fields.map((field, fieldIndex) => (
                      <div key={fieldIndex} className="text-xs text-text-secondary">
                        <span className="font-medium">{field.name}:</span> {field.sub_selector}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-2 text-xs text-text-secondary">
                  Attribute: <span className="font-mono">{selector.attribute}</span>
                  {selector.name && (
                    <span> • Name: <span className="font-mono">{selector.name}</span></span>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => onRemoveSelector(selector.id)}
                className="ml-3 p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                title="Remove selector"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectorsList;