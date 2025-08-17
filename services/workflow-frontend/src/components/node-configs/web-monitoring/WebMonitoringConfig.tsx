import React, { useState, useEffect } from "react";
import { Globe, X, CheckCircle, Loader } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import VisualElementSelector from "../../visual-selector/VisualElementSelector";
import DashboardConnector from "../../dashboard-connect/DashboardConnector";
import AiSelectorModal from "./AiSelectorModal";
import LoopConfigPanel from "./LoopConfigPanel";
import DataPreviewPanel from "./DataPreviewPanel";
import SelectorsList from "./SelectorsList";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface WebMonitoringConfigProps {
  onClose: () => void;
  onMonitoringCreated: (monitoring: any) => void;
  agentId?: number;
  nodeId?: string;
  existingMonitoring?: any;
}

interface SelectorConfig {
  id: string;
  selector: string;
  label: string;
  attribute: string;
  elementCount?: number;
  name?: string;
  type: "raw" | "repeating" | "tables"; // Required field with explicit 3 types
  fields?: Array<{
    name: string;
    sub_selector: string;
    attribute: string;
  }>;
}

type LoopParameterType = "range" | "list" | "input_variable";

interface LoopParameter {
  id: string;
  name: string;
  type: LoopParameterType;
  start?: number;
  end?: number;
  step?: number;
  values?: string[];
  inputVariable?: string;
  inputPath?: string;
}

interface LoopConfiguration {
  enabled: boolean;
  parameters: LoopParameter[];
  concurrency: number;
  delayBetweenRequests: number;
  aggregationMode: "append" | "merge";
  stopOnError: boolean;
}

