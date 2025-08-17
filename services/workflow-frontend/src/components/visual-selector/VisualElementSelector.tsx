/**
 * Visual Element Selector - Main Component
 * Modularized version with clear separation of concerns
 */

import React, { useState, useEffect, useRef } from "react";
import { Globe, X, Settings, Eye, MousePointer, Table, Layers } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

// Import modular utilities
import {
  VisualElementSelectorProps,
  SelectedElement,
  SelectionMode,
} from "./types";
import {
  testProxyAccess,
} from "./iframeUtils";

const VisualElementSelector: React.FC<VisualElementSelectorProps> = ({
  url,
  onSelectorsChange,
  onClose,
}) => {
  const { authHeaders } = useAuth();
  
  // State management
  const [error, setError] = useState<string>("");
  const [proxyUrl, setProxyUrl] = useState<string>("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("raw");
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [containerElement, setContainerElement] = useState<SelectedElement | null>(null);
  const [manualSelector, setManualSelector] = useState("");

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initialize proxy and iframe setup
  useEffect(() => {
    const initializeProxy = async () => {
      if (!url) return;

      try {
        const result = await testProxyAccess(url, authHeaders);
        
        if (result.success && result.proxyUrl) {
          setProxyUrl(result.proxyUrl);
          setError("");
        } else {
          setError(
            result.error || "Visual element selection not available for this URL. Please use manual CSS selectors."
          );
        }
      } catch (error) {
        console.error("Proxy initialization failed:", error);
        setError("Failed to initialize visual selector. Please use manual CSS selectors.");
      }
    };

    initializeProxy();
  }, [url, authHeaders]);

  // Setup iframe message listener
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      const message = event.data;
      // Only log selection events, not hover/info events
      if (message.type === "ELEMENT_SELECTED") {
        console.log('📨 Parent received message:', message);
      }
      
      if (message.type === "ELEMENT_SELECTED" && message.element && message.selector) {
        
        // Create SelectedElement from the message
        const selectedElement: SelectedElement = {
          selector: message.selector,
          text: message.element.textContent || '',
          tagName: message.element.tagName,
          elementCount: 1, // From proxy selector, will be 1
          type: selectionMode, // Directly use the selection mode as it now matches our 3-type system
          label: `${message.element.tagName.toLowerCase()}: ${message.element.textContent?.slice(0, 30) || 'element'}...`,
          relativeSelector: message.relativeSelector // Add relative selector from iframe
        };
        
        if (selectionMode === "tables") {
          // In table mode, just add the table and we're done
          const newElements = [...selectedElements, selectedElement];
          setSelectedElements(newElements);
        } else if (selectionMode === "repeating" && !containerElement) {
          // Set as container for repeating mode
          setContainerElement(selectedElement);
          
          // Send container selector to iframe
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'SET_CONTAINER_SELECTOR',
              selector: selectedElement.selector
            }, '*');
          }
        } else if (selectionMode === "repeating" && containerElement) {
          // In repeating mode with container set, add as field
          
          // Initialize fields array if not present
          if (!containerElement.fields) {
            containerElement.fields = [];
          }
          
          // Debug the selectors
          console.log('🔍 FIELD CREATION DEBUG:', {
            absoluteSelector: selectedElement.selector,
            relativeSelector: selectedElement.relativeSelector,
            name: selectedElement.name
          });
          
          const fieldElement = {
            name: selectedElement.name || `field_${containerElement.fields.length + 1}`,
            sub_selector: selectedElement.relativeSelector || selectedElement.selector || 'MISSING_SELECTOR', // Use relative selector if available
            attribute: 'textContent'
          };
          
          console.log('🔍 CREATED FIELD:', fieldElement);
          
          containerElement.fields.push(fieldElement);
          setContainerElement({ ...containerElement }); // Update state to trigger re-render
          
          // Also add to selectedElements for the UI display
          const displayElement = {
            ...selectedElement,
            name: fieldElement.name
          };
          const newElements = [...selectedElements, displayElement];
          setSelectedElements(newElements);
          
        } else {
          // Add to selected elements
          const newElements = [...selectedElements, selectedElement];
          setSelectedElements(newElements);
          // Don't call onSelectorsChange immediately - wait for user to finish
        }
      } else if (message.type === "SELECTION_MODE_CONFIRMED") {
        // Mode confirmed
      } else if (message.type === "ELEMENT_INFO") {
        // Handle hover highlighting - we can show info or highlight on parent side
        showElementHighlight(message.element, message.rect, message.selector);
      }
    };

    window.addEventListener('message', handleIframeMessage);

    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, [selectionMode, selectedElements, containerElement, onSelectorsChange]);

  // Setup iframe when it loads
  const handleIframeLoad = () => {
    setError('');
    // Send initial selection mode to iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'SET_SELECTION_MODE',
        mode: selectionMode
      }, '*');
    }
  };


  // Mode toggle functions
  const toggleSelectionMode = () => {
    const newMode = !isSelectionMode;
    setIsSelectionMode(newMode);

    if (iframeRef.current?.contentWindow) {
      const message = {
        type: newMode ? 'ENABLE_SELECTOR_MODE' : 'DISABLE_SELECTOR_MODE'
      };
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  const handleModeChange = (newMode: SelectionMode) => {
    setSelectionMode(newMode);
    
    // Reset container state when changing modes
    if (newMode !== "repeating") {
      setContainerElement(null);
    }
    
    // Send mode change to iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'SET_SELECTION_MODE',
        mode: newMode
      }, '*');
    }
  };

  // Overlay mouse handlers for cross-origin iframe communication
  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!iframeRef.current?.contentWindow) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Send hover request to iframe
    iframeRef.current.contentWindow.postMessage({
      type: 'GET_ELEMENT_AT_POINT',
      x: x,
      y: y,
      action: 'HOVER'
    }, '*');
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!iframeRef.current?.contentWindow) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Send selection request to iframe
    iframeRef.current.contentWindow.postMessage({
      type: 'GET_ELEMENT_AT_POINT',
      x: x,
      y: y,
      action: 'SELECT'
    }, '*');
  };

  const handleOverlayMouseLeave = () => {
    // Could send a message to clear highlights, but for now do nothing
  };

  // Show element highlight based on iframe feedback
  const showElementHighlight = (element: any, rect: any, selector: string) => {
    // The main highlighting happens inside the iframe via CSS classes
    // Could add additional UI feedback here if needed
  };

  // Generate data preview JSON
  const generateDataPreview = (): string => {
    if (selectionMode === "repeating" && containerElement) {
      // Repeating mode: structured data
      const containerName = containerElement.name || 'items';
      const fields: Record<string, string> = {};
      
      selectedElements.forEach((element, index) => {
        const fieldName = element.name || `field_${index + 1}`;
        fields[fieldName] = `"${element.text?.slice(0, 20) || 'sample text'}..."`;
      });
      
      if (Object.keys(fields).length === 0) {
        return `{\n  "${containerName}": [\n    // Select fields within the container to see structure\n  ]\n}`;
      }
      
      const fieldsJson = Object.entries(fields)
        .map(([key, value]) => `    "${key}": ${value}`)
        .join(',\n');
        
      return `{\n  "${containerName}": [\n    {\n${fieldsJson}\n    },\n    {\n${fieldsJson}\n    }\n    // ... more items\n  ]\n}`;
      
    } else {
      // All/Table mode: array of named elements
      if (selectedElements.length === 0) {
        return '[\n  // Select elements to see data structure\n]';
      }
      
      const elements = selectedElements.map((element, index) => {
        const fieldName = element.name || `field_${index + 1}`;
        const sampleText = element.text?.slice(0, 20) || 'sample text';
        return `  "${fieldName}": "${sampleText}..."`;
      });
      
      return `[\n  {\n${elements.join(',\n')}\n  },\n  {\n${elements.join(',\n')}\n  }\n  // ... more items\n]`;
    }
  };

  // Suggest field name based on element
  const suggestFieldName = (element: SelectedElement): string => {
    // Try to extract meaningful name from text content or class names
    const text = element.text?.trim().toLowerCase();
    const classes = element.tagName?.toLowerCase();
    
    if (text) {
      if (text.includes('name')) return 'name';
      if (text.includes('title')) return 'title';
      if (text.includes('price')) return 'price';
      if (text.includes('score')) return 'score';
      if (text.includes('rank')) return 'rank';
      if (text.includes('team')) return 'team';
      if (text.includes('player')) return 'player';
    }
    
    if (classes) {
      if (classes.includes('h1') || classes.includes('h2') || classes.includes('h3')) return 'title';
      if (classes.includes('img')) return 'image';
      if (classes.includes('link') || classes.includes('a')) return 'link';
    }
    
    return 'field';
  };

  // Update element name
  const updateElementName = (index: number, name: string) => {
    const newElements = [...selectedElements];
    newElements[index] = { ...newElements[index], name };
    setSelectedElements(newElements);
    
    // If in repeating mode, also update the corresponding field in containerElement
    if (selectionMode === "repeating" && containerElement && containerElement.fields) {
      const updatedFields = [...containerElement.fields];
      if (updatedFields[index]) {
        updatedFields[index] = { ...updatedFields[index], name };
        setContainerElement({ ...containerElement, fields: updatedFields });
        console.log('🏷️ Updated field name in container:', updatedFields[index]);
      }
    }
  };

  // Update container name
  const updateContainerName = (name: string) => {
    if (containerElement) {
      setContainerElement({ ...containerElement, name });
    }
  };

  // Handle manual selector addition
  const handleAddManualSelector = () => {
    if (!manualSelector.trim()) return;

    const manualElement: SelectedElement = {
      selector: manualSelector.trim(),
      text: "",
      tagName: "manual",
      elementCount: 0,
      type: "raw",
      label: `Manual: ${manualSelector}`,
    };
    
    const newElements = [...selectedElements, manualElement];
    setSelectedElements(newElements);
    // Don't call onSelectorsChange immediately - wait for user to finish
    setManualSelector("");
  };

  // Remove selected element
  const removeElement = (index: number) => {
    const newElements = selectedElements.filter((_, i) => i !== index);
    setSelectedElements(newElements);
    // Don't call onSelectorsChange immediately - wait for user to finish
  };

  // Finish selection
  const handleFinish = () => {
    let finalElements = selectedElements;

    // If we have a container with fields, create the final structured element
    if (containerElement && containerElement.fields && containerElement.fields.length > 0) {
      const finalContainer: SelectedElement = {
        ...containerElement,
        type: 'repeating',
        fields: containerElement.fields,
      };
      finalElements = [finalContainer];
    }

    console.log('🏁 Finishing selection with elements:', finalElements);
    console.log('🏁 Elements with names:', finalElements.map(el => ({ 
      name: el.name, 
      selector: el.selector,
      type: (el as any).type,
      fields: (el as any).fields 
    })));
    
    // Debug the actual fields structure being passed
    if (containerElement && containerElement.fields) {
      console.log('🔍 CONTAINER FIELDS BEFORE PASSING:', JSON.stringify(containerElement.fields, null, 2));
      finalElements.forEach((el, idx) => {
        if ((el as any).fields) {
          console.log(`🔍 FINAL ELEMENT ${idx} FIELDS:`, JSON.stringify((el as any).fields, null, 2));
        }
      });
    }
    
    onSelectorsChange(finalElements);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-primary">
                  Visual Element Selector
                </h2>
                <p className="text-text-secondary">
                  Click elements to select them for data extraction
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
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel - Controls */}
          <div className="w-80 border-r border-border-subtle p-6 overflow-y-auto">
            
            {/* Mode Selection */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-medium text-text-primary">Selection Mode</h3>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleModeChange("raw")}
                  className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                    selectionMode === "raw"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle hover:border-primary/50"
                  }`}
                >
                  <MousePointer className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Raw Elements</div>
                    <div className="text-xs opacity-70">Select individual text/content elements</div>
                  </div>
                </button>

                <button
                  onClick={() => handleModeChange("tables")}
                  className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                    selectionMode === "tables"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle hover:border-primary/50"
                  }`}
                >
                  <Table className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Table Mode</div>
                    <div className="text-xs opacity-70">Extract structured table data</div>
                  </div>
                </button>

                <button
                  onClick={() => handleModeChange("repeating")}
                  className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                    selectionMode === "repeating"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle hover:border-primary/50"
                  }`}
                >
                  <Layers className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Repeating Mode</div>
                    <div className="text-xs opacity-70">Extract data from repeating containers/patterns</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Selection Toggle */}
            <div className="mb-6">
              <button
                onClick={toggleSelectionMode}
                disabled={!!error}
                className={`w-full p-4 rounded-lg font-medium transition-colors ${
                  isSelectionMode
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-primary hover:bg-primary-hover text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSelectionMode ? "Stop Selecting" : "Start Selecting"}
              </button>
            </div>

            {/* Repeating Mode Instructions */}
            {selectionMode === "repeating" && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-sm text-orange-800">
                  <div className="font-medium mb-2">Repeating Mode Instructions:</div>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>First, click a container element (like a card or row)</li>
                    <li>All similar containers will be highlighted</li>
                    <li>Then click specific fields within containers to name them</li>
                    <li>This creates structured data like [{"{name: 'John', age: 25}, {...}"}]</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Data Preview */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-medium text-text-primary">Data Preview</h3>
              
              {selectedElements.length === 0 && !containerElement ? (
                <div className="text-sm text-text-muted p-4 border border-border-subtle rounded-lg">
                  No elements selected yet. Click elements in the preview to select them.
                </div>
              ) : (
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                  <pre>{generateDataPreview()}</pre>
                </div>
              )}
            </div>

            {/* Selected Elements with Naming */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary">
                Selected Elements ({selectedElements.length})
              </h3>
              
              {/* Container Element (for repeating mode) */}
              {containerElement && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-800 mb-2">
                    Container Element
                  </div>
                  <div className="text-xs text-green-700 font-mono break-all mb-2">
                    {containerElement.selector}
                  </div>
                  <input
                    type="text"
                    value={containerElement.name || 'items'}
                    onChange={(e) => updateContainerName(e.target.value)}
                    placeholder="Container name (e.g., 'players', 'products')"
                    className="w-full bg-white text-text-primary p-2 rounded border border-green-300 focus:border-green-500 focus:outline-none text-sm"
                  />
                </div>
              )}
              
              {selectedElements.length === 0 ? (
                <div className="text-sm text-text-muted p-4 border border-border-subtle rounded-lg">
                  {selectionMode === "repeating" && !containerElement 
                    ? "First, select a container element (like a card or row)"
                    : "Click elements in the preview to select them."}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedElements.map((element, index) => (
                    <div
                      key={index}
                      className="p-3 bg-surface border border-border-subtle rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-text-muted font-mono break-all mb-1">
                            {element.selector}
                          </div>
                          {element.elementCount > 0 && (
                            <div className="text-xs text-accent-green">
                              {element.elementCount} matches
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeElement(index)}
                          className="ml-2 p-1 hover:bg-surface-secondary rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-text-muted" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={element.name || ''}
                        onChange={(e) => updateElementName(index, e.target.value)}
                        placeholder={`Field name (e.g., '${suggestFieldName(element)}')`}
                        className="w-full bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Selector */}
            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-medium text-text-primary">Manual CSS Selector</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualSelector}
                  onChange={(e) => setManualSelector(e.target.value)}
                  placeholder="e.g., .player-card h3"
                  className="flex-1 bg-surface text-text-primary p-2 rounded border border-border-subtle focus:border-primary focus:outline-none text-sm"
                />
                <button
                  onClick={handleAddManualSelector}
                  disabled={!manualSelector.trim()}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium text-sm transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col">
            
            {/* Preview Header */}
            <div className="p-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-text-primary">Preview</span>
                <span className="text-xs text-text-muted">({url})</span>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative">
              {error ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-red-500 mb-4">
                      <Settings className="w-12 h-12 mx-auto" />
                    </div>
                    <div className="text-text-primary font-medium mb-2">
                      Visual Selection Unavailable
                    </div>
                    <div className="text-text-secondary text-sm max-w-md">
                      {error}
                    </div>
                  </div>
                </div>
              ) : proxyUrl ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={proxyUrl}
                    onLoad={handleIframeLoad}
                    className="w-full h-full border-0"
                    title="Element Selection Preview"
                  />
                  {/* Selection overlay - only show when selection mode is active */}
                  {isSelectionMode && (
                    <div
                      className="absolute inset-0 z-10 cursor-crosshair"
                      onMouseMove={handleOverlayMouseMove}
                      onClick={handleOverlayClick}
                      onMouseLeave={handleOverlayMouseLeave}
                      style={{ pointerEvents: 'auto' }}
                    />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-text-muted">Loading preview...</div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-secondary rounded-xl font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleFinish}
              disabled={selectedElements.length === 0}
              className="px-8 py-3 bg-accent-green hover:bg-accent-green/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200"
            >
              Use Selected Elements
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VisualElementSelector;