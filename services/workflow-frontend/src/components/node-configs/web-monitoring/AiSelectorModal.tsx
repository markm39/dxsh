import React from "react";
import {
  Sparkles,
  MessageSquare,
  ArrowRight,
  Loader,
  X,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface AiSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectors: any[]) => void;
  url: string;
  authHeaders: any;
}

interface AiModalState {
  step: 'data-type' | 'description' | 'generating' | 'preview' | 'feedback' | 'confirm';
  dataType: 'raw' | 'tables' | 'repeating';
  description: string;
  selectors: any;
  feedback: string;
  previousSelectors: any;
  previewData: any[];
  loading: boolean;
  error: string;
}

const AiSelectorModal: React.FC<AiSelectorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  url,
  authHeaders,
}) => {
  const [state, setState] = React.useState<AiModalState>({
    step: 'data-type',
    dataType: 'raw',
    description: '',
    selectors: null,
    feedback: '',
    previousSelectors: null,
    previewData: [],
    loading: false,
    error: '',
  });

  const updateState = (updates: Partial<AiModalState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleGenerate = async () => {
    if (!url || !state.description.trim()) return;

    updateState({ loading: true, error: '', step: 'generating' });

    try {
      // Call AI selector generation API
      const response = await fetch(`${API_BASE_URL}/api/v1/scrape/ai-selectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          url: url,
          description: state.description,
          data_type: state.dataType,
          feedback: state.feedback || undefined,
          previous_selectors: state.previousSelectors || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate selectors');
      }

      const data = await response.json();
      
      // The AI response contains an object with selectors array
      let selectors = null;
      if (data.ai_selectors) {
        // For raw and tables data types, selectors are in data.ai_selectors.selectors
        if (state.dataType === 'raw' || state.dataType === 'tables') {
          selectors = data.ai_selectors.selectors;
        } else if (state.dataType === 'repeating') {
          // For repeating type, we need to format it differently
          selectors = [{
            container_selector: data.ai_selectors.container_selector,
            fields: data.ai_selectors.fields
          }];
        }
      }
      
      // Ensure we have valid selectors array
      if (selectors && Array.isArray(selectors)) {
        updateState({ selectors: selectors });
      } else {
        throw new Error('Invalid response format: expected selectors array');
      }

      // Test the selectors to get preview data
      const testResponse = await fetch(`${API_BASE_URL}/api/v1/scrape/test-ai-selectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          url: url,
          data_type: state.dataType,
          attribute: state.dataType === 'tables' ? 'table_data' : 'textContent',
          selectors: selectors,  // Use the extracted selectors array
        }),
      });

      if (testResponse.ok) {
        const testData = await testResponse.json();
        updateState({ previewData: testData.data || [] });
      }

      updateState({ step: 'preview' });
    } catch (error) {
      console.error('Error generating AI selectors:', error);
      updateState({ error: (error as Error).message, step: 'feedback' });
    } finally {
      updateState({ loading: false });
    }
  };

  const handleConfirmSelectors = () => {
    if (!state.selectors || !Array.isArray(state.selectors)) return;

    // Convert AI selectors to the format expected by the parent component
    let convertedSelectors;
    if (state.dataType === 'tables') {
      // Handle table type
      convertedSelectors = state.selectors.map((sel: any, index: number) => ({
        id: `ai_${Date.now()}_${index}`,
        selector: sel.selector,
        label: sel.name || sel.label || `AI Table ${index + 1}`,
        attribute: 'table_data',
        name: sel.name || 'table',
        type: 'tables'
      }));
    } else if (state.dataType === 'repeating') {
      convertedSelectors = state.selectors.map((sel: any, index: number) => ({
        id: `ai_${Date.now()}_${index}`,
        selector: sel.container_selector,
        label: sel.name || `AI Container ${index + 1}`,
        attribute: 'container',
        name: sel.name || 'container',
        type: 'repeating',
        fields: sel.fields || []
      }));
    } else {
      convertedSelectors = state.selectors.map((sel: any, index: number) => ({
        id: `ai_${Date.now()}_${index}`,
        selector: sel.selector,
        label: sel.name || sel.label || `AI Selector ${index + 1}`,
        attribute: 'textContent',
        name: sel.name,
        type: 'raw'
      }));
    }

    onConfirm(convertedSelectors);

    // Reset modal state
    updateState({
      step: 'data-type',
      description: '',
      selectors: null,
      previewData: [],
      error: '',
    });
  };

  const handleRetry = () => {
    updateState({
      previousSelectors: state.selectors,
      step: 'feedback'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  AI Selector Generator
                </h3>
                <p className="text-text-secondary text-sm">
                  Let AI find the perfect selectors for your data
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Data Type Selection */}
          {state.step === 'data-type' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-text-primary mb-3">
                  What type of data do you want to extract?
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: 'raw', label: 'Text & Links', desc: 'Simple text content, links, images' },
                    { key: 'tables', label: 'Tables', desc: 'Structured table data with rows and columns' },
                    { key: 'repeating', label: 'Lists', desc: 'Repeating items like products, articles, etc.' }
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        updateState({ dataType: option.key as any });
                        updateState({ step: 'description' });
                      }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        state.dataType === option.key
                          ? 'border-primary bg-primary/5'
                          : 'border-border-subtle hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-text-primary">{option.label}</div>
                      <div className="text-sm text-text-secondary mt-1">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {state.step === 'description' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Describe the data you want to extract
                </label>
                <textarea
                  value={state.description}
                  onChange={(e) => updateState({ description: e.target.value })}
                  className="w-full h-32 bg-surface text-text-primary p-3 rounded border border-border-subtle focus:border-primary focus:outline-none resize-none"
                  placeholder={
                    state.dataType === 'tables' 
                      ? "e.g., 'Product pricing table with columns for name, price, and features'"
                      : state.dataType === 'repeating'
                      ? "e.g., 'List of news articles with title, author, and publication date'"
                      : "e.g., 'Product title and price from this e-commerce page'"
                  }
                />
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => updateState({ step: 'data-type' })}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!state.description.trim() || state.loading}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {state.loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Generate Selectors
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {state.step === 'generating' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
              <h4 className="text-lg font-semibold text-text-primary mb-2">
                Analyzing page structure...
              </h4>
              <p className="text-text-secondary">
                AI is examining the page to find the best selectors for your data
              </p>
            </div>
          )}

          {/* Step 4: Preview */}
          {state.step === 'preview' && state.selectors && Array.isArray(state.selectors) && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-text-primary mb-3">
                  Generated Selectors Preview
                </h4>
                <div className="bg-surface rounded-lg p-4 border border-border-subtle">
                  <div className="text-sm text-text-secondary mb-2">
                    Found {state.selectors.length} selector(s)
                  </div>
                  {state.selectors.map((sel: any, index: number) => (
                    <div key={index} className="mb-2 p-2 bg-background rounded border">
                      <div className="font-mono text-xs text-text-primary">
                        {sel.selector || sel.container_selector}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {sel.name || sel.label || `Selector ${index + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {state.previewData.length > 0 && (
                <div>
                  <h5 className="font-medium text-text-primary mb-2">Sample Data:</h5>
                  <div className="bg-surface rounded p-3 border border-border-subtle max-h-40 overflow-y-auto">
                    <pre className="text-xs text-text-secondary">
                      {JSON.stringify(state.previewData.slice(0, 3), null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {state.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                  Error: {state.error}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Provide Feedback
                </button>
                <button
                  onClick={handleConfirmSelectors}
                  disabled={state.loading}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  Use These Selectors
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Feedback */}
          {state.step === 'feedback' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-text-primary mb-3">
                  Provide Feedback
                </h4>
                <textarea
                  value={state.feedback}
                  onChange={(e) => updateState({ feedback: e.target.value })}
                  className="w-full h-32 bg-surface text-text-primary p-3 rounded border border-border-subtle focus:border-primary focus:outline-none resize-none"
                  placeholder="Tell AI what was wrong or what you'd like to improve..."
                />
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => updateState({ step: 'preview' })}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!state.feedback.trim() || state.loading}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {state.loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiSelectorModal;