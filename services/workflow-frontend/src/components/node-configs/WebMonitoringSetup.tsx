import React, { useState, useEffect } from "react";
import {
  Globe,
  Eye,
  CheckCircle,
  Loader,
  Activity,
  X,
  Database,
  RotateCw,
  Plus,
  Trash2,
  Monitor,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import VisualElementSelector from "../visual-selector/VisualElementSelector";
import DashboardConnector from "../dashboard-connect/DashboardConnector";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface WebMonitoringSetupProps {
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
  name?: string; // Added for named elements from VisualElementSelector
}

// Loop parameter types (reused from HttpRequestSetup)
type LoopParameterType = 'range' | 'list' | 'input_variable';

interface LoopParameter {
  id: string;
  name: string; // Variable name to use in {{variable}} substitution
  type: LoopParameterType;
  
  // Range parameters (for numbers: 1, 2, 3, ..., 10)
  start?: number;
  end?: number;
  step?: number;
  
  // List parameters (manual list of values)
  values?: string[];
  
  // Input variable parameters (use data from previous nodes)
  inputVariable?: string; // e.g., "data.ids" or "data.users[*].id"
  inputPath?: string; // JSONPath to extract values from input data
}

interface LoopConfiguration {
  enabled: boolean;
  parameters: LoopParameter[];
  concurrency: number; // How many requests to run in parallel (1-10)
  delayBetweenRequests: number; // Delay in milliseconds between requests
  aggregationMode: 'append' | 'merge'; // How to combine results
  stopOnError: boolean; // Whether to stop the loop if a request fails
}

const WebMonitoringSetup: React.FC<WebMonitoringSetupProps> = ({
  onClose,
  onMonitoringCreated,
  agentId,
  nodeId,
  existingMonitoring,
}) => {
  const { authHeaders } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectors, setSelectors] = useState<SelectorConfig[]>([]);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [showVisualSelector, setShowVisualSelector] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<'json' | 'table'>('json');
  const [showDashboardConnector, setShowDashboardConnector] = useState(false);
  
  // Loop configuration state
  const [loopConfig, setLoopConfig] = useState<LoopConfiguration>({
    enabled: false,
    parameters: [],
    concurrency: 1,
    delayBetweenRequests: 100,
    aggregationMode: 'append',
    stopOnError: true
  });
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'selectors' | 'loop' | 'preview'>('selectors');

  // Populate form with existing monitoring data
  useEffect(() => {
    if (existingMonitoring) {
      if (existingMonitoring.url) {
        setUrl(existingMonitoring.url);
      }
      if (existingMonitoring.originalSelectors) {
        // Use original selectors for editing
        setSelectors(existingMonitoring.originalSelectors);
      } else if (existingMonitoring.selectors) {
        // Fallback to selectors if original not available (backward compatibility)
        setSelectors(existingMonitoring.selectors);
      }
      if (existingMonitoring.extractedData) {
        setExtractedData(existingMonitoring.extractedData);
      }
      if (existingMonitoring.loopConfig) {
        // Load existing loop configuration
        setLoopConfig(existingMonitoring.loopConfig);
        console.log('📥 Loaded existing loop config:', existingMonitoring.loopConfig);
        
        // If loop is enabled, switch to loop tab so user can see their configuration
        if (existingMonitoring.loopConfig.enabled) {
          setActiveTab('loop');
        }
      }
    }
  }, [existingMonitoring]);

  // Set filtered data directly from extracted data (no column filtering needed)
  useEffect(() => {
    setFilteredData(extractedData);
  }, [extractedData]);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith("http://") || url.startsWith("https://");
    } catch {
      return false;
    }
  };


  const handleAddSelector = async (selector: string, label?: string) => {
    if (!selector.trim()) return;

    const newSelector: SelectorConfig = {
      id: `sel_${Date.now()}`,
      selector: selector.trim(),
      label: label || selector.trim(),
      attribute: "textContent",
    };

    setSelectors([...selectors, newSelector]);
    
    // Immediately extract data with new selector
    if (url) {
      await extractData([...selectors, newSelector]);
    }
  };

  const removeSelector = (id: string) => {
    const newSelectors = selectors.filter(s => s.id !== id);
    setSelectors(newSelectors);
    if (newSelectors.length > 0 && url) {
      extractData(newSelectors);
    } else {
      setExtractedData([]);
    }
  };

  const extractData = async (selectorsToUse: SelectorConfig[] = selectors) => {
    if (!validateUrl(url) || selectorsToUse.length === 0) return;

    setLoading(true);
    try {
      // Check if we have any repeating mode selector
      const repeatingSelector = selectorsToUse.find(sel => (sel as any).type === 'repeating');
      
      let selectorsPayload;
      if (repeatingSelector && (repeatingSelector as any).fields) {
        // Send as structured repeating container format
        selectorsPayload = [{
          selector: repeatingSelector.selector,
          name: repeatingSelector.name || 'container',
          type: 'repeating',
          fields: (repeatingSelector as any).fields.map((field: any) => ({
            name: field.name,
            sub_selector: field.sub_selector,
            attribute: 'textContent'
          }))
        }];
      } else {
        // Send as regular selectors
        selectorsPayload = selectorsToUse.map(sel => ({
          selector: sel.selector,
          label: sel.label,
          name: sel.name, // Pass the element name to backend
          attribute: sel.attribute === "all" ? "all" : (sel.attribute === "table_data" ? "table_data" : "textContent"),
          type: (sel as any).type // Pass the type for table mode
        }));
      }

      console.log('🚀 SENDING TO BACKEND:', { 
        url, 
        selectors: selectorsPayload.map(sel => ({
          ...sel,
          fields: sel.fields?.map(f => ({ name: f.name, sub_selector: f.sub_selector }))
        }))
      });

      const response = await fetch(`${API_BASE_URL}/api/v1/css-selector/extract`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          selectors: selectorsPayload
        }),
      });

      const data = await response.json();
      console.log('📥 RECEIVED FROM BACKEND:', data);
      
      if (data.success) {
        setExtractedData(data.result.extracted_data || []);
      } else {
        console.error("Failed to extract data:", data.error);
        setExtractedData([]);
      }
    } catch (error) {
      console.error("Error extracting data:", error);
      setExtractedData([]);
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

  const handleFinish = async () => {
    if (selectors.length === 0) return;

    setLoading(true);
    try {
      // If agentId is provided, create a monitoring job
      if (agentId) {
        const response = await fetch(`${API_BASE_URL}/api/v1/monitoring-jobs`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            agent_id: agentId,
            name: `Web Monitor - ${new URL(url).hostname}`,
            url,
            selectors: selectors,
            frequency: 3600, // Default to 1 hour
            change_threshold: 0.1
          }),
        });

        const data = await response.json();
        if (data.success) {
          onMonitoringCreated({
            ...data.job,
            url: url,
            selectors: selectors,
            extractedData: filteredData
          });
        } else {
          throw new Error(data.error || "Failed to create monitoring job");
        }
      } else {
        // If no agentId, this is being used for node configuration in workflow
        // Generate the processed payload that the execution engine expects
        const repeatingSelector = selectors.find(sel => (sel as any).type === 'repeating');
        
        let selectorsPayload;
        if (repeatingSelector && (repeatingSelector as any).fields) {
          // Send as structured repeating container format
          selectorsPayload = [{
            selector: repeatingSelector.selector,
            name: repeatingSelector.name || 'container',
            type: 'repeating',
            fields: (repeatingSelector as any).fields.map((field: any) => ({
              name: field.name,
              sub_selector: field.sub_selector,
              attribute: 'textContent'
            }))
          }];
        } else {
          // Send as regular selectors
          selectorsPayload = selectors.map(sel => ({
            selector: sel.selector,
            label: sel.label,
            name: sel.name, // Pass the element name to backend
            attribute: sel.attribute === "all" ? "all" : (sel.attribute === "table_data" ? "table_data" : "textContent"),
            type: (sel as any).type // Pass the type for table mode
          }));
        }
        
        // Debug what we're about to save
        console.log('🔍 SAVING MONITORING CONFIG:');
        console.log('  - selectors (processed):', JSON.stringify(selectorsPayload, null, 2));
        console.log('  - originalSelectors:', JSON.stringify(selectors, null, 2));
        
        // Check if originalSelectors have sub_selector
        if (selectors[0]?.fields) {
          console.log('  - originalSelectors first field:', JSON.stringify(selectors[0].fields[0], null, 2));
        }
        
        // Save both the original selectors and the processed payload for execution
        onMonitoringCreated({
          url: url,
          selectors: selectorsPayload, // Use the processed payload that actually works
          originalSelectors: selectors, // Keep original for editing
          extractedData: filteredData,
          loopConfig: loopConfig, // Include loop configuration
          configured: true
        });
      }
    } catch (error) {
      console.error("Error in handleFinish:", error);
      alert("Failed to complete operation");
    } finally {
      setLoading(false);
    }
  };

  const handleVisualSelectorChange = (selectedElements: any[]) => {
    console.log('DEBUG: Visual selector returned elements:', selectedElements);
    
    // Debug the fields structure specifically
    if (selectedElements[0]?.fields) {
      console.log('DEBUG: Fields structure:', JSON.stringify(selectedElements[0].fields, null, 2));
      console.log('DEBUG: First field sub_selector:', selectedElements[0].fields[0]?.sub_selector);
      console.log('DEBUG: First field full object:', JSON.stringify(selectedElements[0].fields[0], null, 2));
    }
    
    // Check if we have a table mode structure
    if (selectedElements.length === 1 && selectedElements[0].type === 'table') {
      // Handle table mode - just pass the table selector directly for structured extraction
      const tableElement = selectedElements[0];
      const newSelector = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        selector: tableElement.selector,
        label: tableElement.name || 'Table Data',
        attribute: "table_data", // Special attribute to indicate table extraction
        elementCount: tableElement.elementCount,
        name: tableElement.name || 'table',
        type: 'table'
      };
      
      console.log('DEBUG: Converted table selector:', newSelector);
      setSelectors([newSelector]);
    }
    // Check if we have a repeating mode structure
    else if (selectedElements.length === 1 && selectedElements[0].type === 'repeating' && selectedElements[0].fields) {
      // Handle repeating mode - preserve the structure
      const repeatingElement = selectedElements[0];
      const newSelector = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        selector: repeatingElement.selector,
        label: repeatingElement.name || 'Container',
        attribute: "textContent",
        elementCount: repeatingElement.elementCount,
        name: repeatingElement.name || 'container',
        type: 'repeating',
        fields: repeatingElement.fields.map((field: any, index: number) => {
          const mappedField = {
            name: field.name || `field_${index + 1}`,
            sub_selector: field.sub_selector,
            attribute: 'textContent'
          };
          console.log(`DEBUG: Mapping field ${index}:`, { 
            original: field, 
            mapped: mappedField,
            has_sub_selector: !!field.sub_selector
          });
          return mappedField;
        })
      };
      
      console.log('DEBUG: Converted repeating selector:', newSelector);
      console.log('DEBUG: Converted repeating selector fields:', JSON.stringify(newSelector.fields, null, 2));
      setSelectors([newSelector]);
    } else {
      // Convert visual selections to selectors, preserving names
      const newSelectors = selectedElements.map((element, index) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9) + index,
        selector: element.selector, // Use the actual CSS selector
        label: element.name || element.label || `Field ${index + 1}`, // Use user-provided name or fallback
        attribute: "textContent",
        elementCount: element.elementCount,
        name: element.name || `field_${index + 1}`, // Ensure every element has a name
      }));
      
      console.log('DEBUG: Converted to selectors:', newSelectors);
      setSelectors(newSelectors);
    }
    
    setShowVisualSelector(false);
    
    // Immediately extract data with new selectors
    if (url) {
      if (selectedElements.length === 1 && selectedElements[0].type === 'table') {
        // For table mode, extract with the table selector
        const tableElement = selectedElements[0];
        const newSelector = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          selector: tableElement.selector,
          label: tableElement.name || 'Table Data',
          attribute: "table_data",
          elementCount: tableElement.elementCount,
          name: tableElement.name || 'table',
          type: 'table'
        };
        extractData([newSelector]);
      } else if (selectedElements.length === 1 && selectedElements[0].type === 'repeating' && selectedElements[0].fields) {
        // For repeating mode, extract with the new structured selector
        const newSelector = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          selector: selectedElements[0].selector,
          label: selectedElements[0].name || 'Container',
          attribute: "textContent",
          elementCount: selectedElements[0].elementCount,
          name: selectedElements[0].name || 'container',
          type: 'repeating',
          fields: selectedElements[0].fields.map((field: any, index: number) => ({
            name: field.name || `field_${index + 1}`,
            sub_selector: field.sub_selector,
            attribute: 'textContent'
          }))
        };
        extractData([newSelector]);
      } else {
        // For regular mode, extract with the new selectors
        const newSelectors = selectedElements.map((element, index) => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9) + index,
          selector: element.selector,
          label: element.name || element.label || `Field ${index + 1}`,
          attribute: "textContent",
          elementCount: element.elementCount,
          name: element.name || `field_${index + 1}`,
        }));
        extractData(newSelectors);
      }
    }
  };

  // Loop parameter management functions
  const addLoopParameter = () => {
    const newParam: LoopParameter = {
      id: `param_${Date.now()}`,
      name: `param${loopConfig.parameters.length + 1}`,
      type: 'range',
      start: 1,
      end: 10,
      step: 1
    };
    
    setLoopConfig(prev => ({
      ...prev,
      parameters: [...prev.parameters, newParam]
    }));
  };

  const updateLoopParameter = (index: number, updates: Partial<LoopParameter>) => {
    const updatedParams = [...loopConfig.parameters];
    updatedParams[index] = { ...updatedParams[index], ...updates };
    
    setLoopConfig(prev => ({
      ...prev,
      parameters: updatedParams
    }));
  };

  const removeLoopParameter = (index: number) => {
    const updatedParams = loopConfig.parameters.filter((_, i) => i !== index);
    
    setLoopConfig(prev => ({
      ...prev,
      parameters: updatedParams
    }));
  };

  const renderLoopParameter = (param: LoopParameter, index: number) => (
    <div key={param.id} className="p-4 bg-surface-secondary/30 rounded-lg border border-border-subtle space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm bg-surface px-2 py-1 rounded border">
            {`{{${param.name}}}`}
          </div>
          <input
            type="text"
            value={param.name}
            onChange={(e) => updateLoopParameter(index, { name: e.target.value })}
            className="bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
            placeholder="Variable name"
          />
        </div>
        <button
          onClick={() => removeLoopParameter(index)}
          className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
          title="Remove parameter"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Type</label>
          <select
            value={param.type}
            onChange={(e) => updateLoopParameter(index, { type: e.target.value as LoopParameterType })}
            className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
          >
            <option value="range">Number Range</option>
            <option value="list">Value List</option>
            <option value="input_variable">Input Variable</option>
          </select>
        </div>

        {param.type === 'range' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Start - End</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={param.start || 1}
                  onChange={(e) => updateLoopParameter(index, { start: parseInt(e.target.value) || 1 })}
                  className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                  placeholder="1"
                />
                <input
                  type="number"
                  value={param.end || 10}
                  onChange={(e) => updateLoopParameter(index, { end: parseInt(e.target.value) || 10 })}
                  className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                  placeholder="10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Step</label>
              <input
                type="number"
                value={param.step || 1}
                onChange={(e) => updateLoopParameter(index, { step: parseInt(e.target.value) || 1 })}
                className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                placeholder="1"
              />
            </div>
          </>
        )}

        {param.type === 'list' && (
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-text-primary">Values (one per line)</label>
            <textarea
              value={(param.values || []).join('\n')}
              onChange={(e) => updateLoopParameter(index, { values: e.target.value.split('\n').filter(v => v.trim()) })}
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm font-mono"
              placeholder="value1&#10;value2&#10;value3"
              rows={3}
            />
          </div>
        )}

        {param.type === 'input_variable' && (
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-text-primary">Input Variable Path</label>
            <input
              type="text"
              value={param.inputPath || ''}
              onChange={(e) => updateLoopParameter(index, { inputPath: e.target.value })}
              className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm font-mono"
              placeholder="data.teamIds or data.teams[*].id"
            />
            <div className="text-xs text-text-muted">JSONPath to extract values from input data</div>
          </div>
        )}
      </div>

      {/* Preview of values */}
      <div className="pt-2 border-t border-border-subtle">
        <div className="text-xs text-text-muted">
          <span className="font-medium">Preview: </span>
          {param.type === 'range' && param.start !== undefined && param.end !== undefined && param.step !== undefined && (
            <span className="font-mono">
              {Array.from({ length: Math.ceil((param.end - param.start + 1) / param.step) }, (_, i) => param.start! + i * param.step!).slice(0, 5).join(', ')}
              {param.end - param.start + 1 > 5 && '...'}
            </span>
          )}
          {param.type === 'list' && param.values && (
            <span className="font-mono">
              {param.values.slice(0, 3).join(', ')}
              {param.values.length > 3 && '...'}
            </span>
          )}
          {param.type === 'input_variable' && (
            <span className="font-mono">Values from: {param.inputPath || 'Not configured'}</span>
          )}
        </div>
      </div>
    </div>
  );

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
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Website URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder="https://example.com/category/{{categoryId}}/items"
                className="flex-1 bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!validateUrl(url) || loading}
                className="px-6 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : "Load"}
              </button>
            </div>
            <div className="text-xs text-text-muted">
              Use variables like <code className="bg-surface-secondary px-1 rounded">{`{{categoryId}}`}</code> in URL path for dynamic scraping
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border-subtle">
            <div className="flex">
              {[
                { id: 'selectors', label: 'CSS Selectors', icon: Eye },
                { id: 'loop', label: 'Loop Parameters', icon: RotateCw },
                { id: 'preview', label: 'Data Preview', icon: Database }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-muted hover:text-text-primary'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'selectors' && (
            <div className="space-y-4">
              <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">
                CSS Selectors
              </h3>
              <p className="text-text-secondary text-sm">
                Add CSS selectors to extract data from multiple elements (e.g., table rows, list items)
              </p>
            </div>

            {/* Visual Selector Button */}
            <button
              onClick={() => setShowVisualSelector(true)}
              disabled={!validateUrl(url)}
              className="w-full p-4 bg-surface border border-border-subtle rounded-lg hover:border-primary transition-colors flex items-center justify-center gap-2 text-text-primary"
            >
              <Eye className="w-5 h-5" />
              Open Visual Element Selector
            </button>


            {/* Selector List */}
            {selectors.length > 0 && (
              <div className="space-y-2">
                {selectors.map((selector) => (
                  <div
                    key={selector.id}
                    className="flex items-center gap-3 p-3 bg-surface border border-border-subtle rounded-lg"
                  >
                    <div className="flex-1">
                      {selector.name && (
                        <div className="text-sm font-medium text-accent-green mb-1">
                          {selector.name}
                        </div>
                      )}
                      <code className="text-sm text-primary font-mono">
                        {selector.selector}
                      </code>
                    </div>
                    <span className="text-xs text-text-muted">
                      {selector.elementCount !== undefined
                        ? `${selector.elementCount} matches`
                        : ""}
                    </span>
                    <button
                      onClick={() => removeSelector(selector.id)}
                      className="p-1 hover:bg-surface-secondary rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-text-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {/* Loop Parameters Tab */}
          {activeTab === 'loop' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  Loop Parameters
                </h3>
                <p className="text-text-secondary text-sm">
                  Define variables to loop over in the URL using {`{{variable}}`} syntax (e.g., https://example.com/category/{`{{categoryId}}`}/items)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={loopConfig.enabled}
                    onChange={(e) => setLoopConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-border-subtle"
                  />
                  <span className="text-sm font-medium text-text-primary">Enable Parameter Looping</span>
                </label>
                
                {loopConfig.enabled && (
                  <button
                    onClick={addLoopParameter}
                    className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Parameter
                  </button>
                )}
              </div>

              {loopConfig.enabled && (
                <div className="space-y-4">
                  {loopConfig.parameters.map((param, index) => renderLoopParameter(param, index))}
                  
                  {loopConfig.parameters.length > 0 && (
                    <div className="space-y-4 p-4 bg-surface border border-border-subtle rounded-lg">
                      <h4 className="font-medium text-text-primary">Execution Settings</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-1">
                            Concurrency (parallel requests)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={loopConfig.concurrency}
                            onChange={(e) => setLoopConfig(prev => ({ ...prev, concurrency: parseInt(e.target.value) || 1 }))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-1">
                            Delay Between Requests (ms)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={loopConfig.delayBetweenRequests}
                            onChange={(e) => setLoopConfig(prev => ({ ...prev, delayBetweenRequests: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Result Aggregation Mode
                        </label>
                        <select
                          value={loopConfig.aggregationMode}
                          onChange={(e) => setLoopConfig(prev => ({ ...prev, aggregationMode: e.target.value as 'append' | 'merge' }))}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
                        >
                          <option value="append">Append Arrays (recommended for lists)</option>
                          <option value="merge">Merge Objects (for single results per iteration)</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={loopConfig.stopOnError}
                          onChange={(e) => setLoopConfig(prev => ({ ...prev, stopOnError: e.target.checked }))}
                          className="rounded border-border-subtle"
                        />
                        <span className="text-sm text-text-primary">Stop execution on first error</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Data Preview Tab */}
          {activeTab === 'preview' && filteredData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-accent-green" />
                <h3 className="text-lg font-medium text-text-primary">
                  Structured Data Preview
                </h3>
                <span className="text-sm text-text-muted">
                  ({filteredData.length} items)
                </span>
              </div>

              {(() => {
                // Check if we have structured row data from repeating containers
                const hasStructuredRows = filteredData.length > 0 && 
                  filteredData[0] && 
                  typeof filteredData[0] === 'object' &&
                  Object.keys(filteredData[0]).some(key => 
                    Array.isArray(filteredData[0][key]) && 
                    filteredData[0][key].length > 0 &&
                    typeof filteredData[0][key][0] === 'object'
                  );
                
                if (!filteredData.length) {
                  return (
                    <div className="bg-surface rounded-lg border border-border-subtle p-4">
                      <div className="text-sm text-text-muted">
                        No data extracted yet. Please select elements and try again.
                      </div>
                    </div>
                  );
                }

                if (hasStructuredRows) {
                  // Handle structured row data from repeating containers
                  const containerData = filteredData[0];
                  const containerKeys = Object.keys(containerData);
                  
                  // Find the first key that contains structured rows
                  const rowDataKey = containerKeys.find(key => 
                    Array.isArray(containerData[key]) && 
                    containerData[key].length > 0 &&
                    typeof containerData[key][0] === 'object'
                  );
                  
                  if (rowDataKey) {
                    const rows = containerData[rowDataKey];
                    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                    
                    console.log('DEBUG: Structured rows found:', { rowDataKey, rows: rows.length, columns });
                    
                    return (
                      <div className="bg-surface rounded-lg border border-border-subtle p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 bg-accent-green rounded-full"></div>
                          <span className="text-sm font-medium text-accent-green">
                            Structured Data Detected: {rows.length} {rowDataKey} with {columns.length} fields
                          </span>
                        </div>
                        
                        {/* Toggle between different views */}
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => setPreviewFormat('json')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              previewFormat === 'json' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                            }`}
                          >
                            JSON Format
                          </button>
                          <button
                            onClick={() => setPreviewFormat('table')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              previewFormat === 'table' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                            }`}
                          >
                            Table Format
                          </button>
                        </div>

                        {previewFormat === 'table' ? (
                          // Table format for structured rows
                          <div className="overflow-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border-subtle">
                                  {columns.map(column => (
                                    <th key={column} className="text-left p-2 text-text-primary font-medium capitalize">
                                      {column.replace(/_/g, ' ')}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.slice(0, 10).map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex} className="border-b border-border-subtle/50">
                                    {columns.map(column => (
                                      <td key={column} className="p-2 text-text-secondary font-mono">
                                        {typeof row[column] === 'object' ? JSON.stringify(row[column]) : (row[column] || '-')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {rows.length > 10 && (
                              <div className="text-xs text-text-muted mt-2 text-center">
                                Showing first 10 of {rows.length} items
                              </div>
                            )}
                          </div>
                        ) : (
                          // JSON format
                          <pre className="bg-background rounded-md p-3 text-xs text-text-primary font-mono overflow-auto max-h-96 border border-border-subtle">
                            {JSON.stringify(rows.slice(0, 5), null, 2)}
                            {rows.length > 5 && '\n... and ' + (rows.length - 5) + ' more items'}
                          </pre>
                        )}

                        <div className="text-xs text-text-muted mt-3">
                          • Perfect structured data: Each row represents one {rowDataKey.slice(0, -1)} with {columns.length} fields
                          • This format is ideal for data analysis and monitoring
                          • Fields: {columns.join(', ')}
                        </div>
                      </div>
                    );
                  }
                }

                // Check if we have a table mode selector
                const tableSelector = selectors.find(sel => (sel as any).type === 'table');
                if (tableSelector) {
                  // Show table mode data structure
                  const tableName = tableSelector.name || 'table';
                  
                  console.log('DEBUG: Found table selector:', { tableName, tableSelector });
                  
                  // Look for table data in filtered data
                  const tableData = filteredData.length > 0 && filteredData[0][tableName];
                  
                  if (tableData && Array.isArray(tableData) && tableData.length > 0) {
                    const columns = Object.keys(tableData[0]);
                    
                    console.log('DEBUG: Table data found:', { rows: tableData.length, columns });
                    
                    return (
                      <div className="bg-surface rounded-lg border border-border-subtle p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-600">
                            Table Data: {tableData.length} rows with {columns.length} columns
                          </span>
                        </div>
                        
                        {/* Toggle between different views */}
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => setPreviewFormat('json')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              previewFormat === 'json' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                            }`}
                          >
                            JSON Format
                          </button>
                          <button
                            onClick={() => setPreviewFormat('table')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              previewFormat === 'table' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                            }`}
                          >
                            Table Format
                          </button>
                        </div>

                        {previewFormat === 'table' ? (
                          // Table format for table rows
                          <div className="overflow-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border-subtle">
                                  {columns.map(column => (
                                    <th key={column} className="text-left p-2 text-text-primary font-medium capitalize">
                                      {column.replace(/_/g, ' ')}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tableData.slice(0, 10).map((row: any, rowIndex: number) => (
                                  <tr key={rowIndex} className="border-b border-border-subtle/50">
                                    {columns.map(column => (
                                      <td key={column} className="p-2 text-text-secondary font-mono">
                                        {typeof row[column] === 'object' ? JSON.stringify(row[column]) : (row[column] || '-')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {tableData.length > 10 && (
                              <div className="text-xs text-text-muted mt-2 text-center">
                                Showing first 10 of {tableData.length} rows
                              </div>
                            )}
                          </div>
                        ) : (
                          // JSON format
                          <pre className="bg-background rounded-md p-3 text-xs text-text-primary font-mono overflow-auto max-h-96 border border-border-subtle">
                            {JSON.stringify(tableData.slice(0, 5), null, 2)}
                            {tableData.length > 5 && '\n... and ' + (tableData.length - 5) + ' more rows'}
                          </pre>
                        )}

                        <div className="text-xs text-text-muted mt-3">
                          • Perfect table data: {tableData.length} rows with {columns.length} columns each
                          • This format is ideal for spreadsheet export and data analysis
                          • Columns: {columns.join(', ')}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-surface rounded-lg border border-border-subtle p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-600">
                            Table Mode: {tableName}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="text-xs font-medium text-text-primary">Table Selector:</div>
                          <div className="bg-background rounded p-2 border border-border-subtle">
                            <div className="text-sm font-medium text-blue-600">{tableName}</div>
                            <div className="text-xs text-text-muted font-mono">{tableSelector.selector}</div>
                          </div>
                        </div>

                        <div className="text-xs text-text-muted mb-4">
                          • Table mode will extract all rows and columns automatically
                          • Headers will be detected from the first row
                          • Data will be structured as an array of objects
                        </div>

                        <div className="text-sm text-orange-600">
                          No table data extracted yet. The data will appear here after extraction.
                        </div>
                      </div>
                    );
                  }
                }
                
                // Check if we have a repeating mode selector
                const repeatingSelector = selectors.find(sel => (sel as any).type === 'repeating');
                if (repeatingSelector && (repeatingSelector as any).fields) {
                  // Show container and field information for repeating mode
                  const containerName = repeatingSelector.name || 'container';
                  const fields = (repeatingSelector as any).fields;
                  
                  console.log('DEBUG: Found repeating selector:', { containerName, fields });
                  
                  return (
                    <div className="bg-surface rounded-lg border border-border-subtle p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium text-orange-600">
                          Repeating Container: {containerName} with {fields.length} fields
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="text-xs font-medium text-text-primary">Container:</div>
                        <div className="bg-background rounded p-2 border border-border-subtle">
                          <div className="text-sm font-medium text-accent-green">{containerName}</div>
                          <div className="text-xs text-text-muted font-mono">{repeatingSelector.selector}</div>
                        </div>
                        
                        <div className="text-xs font-medium text-text-primary mt-3">Fields:</div>
                        {fields.map((field: any, index: number) => (
                          <div key={index} className="bg-background rounded p-2 border border-border-subtle">
                            <div className="text-sm font-medium text-primary">{field.name}</div>
                            <div className="text-xs text-text-muted font-mono">{field.sub_selector}</div>
                          </div>
                        ))}
                      </div>

                      <div className="text-xs text-text-muted mb-4">
                        • Repeating mode will extract structured data from each container
                        • Each field will be extracted using relative selectors within containers
                        • Missing fields in some containers will be handled gracefully
                      </div>

                      {/* Show actual extracted data if available */}
                      {(hasStructuredRows || filteredData.length > 0) && (
                        <>
                          <div className="border-t border-border-subtle pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-3 h-3 bg-accent-green rounded-full"></div>
                              <span className="text-sm font-medium text-accent-green">
                                Extracted Data Preview
                              </span>
                            </div>

                            {/* Toggle between different views */}
                            <div className="flex gap-2 mb-4">
                              <button
                                onClick={() => setPreviewFormat('json')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                  previewFormat === 'json' 
                                    ? 'bg-primary/20 text-primary' 
                                    : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                                }`}
                              >
                                JSON Format
                              </button>
                              <button
                                onClick={() => setPreviewFormat('table')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                  previewFormat === 'table' 
                                    ? 'bg-primary/20 text-primary' 
                                    : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                                }`}
                              >
                                Table Format
                              </button>
                            </div>

                            {(() => {
                              // Get the structured data
                              const containerData = filteredData[0];
                              const containerKeys = Object.keys(containerData);
                              const rowDataKey = containerKeys.find(key => 
                                Array.isArray(containerData[key]) && 
                                containerData[key].length > 0 &&
                                typeof containerData[key][0] === 'object'
                              );
                              
                              if (rowDataKey) {
                                const rows = containerData[rowDataKey];
                                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                                
                                if (previewFormat === 'table') {
                                  return (
                                    <div className="overflow-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-border-subtle">
                                            {columns.map(column => (
                                              <th key={column} className="text-left p-2 text-text-primary font-medium capitalize">
                                                {column.replace(/_/g, ' ')}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.slice(0, 5).map((row: any, rowIndex: number) => (
                                            <tr key={rowIndex} className="border-b border-border-subtle/50">
                                              {columns.map(column => (
                                                <td key={column} className="p-2 text-text-secondary font-mono">
                                                  {row[column] || '-'}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {rows.length > 5 && (
                                        <div className="text-xs text-text-muted mt-2 text-center">
                                          Showing first 5 of {rows.length} items
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else {
                                  return (
                                    <pre className="bg-background rounded-md p-3 text-xs text-text-primary font-mono overflow-auto max-h-96 border border-border-subtle">
                                      {JSON.stringify(rows.slice(0, 3), null, 2)}
                                      {rows.length > 3 && '\n... and ' + (rows.length - 3) + ' more items'}
                                    </pre>
                                  );
                                }
                              }
                              
                              // Fallback: show raw data if we have any data but not in expected format
                              if (filteredData.length > 0) {
                                return (
                                  <div>
                                    <div className="text-sm text-orange-600 mb-2">
                                      Raw extracted data (debug view):
                                    </div>
                                    <pre className="bg-background rounded-md p-3 text-xs text-text-primary font-mono overflow-auto max-h-96 border border-border-subtle">
                                      {JSON.stringify(filteredData, null, 2)}
                                    </pre>
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="text-sm text-text-muted">
                                  No extracted data available yet. The data will appear here after extraction.
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  );
                }

                // Fallback to original grouped data handling for regular selectors
                const elementGroups: Record<string, string[]> = {};
                
                // Process each selector to group the extracted data
                selectors.forEach((selector, index) => {
                  console.log(`DEBUG: Processing selector ${index}:`, selector);
                  
                  const elementName = selector.name || selector.label || `element_${index}`;
                  
                  // The backend should return data with keys matching the selector
                  // Look for data specifically associated with this selector
                  const selectorKey = selector.selector;
                  
                  // Try to find data for this specific selector
                  const matchingData = filteredData
                    .map(item => {
                      // The key should match the selector exactly
                      let value = item[selectorKey] || item[selector.label] || '';
                      
                      // If still empty, try other common keys as fallback
                      if (!value) {
                        const fallbackKeys = ['full_text', 'text', 'textContent'];
                        for (const key of fallbackKeys) {
                          if (item[key]) {
                            value = item[key];
                            break;
                          }
                        }
                      }
                      
                      console.log(`DEBUG: For selector "${selectorKey}", found value:`, value);
                      return typeof value === 'string' ? value.trim() : String(value);
                    })
                    .filter(value => value && value !== '' && value !== 'undefined' && value !== 'null');
                  
                  console.log(`DEBUG: Final matchingData for ${elementName}:`, matchingData);
                  
                  if (matchingData.length > 0) {
                    elementGroups[elementName] = matchingData;
                  }
                });
                
                console.log('DEBUG: Final elementGroups:', elementGroups);

                // Check if all arrays are the same length for table format
                const groupKeys = Object.keys(elementGroups);
                const allSameLength = groupKeys.length > 1 && 
                  groupKeys.every(key => elementGroups[key].length === elementGroups[groupKeys[0]].length);

                return (
                  <div className="bg-surface rounded-lg border border-border-subtle p-4">
                    {groupKeys.length === 0 ? (
                      <div className="text-sm text-text-muted">
                        No named elements found. Please give your selected elements names in the Visual Element Selector.
                      </div>
                    ) : (
                      <>
                        {/* Toggle between different views */}
                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => setPreviewFormat('json')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              previewFormat === 'json' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                            }`}
                          >
                            JSON Format
                          </button>
                          {allSameLength && (
                            <button
                              onClick={() => setPreviewFormat('table')}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                previewFormat === 'table' 
                                  ? 'bg-primary/20 text-primary' 
                                  : 'bg-surface-secondary text-text-muted hover:bg-surface-secondary/80'
                              }`}
                            >
                              Table Format
                            </button>
                          )}
                        </div>

                        {previewFormat === 'table' && allSameLength ? (
                          // Table format when all arrays are same length
                          <div className="overflow-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border-subtle">
                                  {groupKeys.map(key => (
                                    <th key={key} className="text-left p-2 text-text-primary font-medium">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: elementGroups[groupKeys[0]].length }).map((_, rowIndex) => (
                                  <tr key={rowIndex} className="border-b border-border-subtle/50">
                                    {groupKeys.map(key => (
                                      <td key={key} className="p-2 text-text-secondary font-mono">
                                        {elementGroups[key][rowIndex] || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          // JSON format
                          <pre className="bg-background rounded-md p-3 text-xs text-text-primary font-mono overflow-auto max-h-96 border border-border-subtle">
                            {JSON.stringify(elementGroups, null, 2)}
                          </pre>
                        )}

                        <div className="text-xs text-text-muted mt-3">
                          {allSameLength ? (
                            <>
                              • All elements have {elementGroups[groupKeys[0]]?.length || 0} items - perfect for table format
                              • Switch between JSON and table views using the buttons above
                            </>
                          ) : (
                            <>
                              • Elements have different lengths: {groupKeys.map(key => `${key}(${elementGroups[key].length})`).join(', ')}
                              • This clean structure contains only your named elements
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
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
              onClick={handleFinish}
              disabled={loading || selectors.length === 0}
              className="px-8 py-3 bg-accent-green hover:bg-accent-green/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Monitor
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Visual Element Selector Modal */}
      {showVisualSelector && (
        <VisualElementSelector
          url={url}
          onSelectorsChange={handleVisualSelectorChange}
          onClose={() => setShowVisualSelector(false)}
        />
      )}

      {/* Dashboard Connector Modal */}
      {showDashboardConnector && agentId && nodeId && (() => {
        // Determine output type based on current configuration
        const getOutputType = () => {
          // Check if it's configured for table/structured output
          if (selectors.some((s: any) => s.type === 'table' || s.type === 'repeating')) {
            return 'structuredData';
          }
          
          // Check if it's configured and has multiple selectors (structured format)
          if (selectors.length > 1) {
            return 'structuredData';
          }
          
          // Single text-based selectors output text data
          if (selectors.length === 1) {
            const selector = selectors[0];
            if (selector.attribute === 'textContent' || selector.attribute === 'innerText') {
              return 'textData';
            }
          }
          
          // Check if configured
          if (selectors.length > 0) {
            return 'structuredData'; // If configured, assume structured output
          }
          
          // Default to raw data if not specifically configured
          return 'rawData';
        };

        return (
          <DashboardConnector
            agentId={agentId}
            nodeId={nodeId}
            nodeType="webSource"
            nodeLabel="Web Monitoring"
            nodeOutputType={getOutputType()}
            onClose={() => setShowDashboardConnector(false)}
            onConnect={(widgetId) => {
              console.log('Connected to widget:', widgetId);
              setShowDashboardConnector(false);
            }}
          />
        );
      })()}
    </div>
  );
};

export default WebMonitoringSetup;