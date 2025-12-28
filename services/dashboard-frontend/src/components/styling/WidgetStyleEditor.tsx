/**
 * WidgetStyleEditor Component
 *
 * Editor for widget-level styling that overrides dashboard defaults
 */

import React, { useState, useCallback } from 'react';
import {
  Paintbrush,
  Square,
  Layers,
  Box,
  Type,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BarChart3,
  Hash,
  FileText,
} from 'lucide-react';
import type { WidgetStyles, ChartStyleConfig, MetricStyleConfig, TextStyleConfig } from '../../types/styling';
import { DEFAULT_WIDGET_STYLES, DEFAULT_CHART_COLORS } from '../../types/styling';
import BackgroundEditor from './BackgroundEditor';
import BorderEditor from './BorderEditor';
import ShadowEditor from './ShadowEditor';
import SpacingEditor from './SpacingEditor';
import TypographyEditor from './TypographyEditor';
import ColorPicker from './ColorPicker';

interface WidgetStyleEditorProps {
  value: WidgetStyles;
  onChange: (styles: WidgetStyles) => void;
  widgetType?: 'chart' | 'metric' | 'text' | 'model';
  disabled?: boolean;
  className?: string;
}

type EditorSection =
  | 'background'
  | 'border'
  | 'shadow'
  | 'padding'
  | 'header'
  | 'content'
  | 'hover'
  | 'chartStyles'
  | 'metricStyles'
  | 'textStyles';

