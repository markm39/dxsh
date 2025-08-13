import React, { useState, useEffect } from "react";
import {
  Brain,
  CheckCircle,
  Loader,
  X,
  Eye,
  MessageSquare,
  Monitor,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import SmartDataRenderer from "../workflow-builder/components/SmartDataRenderer";
import DashboardConnector from "../dashboard-connect/DashboardConnector";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface AIProcessorSetupProps {
  onClose: () => void;
  onProcessorCreated: (processor: any) => void;
  agentId?: number;
  nodeId?: string;
  existingProcessor?: any;
  inputData?: any[];
}

const AIProcessorSetup: React.FC<AIProcessorSetupProps> = ({
  onClose,
  onProcessorCreated,
  agentId,
  nodeId,
  existingProcessor,
  inputData = [],
}) => {
  const { authHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processorName, setProcessorName] = useState("AI Processor");
  const [customPrompt, setCustomPrompt] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);

  // Load existing processor data
  useEffect(() => {
    if (existingProcessor) {
      setProcessorName(existingProcessor.name || "AI Processor");
      setCustomPrompt(existingProcessor.prompt || "");
      setPreview(existingProcessor.lastOutput || null);
    }
  }, [existingProcessor]);

  const handlePreview = async () => {
    if (!customPrompt.trim() || inputData.length === 0) {
      alert("Please enter a prompt and ensure there's input data available");
      return;
    }

    setLoading(true);
    try {
      const sampleData = inputData.slice(0, 5); // Use first 5 items for preview
      
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/process`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: customPrompt,
          data: sampleData,
          preview: true
        })
      });

      const result = await response.json();
      if (result.success) {
        setPreview(result.output);
        setShowPreview(true);
      } else {
        throw new Error(result.error || 'Preview failed');
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to generate preview. Please check your prompt and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!processorName.trim() || !customPrompt.trim()) {
      alert('Please fill in the processor name and prompt');
      return;
    }

    const processorData = {
      name: processorName,
      prompt: customPrompt,
      type: 'aiProcessor',
      lastOutput: preview,
      agentId
    };

    onProcessorCreated(processorData);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-primary">
                  AI Processor Setup
                </h2>
                <p className="text-text-secondary">
                  Configure AI processing for your data
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
          {/* Configuration */}
          <div className="space-y-4">
            {/* Processor Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Processor Name
              </label>
              <input
                type="text"
                value={processorName}
                onChange={(e) => setProcessorName(e.target.value)}
                placeholder="Enter processor name"
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
              />
            </div>

            {/* Custom Prompt */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                AI Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you want the AI to do with the input data...&#10;&#10;Example: Analyze this data and extract the key insights. Summarize the main trends and provide actionable recommendations."
                rows={6}
                className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Preview Section */}
            {inputData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-text-primary">Test with Sample Data</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePreview}
                      disabled={loading || !customPrompt.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm transition-colors flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Test Preview
                        </>
                      )}
                    </button>
                    {preview && (
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-4 py-2 bg-surface border border-border-subtle hover:bg-surface-secondary rounded-lg text-text-secondary text-sm transition-colors flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        {showPreview ? 'Hide' : 'Show'} Output
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Sample Input Data */}
                <div className="bg-surface rounded-lg border border-border-subtle p-4">
                  <h5 className="text-sm font-medium text-text-primary mb-2">Sample Input Data:</h5>
                  <div className="max-h-40 overflow-y-auto">
                    <SmartDataRenderer data={inputData.slice(0, 3)} />
                  </div>
                </div>

                {/* Preview Results */}
                {showPreview && preview && (
                  <div className="bg-surface rounded-lg border border-border-subtle p-4">
                    <h5 className="text-sm font-medium text-text-primary mb-2">AI Output Preview:</h5>
                    <div className="bg-background rounded border border-border-subtle p-3 max-h-64 overflow-y-auto">
                      <pre className="text-sm text-text-primary whitespace-pre-wrap">
                        {typeof preview === 'object' ? JSON.stringify(preview, null, 2) : preview}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {inputData.length === 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  💡 <strong>Preview Note:</strong> Input data is available during workflow execution. Connect this node to a data source and use the Execute button in the workflow to see live results in the Dashboard tab.
                </p>
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
              disabled={loading || !processorName.trim() || !customPrompt.trim()}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-white"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Processor
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Connector Modal */}
      {showDashboardConnector && agentId && nodeId && (
        <DashboardConnector
          agentId={agentId}
          nodeId={nodeId}
          nodeType="aiProcessor"
          nodeLabel={processorName || "AI Processor"}
          nodeOutputType="textData" // AI processors typically output text data
          onClose={() => setShowDashboardConnector(false)}
          onConnect={(widgetId) => {
            console.log(`Connected AI processor ${nodeId} to widget ${widgetId}`);
            setShowDashboardConnector(false);
          }}
        />
      )}
    </div>
  );
};

export default AIProcessorSetup;