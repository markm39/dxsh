/**
 * DashboardStyleEditor Component
 *
 * Comprehensive editor for dashboard-level styling
 */

import React, { useState, useCallback } from 'react';
import {
  Palette,
  Layout,
  Type,
  Paintbrush,
  BarChart3,
  Wand2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import type { DashboardStyles } from '../../types/styling';
import { DEFAULT_DASHBOARD_STYLES, DEFAULT_CHART_COLORS } from '../../types/styling';
import { PRESET_THEMES, PresetTheme } from '../../themes/presetThemes';
import BackgroundEditor from './BackgroundEditor';
import SpacingEditor from './SpacingEditor';
import TypographyEditor from './TypographyEditor';
import ColorPicker from './ColorPicker';

interface DashboardStyleEditorProps {
  value: DashboardStyles;
  onChange: (styles: DashboardStyles) => void;
  disabled?: boolean;
  className?: string;
}

type EditorSection =
  | 'themes'
  | 'background'
  | 'grid'
  | 'typography'
  | 'colors'
  | 'chartColors'
  | 'widgetDefaults';

const DashboardStyleEditor: React.FC<DashboardStyleEditorProps> = ({
  value = DEFAULT_DASHBOARD_STYLES,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<EditorSection>>(
    new Set(['themes'])
  );

  const styles: DashboardStyles = {
    ...DEFAULT_DASHBOARD_STYLES,
    ...value,
    colorPalette: { ...DEFAULT_DASHBOARD_STYLES.colorPalette, ...value?.colorPalette },
    typography: {
      headings: { ...DEFAULT_DASHBOARD_STYLES.typography.headings, ...value?.typography?.headings },
      body: { ...DEFAULT_DASHBOARD_STYLES.typography.body, ...value?.typography?.body },
      labels: { ...DEFAULT_DASHBOARD_STYLES.typography.labels, ...value?.typography?.labels },
    },
    grid: { ...DEFAULT_DASHBOARD_STYLES.grid, ...value?.grid },
    widgetDefaults: { ...DEFAULT_DASHBOARD_STYLES.widgetDefaults, ...value?.widgetDefaults },
  };

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
    <K extends keyof DashboardStyles>(field: K, fieldValue: DashboardStyles[K]) => {
      onChange({ ...styles, [field]: fieldValue });
    },
    [styles, onChange]
  );

  const applyTheme = useCallback(
    (theme: PresetTheme) => {
      onChange(theme.styles);
    },
    [onChange]
  );

  const resetToDefault = useCallback(() => {
    if (confirm('Reset all styles to default?')) {
      onChange(DEFAULT_DASHBOARD_STYLES);
    }
  }, [onChange]);

  const handleColorPaletteChange = useCallback(
    (colorKey: keyof DashboardStyles['colorPalette'], color: string) => {
      handleChange('colorPalette', { ...styles.colorPalette, [colorKey]: color });
    },
    [styles.colorPalette, handleChange]
  );

  const handleChartColorChange = useCallback(
    (index: number, color: string) => {
      const newColors = [...styles.chartColors];
      newColors[index] = color;
      handleChange('chartColors', newColors);
    },
    [styles.chartColors, handleChange]
  );

  const handleTypographyChange = useCallback(
    (key: keyof DashboardStyles['typography'], typo: DashboardStyles['typography'][typeof key]) => {
      handleChange('typography', { ...styles.typography, [key]: typo });
    },
    [styles.typography, handleChange]
  );

  const SectionHeader: React.FC<{
    section: EditorSection;
    icon: typeof Palette;
    title: string;
  }> = ({ section, icon: Icon, title }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 hover:bg-surface-secondary/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-primary" />
        <span className="font-medium text-text-primary">{title}</span>
      </div>
      {expandedSections.has(section) ? (
        <ChevronUp className="w-5 h-5 text-text-muted" />
      ) : (
        <ChevronDown className="w-5 h-5 text-text-muted" />
      )}
    </button>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Reset button */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={resetToDefault}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-secondary rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Default
        </button>
      </div>

      {/* Preset Themes */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader section="themes" icon={Wand2} title="Preset Themes" />
        {expandedSections.has('themes') && (
          <div className="p-4 border-t border-border-subtle">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {PRESET_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => applyTheme(theme)}
                  disabled={disabled}
                  className={`
                    group relative p-3 rounded-lg border transition-all text-left
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary cursor-pointer'}
                    border-border-subtle hover:shadow-lg
                  `}
                >
                  {/* Theme preview */}
                  <div
                    className="w-full h-12 rounded mb-2 border border-border-subtle"
                    style={{
                      background:
                        theme.styles.background.type === 'gradient' && theme.styles.background.gradient
                          ? `linear-gradient(${theme.styles.background.gradient.angle || 180}deg, ${theme.styles.background.gradient.stops.map((s) => `${s.color} ${s.position}%`).join(', ')})`
                          : theme.styles.background.color || '#000',
                    }}
                  >
                    {/* Mini widget preview */}
                    <div className="p-1 h-full flex items-center justify-center">
                      <div
                        className="w-10 h-6 rounded"
                        style={{
                          backgroundColor:
                            theme.styles.widgetDefaults.background.color || '#1a1a1a',
                          border: `1px solid ${theme.styles.widgetDefaults.border.color}`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-sm font-medium text-text-primary truncate">
                    {theme.name}
                  </div>
                  <div className="text-2xs text-text-muted capitalize">
                    {theme.category}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader section="background" icon={Paintbrush} title="Background" />
        {expandedSections.has('background') && (
          <div className="p-4 border-t border-border-subtle">
            <BackgroundEditor
              value={styles.background}
              onChange={(bg) => handleChange('background', bg)}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Grid Layout */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader section="grid" icon={Layout} title="Grid Layout" />
        {expandedSections.has('grid') && (
          <div className="p-4 border-t border-border-subtle space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Grid Gap: {styles.grid.gap}px
              </label>
              <input
                type="range"
                min="0"
                max="48"
                value={styles.grid.gap}
                onChange={(e) =>
                  handleChange('grid', {
                    ...styles.grid,
                    gap: parseInt(e.target.value, 10),
                  })
                }
                className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                disabled={disabled}
              />
            </div>

            <SpacingEditor
              value={styles.grid.padding}
              onChange={(padding) =>
                handleChange('grid', { ...styles.grid, padding })
              }
              label="Grid Padding"
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Typography */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader section="typography" icon={Type} title="Typography" />
        {expandedSections.has('typography') && (
          <div className="p-4 border-t border-border-subtle space-y-6">
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3">Headings</h4>
              <TypographyEditor
                value={styles.typography.headings}
                onChange={(typo) => handleTypographyChange('headings', typo)}
                disabled={disabled}
              />
            </div>

            <div className="pt-4 border-t border-border-subtle">
              <h4 className="text-sm font-medium text-text-primary mb-3">Body Text</h4>
              <TypographyEditor
                value={styles.typography.body}
                onChange={(typo) => handleTypographyChange('body', typo)}
                disabled={disabled}
              />
            </div>

            <div className="pt-4 border-t border-border-subtle">
              <h4 className="text-sm font-medium text-text-primary mb-3">Labels</h4>
              <TypographyEditor
                value={styles.typography.labels}
                onChange={(typo) => handleTypographyChange('labels', typo)}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Color Palette */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader section="colors" icon={Palette} title="Color Palette" />
        {expandedSections.has('colors') && (
          <div className="p-4 border-t border-border-subtle">
            <div className="grid grid-cols-2 gap-4">
              {(
                Object.keys(styles.colorPalette) as Array<
                  keyof DashboardStyles['colorPalette']
                >
              ).map((colorKey) => (
                <ColorPicker
                  key={colorKey}
                  value={styles.colorPalette[colorKey]}
                  onChange={(color) => handleColorPaletteChange(colorKey, color)}
                  label={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart Colors */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader section="chartColors" icon={BarChart3} title="Chart Colors" />
        {expandedSections.has('chartColors') && (
          <div className="p-4 border-t border-border-subtle">
            <p className="text-xs text-text-secondary mb-4">
              Define the color sequence used in charts and visualizations.
            </p>
            <div className="grid grid-cols-5 gap-3">
              {styles.chartColors.map((color, index) => (
                <div key={index} className="text-center">
                  <ColorPicker
                    value={color}
                    onChange={(c) => handleChartColorChange(index, c)}
                    disabled={disabled}
                  />
                  <span className="text-2xs text-text-muted mt-1 block">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  handleChange('chartColors', [...styles.chartColors, '#808080'])
                }
                disabled={disabled || styles.chartColors.length >= 20}
                className="px-3 py-1.5 text-sm bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70 rounded-lg transition-colors disabled:opacity-50"
              >
                Add Color
              </button>
              <button
                type="button"
                onClick={() =>
                  handleChange('chartColors', styles.chartColors.slice(0, -1))
                }
                disabled={disabled || styles.chartColors.length <= 2}
                className="px-3 py-1.5 text-sm bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70 rounded-lg transition-colors disabled:opacity-50"
              >
                Remove Last
              </button>
              <button
                type="button"
                onClick={() => handleChange('chartColors', DEFAULT_CHART_COLORS)}
                disabled={disabled}
                className="px-3 py-1.5 text-sm bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70 rounded-lg transition-colors"
              >
                Reset Colors
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardStyleEditor;