const WidgetStyleEditor: React.FC<WidgetStyleEditorProps> = ({
  value = DEFAULT_WIDGET_STYLES,
  onChange,
  widgetType,
  disabled = false,
  className = '',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<EditorSection>>(
    new Set(['background'])
  );

  const styles: WidgetStyles = { ...value };

  const toggleSection = useCallback((section: EditorSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const handleChange = useCallback(
    <K extends keyof WidgetStyles>(field: K, fieldValue: WidgetStyles[K]) => {
      onChange({ ...styles, [field]: fieldValue });
    },
    [styles, onChange]
  );

  const resetStyles = useCallback(() => {
    if (confirm('Reset widget styles to default?')) {
      onChange({});
    }
  }, [onChange]);

  const SectionHeader: React.FC<{
    section: EditorSection;
    icon: typeof Paintbrush;
    title: string;
  }> = ({ section, icon: Icon, title }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 hover:bg-surface-secondary/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-text-primary">{title}</span>
      </div>
      {expandedSections.has(section) ? (
        <ChevronUp className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      )}
    </button>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Reset button */}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={resetStyles}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary rounded transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Background */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="background" icon={Paintbrush} title="Background" />
        {expandedSections.has('background') && (
          <div className="p-3 border-t border-border-subtle">
            <BackgroundEditor
              value={styles.background || { type: 'solid', color: '#1a1b1c' }}
              onChange={(bg) => handleChange('background', bg)}
              showImage={false}
              showPattern={false}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Border */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="border" icon={Square} title="Border" />
        {expandedSections.has('border') && (
          <div className="p-3 border-t border-border-subtle">
            <BorderEditor
              value={
                styles.border || {
                  width: 1,
                  style: 'solid',
                  color: '#2a2a2a',
                  radius: 8,
                }
              }
              onChange={(border) => handleChange('border', border)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Shadow */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="shadow" icon={Layers} title="Shadow" />
        {expandedSections.has('shadow') && (
          <div className="p-3 border-t border-border-subtle">
            <ShadowEditor
              value={
                styles.shadow || {
                  enabled: true,
                  color: 'rgba(0, 0, 0, 0.3)',
                  x: 0,
                  y: 1,
                  blur: 3,
                  spread: 0,
                }
              }
              onChange={(shadow) => handleChange('shadow', shadow)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Padding */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="padding" icon={Box} title="Padding" />
        {expandedSections.has('padding') && (
          <div className="p-3 border-t border-border-subtle">
            <SpacingEditor
              value={
                styles.padding || {
                  top: 16,
                  right: 16,
                  bottom: 16,
                  left: 16,
                }
              }
              onChange={(padding) => handleChange('padding', padding)}
              disabled={disabled}
              max={64}
            />
          </div>
        )}
      </div>

      {/* Header Styling */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="header" icon={Type} title="Header" />
        {expandedSections.has('header') && (
          <div className="p-3 border-t border-border-subtle space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={styles.header?.visible !== false}
                onChange={(e) =>
                  handleChange('header', {
                    ...styles.header,
                    visible: e.target.checked,
                  })
                }
                className="rounded border-border-subtle"
                disabled={disabled}
              />
              <span className="text-sm text-text-secondary">Show header</span>
            </label>

            {styles.header?.visible !== false && (
              <>
                <BackgroundEditor
                  value={
                    styles.header?.background || {
                      type: 'solid',
                      color: 'transparent',
                    }
                  }
                  onChange={(bg) =>
                    handleChange('header', { ...styles.header, background: bg })
                  }
                  label="Header Background"
                  showImage={false}
                  showPattern={false}
                  disabled={disabled}
                />

                <SpacingEditor
                  value={
                    styles.header?.padding || {
                      top: 12,
                      right: 16,
                      bottom: 12,
                      left: 16,
                    }
                  }
                  onChange={(padding) =>
                    handleChange('header', { ...styles.header, padding })
                  }
                  label="Header Padding"
                  disabled={disabled}
                  max={32}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="content" icon={Box} title="Content Area" />
        {expandedSections.has('content') && (
          <div className="p-3 border-t border-border-subtle space-y-4">
            <BackgroundEditor
              value={
                styles.content?.background || {
                  type: 'solid',
                  color: 'transparent',
                }
              }
              onChange={(bg) =>
                handleChange('content', { ...styles.content, background: bg })
              }
              label="Content Background"
              showImage={false}
              showPattern={false}
              disabled={disabled}
            />

            <SpacingEditor
              value={
                styles.content?.padding || {
                  top: 16,
                  right: 16,
                  bottom: 16,
                  left: 16,
                }
              }
              onChange={(padding) =>
                handleChange('content', { ...styles.content, padding })
              }
              label="Content Padding"
              disabled={disabled}
              max={48}
            />
          </div>
        )}
      </div>

      {/* Hover Effects */}
      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <SectionHeader section="hover" icon={MousePointerClick} title="Hover Effects" />
        {expandedSections.has('hover') && (
          <div className="p-3 border-t border-border-subtle space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Scale on Hover: {styles.hover?.scale || 1}x
              </label>
              <input
                type="range"
                min="1"
                max="1.1"
                step="0.01"
                value={styles.hover?.scale || 1}
                onChange={(e) =>
                  handleChange('hover', {
                    ...styles.hover,
                    scale: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                disabled={disabled}
              />
            </div>

            <BackgroundEditor
              value={
                styles.hover?.background || { type: 'solid', color: 'transparent' }
              }
              onChange={(bg) =>
                handleChange('hover', { ...styles.hover, background: bg })
              }
              label="Hover Background"
              showImage={false}
              showPattern={false}
              disabled={disabled}
            />

            <ShadowEditor
              value={
                styles.hover?.shadow || {
                  enabled: false,
                  color: 'rgba(0, 0, 0, 0)',
                  x: 0,
                  y: 0,
                  blur: 0,
                  spread: 0,
                }
              }
              onChange={(shadow) =>
                handleChange('hover', { ...styles.hover, shadow })
              }
              label="Hover Shadow"
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Chart-specific styles */}
      {widgetType === 'chart' && (
        <div className="border border-border-subtle rounded-lg overflow-hidden">
          <SectionHeader section="chartStyles" icon={BarChart3} title="Chart Styling" />
          {expandedSections.has('chartStyles') && (
            <div className="p-3 border-t border-border-subtle space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  Chart Colors
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(styles.chart?.colors || DEFAULT_CHART_COLORS.slice(0, 5)).map(
                    (color, index) => (
                      <ColorPicker
                        key={index}
                        value={color}
                        onChange={(c) => {
                          const newColors = [
                            ...(styles.chart?.colors || DEFAULT_CHART_COLORS),
                          ];
                          newColors[index] = c;
                          handleChange('chart', {
                            ...styles.chart,
                            colors: newColors,
                          } as ChartStyleConfig);
                        }}
                        disabled={disabled}
                      />
                    )
                  )}
                </div>
              </div>

              <ColorPicker
                value={styles.chart?.gridColor || '#2a2a2a'}
                onChange={(c) =>
                  handleChange('chart', {
                    ...styles.chart,
                    gridColor: c,
                  } as ChartStyleConfig)
                }
                label="Grid Color"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.chart?.axisColor || '#4a4a4a'}
                onChange={(c) =>
                  handleChange('chart', {
                    ...styles.chart,
                    axisColor: c,
                  } as ChartStyleConfig)
                }
                label="Axis Color"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.chart?.tooltipBackground || '#1a1a1a'}
                onChange={(c) =>
                  handleChange('chart', {
                    ...styles.chart,
                    tooltipBackground: c,
                  } as ChartStyleConfig)
                }
                label="Tooltip Background"
                disabled={disabled}
              />

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Stroke Width: {styles.chart?.strokeWidth || 2}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={styles.chart?.strokeWidth || 2}
                  onChange={(e) =>
                    handleChange('chart', {
                      ...styles.chart,
                      strokeWidth: parseInt(e.target.value, 10),
                    } as ChartStyleConfig)
                  }
                  className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Fill Opacity: {Math.round((styles.chart?.fillOpacity || 0.3) * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(styles.chart?.fillOpacity || 0.3) * 100}
                  onChange={(e) =>
                    handleChange('chart', {
                      ...styles.chart,
                      fillOpacity: parseInt(e.target.value, 10) / 100,
                    } as ChartStyleConfig)
                  }
                  className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metric-specific styles */}
      {widgetType === 'metric' && (
        <div className="border border-border-subtle rounded-lg overflow-hidden">
          <SectionHeader section="metricStyles" icon={Hash} title="Metric Styling" />
          {expandedSections.has('metricStyles') && (
            <div className="p-3 border-t border-border-subtle space-y-4">
              <ColorPicker
                value={styles.metric?.valueColor || '#ffffff'}
                onChange={(c) =>
                  handleChange('metric', {
                    ...styles.metric,
                    valueColor: c,
                  } as MetricStyleConfig)
                }
                label="Value Color"
                disabled={disabled}
              />

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Value Size: {styles.metric?.valueSize || 36}px
                </label>
                <input
                  type="range"
                  min="16"
                  max="96"
                  value={styles.metric?.valueSize || 36}
                  onChange={(e) =>
                    handleChange('metric', {
                      ...styles.metric,
                      valueSize: parseInt(e.target.value, 10),
                    } as MetricStyleConfig)
                  }
                  className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                  disabled={disabled}
                />
              </div>

              <ColorPicker
                value={styles.metric?.labelColor || '#94a3b8'}
                onChange={(c) =>
                  handleChange('metric', {
                    ...styles.metric,
                    labelColor: c,
                  } as MetricStyleConfig)
                }
                label="Label Color"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.metric?.trendUpColor || '#22c55e'}
                onChange={(c) =>
                  handleChange('metric', {
                    ...styles.metric,
                    trendUpColor: c,
                  } as MetricStyleConfig)
                }
                label="Trend Up Color"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.metric?.trendDownColor || '#ef4444'}
                onChange={(c) =>
                  handleChange('metric', {
                    ...styles.metric,
                    trendDownColor: c,
                  } as MetricStyleConfig)
                }
                label="Trend Down Color"
                disabled={disabled}
              />

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Layout
                </label>
                <div className="flex gap-2">
                  {(['vertical', 'horizontal', 'compact'] as const).map((layout) => (
                    <button
                      key={layout}
                      type="button"
                      onClick={() =>
                        handleChange('metric', {
                          ...styles.metric,
                          layout,
                        } as MetricStyleConfig)
                      }
                      disabled={disabled}
                      className={`
                        px-3 py-1.5 text-xs rounded-lg capitalize transition-colors
                        ${
                          styles.metric?.layout === layout
                            ? 'bg-primary text-white'
                            : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
                        }
                      `}
                    >
                      {layout}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text-specific styles */}
      {widgetType === 'text' && (
        <div className="border border-border-subtle rounded-lg overflow-hidden">
          <SectionHeader section="textStyles" icon={FileText} title="Text Styling" />
          {expandedSections.has('textStyles') && (
            <div className="p-3 border-t border-border-subtle space-y-4">
              <TypographyEditor
                value={
                  styles.text?.typography || {
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 14,
                    fontWeight: 400,
                    lineHeight: 1.6,
                    letterSpacing: 0,
                  }
                }
                onChange={(typo) =>
                  handleChange('text', {
                    ...styles.text,
                    typography: typo,
                  } as TextStyleConfig)
                }
                label="Text Typography"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.text?.linkColor || '#3b82f6'}
                onChange={(c) =>
                  handleChange('text', {
                    ...styles.text,
                    linkColor: c,
                  } as TextStyleConfig)
                }
                label="Link Color"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.text?.codeBackground || '#1e1e1e'}
                onChange={(c) =>
                  handleChange('text', {
                    ...styles.text,
                    codeBackground: c,
                  } as TextStyleConfig)
                }
                label="Code Background"
                disabled={disabled}
              />

              <ColorPicker
                value={styles.text?.codeTextColor || '#e2e8f0'}
                onChange={(c) =>
                  handleChange('text', {
                    ...styles.text,
                    codeTextColor: c,
                  } as TextStyleConfig)
                }
                label="Code Text Color"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WidgetStyleEditor;