const WebMonitoringConfig: React.FC<WebMonitoringConfigProps> = ({
  onClose,
  onMonitoringCreated,
  agentId,
  nodeId,
  existingMonitoring,
}) => {
  const { authHeaders } = useAuth();

  // Basic state
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectors, setSelectors] = useState<SelectorConfig[]>([]);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<"selectors" | "loop" | "preview">(
    "selectors"
  );
  const [showVisualSelector, setShowVisualSelector] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"json" | "table">("json");

  // Loop configuration
  const [loopConfig, setLoopConfig] = useState<LoopConfiguration>({
    enabled: false,
    parameters: [],
    concurrency: 1,
    delayBetweenRequests: 1000,
    aggregationMode: "append",
    stopOnError: false,
  });

  // Load existing monitoring data
  useEffect(() => {
    if (existingMonitoring) {
      if (existingMonitoring.url) {
        setUrl(existingMonitoring.url);
      }
      if (existingMonitoring.selectors) {
        // Simple: Use selectors as-is, defaulting type to 'raw' if missing
        const cleanSelectors = existingMonitoring.selectors.map((sel: any) => ({
          ...sel,
          type: sel.type || "raw", // Default to 'raw' if no type specified
        }));
        setSelectors(cleanSelectors);
      }
      if (existingMonitoring.loopConfig) {
        setLoopConfig(existingMonitoring.loopConfig);
      }
      if (existingMonitoring.extractedData) {
        setExtractedData(existingMonitoring.extractedData);
        setFilteredData(existingMonitoring.extractedData);
      }
    }
  }, [existingMonitoring]);

  // Update filtered data when extracted data changes
  useEffect(() => {
    setFilteredData(extractedData);
  }, [extractedData]);

  // Helper functions
  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith("http://") || url.startsWith("https://");
    } catch {
      return false;
    }
  };

  const extractData = async (selectorsToUse: SelectorConfig[] = selectors) => {
    if (!validateUrl(url) || selectorsToUse.length === 0) return;

    setLoading(true);
    try {
      // Check if we have any repeating mode selector
      const repeatingSelector = selectorsToUse.find(
        (sel) => sel.type === "repeating"
      );

      let selectorsPayload;
      if (repeatingSelector && repeatingSelector.fields) {
        // Send as structured repeating container format
        selectorsPayload = [
          {
            selector: repeatingSelector.selector,
            name: repeatingSelector.name || "container",
            type: "repeating",
            fields: repeatingSelector.fields.map((field: any) => ({
              name: field.name,
              sub_selector: field.sub_selector,
              attribute: field.attribute,
            })),
          },
        ];
      } else {
        // Send as array of individual selectors
        selectorsPayload = selectorsToUse.map((sel: any) => ({
          selector: sel.selector,
          label: sel.label,
          name: sel.name,
          attribute:
            sel.type === "tables"
              ? "table_data"
              : sel.attribute === "all"
              ? "all"
              : sel.attribute === "table_data"
              ? "table_data"
              : "textContent",
          type: sel.type || "all",
        }));
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/scrape/test-ai-selectors`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            url: url,
            selectors: selectorsPayload,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setExtractedData(data.data || []);
      } else {
        console.error("Failed to extract data:", data.error);
        alert("Failed to extract data: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error extracting data:", error);
      alert("Failed to extract data");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!validateUrl(url)) {
      alert("Please enter a valid URL starting with http:// or https://");
      return;
    }

    if (selectors.length > 0) {
      await extractData();
    }
  };

  const handleFinish = () => {
    if (selectors.length === 0) return;

    // Prepare selectors payload for configuration
    const repeatingSelector = selectors.find(
      (sel) => sel.type === "repeating"
    );

    let selectorsPayload;
    if (repeatingSelector && repeatingSelector.fields) {
      // Send as structured repeating container format
      selectorsPayload = [
        {
          selector: repeatingSelector.selector,
          name: repeatingSelector.name || "container",
          type: "repeating",
          fields: repeatingSelector.fields.map((field: any) => ({
            name: field.name,
            sub_selector: field.sub_selector,
            attribute: field.attribute,
          })),
        },
      ];
    } else {
      // Send as array of individual selectors with proper formatting
      selectorsPayload = selectors.map((sel: any) => ({
        selector: sel.selector,
        label: sel.label,
        name: sel.name,
        attribute:
          sel.type === "tables"
            ? "table_data"
            : sel.attribute === "all"
            ? "all"
            : sel.attribute === "table_data"
            ? "table_data"
            : "textContent",
        type: sel.type || "raw",
      }));
    }

    // Save configuration and close modal
    onMonitoringCreated({
      url: url,
      selectors: selectorsPayload,
      originalSelectors: selectors,
      loopConfig: loopConfig,
      extractedData: extractedData,
      configured: true,
    });
  };

  const handleAiSelectorConfirm = (newSelectors: SelectorConfig[]) => {
    setSelectors((prev) => [...prev, ...newSelectors]);
    setShowAiModal(false);

    // Auto-extract data if URL is valid
    if (validateUrl(url)) {
      extractData([...selectors, ...newSelectors]);
    }
  };

  const handleVisualSelectorChange = (selectedElements: any[]) => {
    console.log("DEBUG: Visual selector returned elements:", selectedElements);

    // Check if we have a table mode structure
    if (
      selectedElements.length === 1 &&
      selectedElements[0].type === "tables"
    ) {
      const tableElement = selectedElements[0];
      const newSelector: SelectorConfig = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        selector: tableElement.selector,
        label: tableElement.name || "Table Data",
        attribute: "table_data",
        elementCount: tableElement.elementCount,
        name: tableElement.name || "table",
        type: "tables",
      };

      setSelectors([newSelector]);
    } else if (selectedElements.length === 1 && selectedElements[0].fields) {
      // Handle repeating containers
      const repeatingElement = selectedElements[0];
      const newSelector: SelectorConfig = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        selector: repeatingElement.selector,
        label: repeatingElement.name || "Repeating Container",
        attribute: "container",
        elementCount: repeatingElement.elementCount,
        name: repeatingElement.name || "container",
        type: "repeating",
        fields: repeatingElement.fields.map((field: any) => ({
          name: field.name,
          sub_selector: field.sub_selector,
          attribute: field.attribute,
        })),
      };

      setSelectors([newSelector]);
    } else {
      // Handle regular selectors
      const newSelectors: SelectorConfig[] = selectedElements.map(
        (element, index) => ({
          id:
            Date.now().toString() +
            Math.random().toString(36).substr(2, 9) +
            index,
          selector: element.selector,
          label: element.name || element.label || `Element ${index + 1}`,
          attribute: element.attribute || "textContent",
          elementCount: element.elementCount,
          name: element.name,
          type: (element.type as "raw" | "repeating" | "tables") || "raw",
        })
      );

      setSelectors(newSelectors);
    }

    setShowVisualSelector(false);

    // Auto-extract data if URL is valid
    if (validateUrl(url)) {
      extractData();
    }
  };

  const removeSelector = (id: string) => {
    const newSelectors = selectors.filter((s) => s.id !== id);
    setSelectors(newSelectors);

    // Clear preview if no selectors left
    if (newSelectors.length === 0) {
      setExtractedData([]);
      setFilteredData([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-primary">
                  Web Monitoring Setup
                </h2>
                <p className="text-text-secondary">
                  Monitor any website for data changes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
            >
              <X className="w-6 h-6 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* URL Input */}
        <div className="p-6 border-b border-border-subtle">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Website URL
              </label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                  className="flex-1 bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
                  placeholder="https://example.com"
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={!validateUrl(url) || loading}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    "Load"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-subtle">
          <div className="flex">
            {[
              { key: "selectors", label: "Selectors" },
              { key: "loop", label: "Loop Config" },
              { key: "preview", label: "Preview" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "selectors" && (
            <SelectorsList
              selectors={selectors}
              onRemoveSelector={removeSelector}
              onShowAiModal={() => setShowAiModal(true)}
              onShowVisualSelector={() => setShowVisualSelector(true)}
              isUrlValid={validateUrl(url)}
            />
          )}

          {activeTab === "loop" && (
            <LoopConfigPanel
              loopConfig={loopConfig}
              onLoopConfigChange={setLoopConfig}
            />
          )}

          {activeTab === "preview" && (
            <DataPreviewPanel
              selectors={selectors}
              previewData={filteredData}
              previewFormat={previewFormat}
              onPreviewFormatChange={setPreviewFormat}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>

            <div className="flex gap-3">
              {agentId && nodeId && (
                <button
                  onClick={() => setShowDashboardConnector(true)}
                  className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Connect to Dashboard
                </button>
              )}

              <button
                onClick={handleFinish}
                disabled={selectors.length === 0}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Finish Setup
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showVisualSelector && (
        <VisualElementSelector
          url={url}
          onSelectorsChange={handleVisualSelectorChange}
          onClose={() => setShowVisualSelector(false)}
        />
      )}

      <AiSelectorModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onConfirm={handleAiSelectorConfirm}
        url={url}
        authHeaders={authHeaders}
      />

      {showDashboardConnector && agentId && nodeId && (
        <DashboardConnector
          agentId={agentId}
          nodeId={nodeId}
          nodeType="webSource"
          nodeLabel="Web Monitoring"
          nodeOutputType="structuredData"
          onClose={() => setShowDashboardConnector(false)}
          onConnect={(widgetId) => {
            console.log("Connected to widget:", widgetId);
            setShowDashboardConnector(false);
          }}
        />
      )}
    </div>
  );
};

export default WebMonitoringConfig;
