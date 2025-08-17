import React, { useState, useEffect } from "react";
import {
  Settings,
  X,
  Plus,
  Trash2,
  CheckCircle,
  Eye,
  Code,
  Hash,
  Type,
  Link,
} from "lucide-react";

interface DataStructuringSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: DataStructuringConfig) => void;
  initialConfig?: DataStructuringConfig;
  inputData?: any[];
  sourceNodeData?: any[];
}

export interface DataStructuringConfig {
  patterns: RegexPattern[];
  outputFormat: "object" | "array";
  skipEmptyMatches: boolean;
}

interface RegexPattern {
  id: string;
  name: string;
  regex: string;
  flags: string;
  type: "text" | "number" | "url" | "image";
  description?: string;
}

const DataStructuringSetup: React.FC<DataStructuringSetupProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  inputData = [],
  sourceNodeData = [],
}) => {
  const [patterns, setPatterns] = useState<RegexPattern[]>([]);
  const [outputFormat, setOutputFormat] = useState<"object" | "array">(
    "object"
  );
  const [skipEmptyMatches, setSkipEmptyMatches] = useState(true);
  const [testResult, setTestResult] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize with config or default patterns for on3.com data
  useEffect(() => {
    if (initialConfig) {
      setPatterns(initialConfig.patterns);
      setOutputFormat(initialConfig.outputFormat);
      setSkipEmptyMatches(initialConfig.skipEmptyMatches);
    } else {
      // Default patterns for on3.com player data
      setPatterns([
        {
          id: "rank",
          name: "Rank",
          regex: "^(\\d+)\\.",
          flags: "m",
          type: "number",
          description: "Player ranking number",
        },
        {
          id: "position",
          name: "Position",
          regex: "\\}([A-Z]{1,3})([A-Z][a-z])",
          flags: "g",
          type: "text",
          description: "Player position (QB, RB, etc.)",
        },
        {
          id: "name",
          name: "Player Name",
          regex: "([A-Z][a-z]+ [A-Z][a-z]+)(?=\\d{4})",
          flags: "",
          type: "text",
          description: "Player first and last name",
        },
        {
          id: "year",
          name: "Class Year",
          regex: "(\\d{4})/",
          flags: "",
          type: "number",
          description: "Graduation year",
        },
        {
          id: "height_weight",
          name: "Height/Weight",
          regex: "/(\\d-\\d+(?:\\.\\d+)?/\\d+)",
          flags: "",
          type: "text",
          description: "Height and weight info",
        },
        {
          id: "school",
          name: "High School",
          regex: "([A-Z][a-zA-Z\\s]+)\\([^)]+\\)",
          flags: "",
          type: "text",
          description: "High school name",
        },
        {
          id: "location",
          name: "Location",
          regex: "\\(([^)]+)\\)",
          flags: "",
          type: "text",
          description: "City, State",
        },
        {
          id: "rating",
          name: "Composite Rating",
          regex: "\\)(\\d{2}\\.\\d+)",
          flags: "",
          type: "number",
          description: "Composite rating score",
        },
        {
          id: "followers",
          name: "Social Followers",
          regex: "(\\d+(?:\\.\\d+)?K)",
          flags: "g",
          type: "text",
          description: "Social media follower counts",
        },
      ]);
    }
  }, [initialConfig]);

  const addPattern = () => {
    const newPattern: RegexPattern = {
      id: `pattern_${Date.now()}`,
      name: "New Pattern",
      regex: "",
      flags: "",
      type: "text",
    };
    setPatterns([...patterns, newPattern]);
  };

  const updatePattern = (id: string, updates: Partial<RegexPattern>) => {
    setPatterns(patterns.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePattern = (id: string) => {
    setPatterns(patterns.filter((p) => p.id !== id));
  };

  const highlightMatches = (text: string, pattern: RegexPattern) => {
    if (!pattern.regex) return text;

    try {
      const regex = new RegExp(
        pattern.regex,
        pattern.flags + (pattern.flags.includes("g") ? "" : "g")
      );
      return text.replace(
        regex,
        (match) =>
          `<mark style="background-color: yellow; padding: 2px 4px; border-radius: 3px;">${match}</mark>`
      );
    } catch (error) {
      return text;
    }
  };

  const testPatterns = () => {
    const dataToTest = sourceNodeData.length > 0 ? sourceNodeData : inputData;

    if (!dataToTest.length) {
      setTestResult([]);
      return;
    }

    const results = dataToTest.slice(0, 3).map((item) => {
      const text = item.full_text || JSON.stringify(item);
      const extracted: any = {};

      patterns.forEach((pattern) => {
        try {
          const regex = new RegExp(pattern.regex, pattern.flags);
          const matches = text.match(regex);

          if (matches) {
            let value = matches[1] || matches[0]; // Use capture group or full match

            // Type conversion
            if (pattern.type === "number") {
              const num = parseFloat(value);
              value = isNaN(num) ? value : num;
            }

            extracted[pattern.name] = value;
          } else if (!skipEmptyMatches) {
            extracted[pattern.name] = null;
          }
        } catch (error) {
          console.error(`Regex error for pattern ${pattern.name}:`, error);
          extracted[pattern.name] = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
        }
      });

      return { extracted, originalText: text };
    });

    setTestResult(results);
    setShowPreview(true);
  };

  const handleSave = () => {
    const config: DataStructuringConfig = {
      patterns,
      outputFormat,
      skipEmptyMatches,
    };
    onSave(config);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "number":
        return <Hash className="w-4 h-4" />;
      case "url":
        return <Link className="w-4 h-4" />;
      case "image":
        return <Code className="w-4 h-4" />;
      default:
        return <Type className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-xl shadow-xl border border-border-subtle max-w-6xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">
                    Data Structuring Setup
                  </h2>
                  <p className="text-text-secondary">
                    Extract structured data using regex patterns
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
          <div className="flex-1 overflow-hidden flex">
            {/* Left Panel - Pattern Configuration */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary">
                  Settings
                </h3>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="outputFormat"
                      value="object"
                      checked={outputFormat === "object"}
                      onChange={(e) =>
                        setOutputFormat(e.target.value as "object")
                      }
                      className="text-primary"
                    />
                    <span className="text-sm text-text-primary">
                      Object Format
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="outputFormat"
                      value="array"
                      checked={outputFormat === "array"}
                      onChange={(e) =>
                        setOutputFormat(e.target.value as "array")
                      }
                      className="text-primary"
                    />
                    <span className="text-sm text-text-primary">
                      Array Format
                    </span>
                  </label>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={skipEmptyMatches}
                    onChange={(e) => setSkipEmptyMatches(e.target.checked)}
                    className="text-primary"
                  />
                  <span className="text-sm text-text-primary">
                    Skip empty matches
                  </span>
                </label>
              </div>

              {/* Regex Patterns */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-text-primary">
                    Extraction Patterns
                  </h3>
                  <button
                    onClick={addPattern}
                    className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors flex items-center gap-1 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Pattern
                  </button>
                </div>

                <div className="space-y-3">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="p-4 bg-surface rounded-lg border border-border-subtle space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(pattern.type)}
                          <input
                            type="text"
                            value={pattern.name}
                            onChange={(e) =>
                              updatePattern(pattern.id, {
                                name: e.target.value,
                              })
                            }
                            className="font-medium bg-transparent border-b border-transparent hover:border-border-subtle focus:border-primary outline-none"
                            placeholder="Pattern name"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={pattern.type}
                            onChange={(e) =>
                              updatePattern(pattern.id, {
                                type: e.target.value as any,
                              })
                            }
                            className="text-xs bg-surface-secondary border border-border-subtle rounded px-2 py-1"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="url">URL</option>
                            <option value="image">Image</option>
                          </select>
                          <button
                            onClick={() => removePattern(pattern.id)}
                            className="p-1 hover:bg-surface-secondary rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-text-muted" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-text-muted mb-1">
                            Regex Pattern
                          </label>
                          <input
                            type="text"
                            value={pattern.regex}
                            onChange={(e) =>
                              updatePattern(pattern.id, {
                                regex: e.target.value,
                              })
                            }
                            className="w-full bg-surface-secondary border border-border-subtle rounded px-3 py-2 text-sm font-mono"
                            placeholder="Enter regex pattern..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">
                            Flags
                          </label>
                          <input
                            type="text"
                            value={pattern.flags}
                            onChange={(e) =>
                              updatePattern(pattern.id, {
                                flags: e.target.value,
                              })
                            }
                            className="w-full bg-surface-secondary border border-border-subtle rounded px-3 py-2 text-sm font-mono"
                            placeholder="g, i, m..."
                          />
                        </div>
                      </div>

                      {pattern.description && (
                        <p className="text-xs text-text-muted">
                          {pattern.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Button */}
              <div className="flex justify-center">
                <button
                  onClick={testPatterns}
                  disabled={
                    !patterns.length ||
                    (!inputData.length && !sourceNodeData.length)
                  }
                  className="px-6 py-2 bg-accent-green hover:bg-accent-green/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Test Patterns
                  {(sourceNodeData.length > 0 || inputData.length > 0) && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                      {sourceNodeData.length > 0
                        ? `${sourceNodeData.length} from source`
                        : `${inputData.length} items`}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          {showPreview && (
            <div className="w-1/2 border-l border-border-subtle p-6 overflow-y-auto">
              <h3 className="text-lg font-medium text-text-primary mb-4">
                Preview Results
              </h3>

              {testResult.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No matches found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {testResult.map((result, idx) => (
                    <div key={idx} className="space-y-4">
                      <div className="text-sm font-medium text-text-primary border-b border-border-subtle pb-2">
                        Sample {idx + 1}
                      </div>

                      {/* Original Text with Highlighting */}
                      <div className="bg-surface rounded-lg border border-border-subtle p-4">
                        <div className="text-xs text-text-muted mb-2">
                          Original Text (with matches highlighted)
                        </div>
                        <div
                          className="text-sm text-text-primary leading-relaxed max-h-32 overflow-y-auto"
                          dangerouslySetInnerHTML={{
                            __html: patterns.reduce(
                              (text, pattern) =>
                                highlightMatches(text, pattern),
                              result.originalText
                            ),
                          }}
                        />
                      </div>

                      {/* Extracted Data */}
                      <div className="bg-surface rounded-lg border border-border-subtle p-4">
                        <div className="text-xs text-text-muted mb-2">
                          Extracted Data
                        </div>
                        <pre className="text-sm text-text-primary whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(result.extracted, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-2 text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!patterns.length}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DataStructuringSetup;
