/**
 * TypographyEditor Component
 *
 * Editor for typography configuration (font, size, weight, line height, etc.)
 */

import React, { useCallback } from 'react';
import type { TypographyConfig } from '../../types/styling';
import { DEFAULT_TYPOGRAPHY } from '../../types/styling';
import ColorPicker from './ColorPicker';
import FontSelector from './FontSelector';

interface TypographyEditorProps {
  value: TypographyConfig;
  onChange: (typography: TypographyConfig) => void;
  label?: string;
  showColor?: boolean;
  disabled?: boolean;
  className?: string;
}

const FONT_WEIGHTS: { value: TypographyConfig['fontWeight']; label: string }[] = [
  { value: 100, label: 'Thin' },
  { value: 200, label: 'Extra Light' },
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semi Bold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra Bold' },
  { value: 900, label: 'Black' },
];

const TEXT_TRANSFORMS: { value: TypographyConfig['textTransform']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPER' },
  { value: 'lowercase', label: 'lower' },
  { value: 'capitalize', label: 'Capital' },
];

const TypographyEditor: React.FC<TypographyEditorProps> = ({
  value = DEFAULT_TYPOGRAPHY,
  onChange,
  label,
  showColor = true,
  disabled = false,
  className = '',
}) => {
  const typography: TypographyConfig = {
    fontFamily: value?.fontFamily || 'Inter, system-ui, sans-serif',
    fontSize: value?.fontSize ?? 14,
    fontWeight: value?.fontWeight ?? 400,
    lineHeight: value?.lineHeight ?? 1.5,
    letterSpacing: value?.letterSpacing ?? 0,
    textTransform: value?.textTransform,
    color: value?.color,
  };

  const handleChange = useCallback(
    <K extends keyof TypographyConfig>(field: K, fieldValue: TypographyConfig[K]) => {
      onChange({ ...typography, [field]: fieldValue });
    },
    [typography, onChange]
  );

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-3">
          {label}
        </label>
      )}

      {/* Font family */}
      <div className="mb-4">
        <FontSelector
          value={typography.fontFamily}
          onChange={(font) => handleChange('fontFamily', font)}
          label="Font Family"
          disabled={disabled}
        />
      </div>

      {/* Font size */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Font Size: {typography.fontSize}px
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="8"
            max="72"
            value={typography.fontSize}
            onChange={(e) =>
              handleChange('fontSize', parseInt(e.target.value, 10))
            }
            className="flex-1 h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
            disabled={disabled}
          />
          <input
            type="number"
            min="8"
            max="200"
            value={typography.fontSize}
            onChange={(e) =>
              handleChange('fontSize', parseInt(e.target.value, 10) || 14)
            }
            className="w-16 px-2 py-1 text-sm bg-surface-secondary border border-border-subtle rounded text-text-primary focus:border-primary focus:outline-none"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Font weight */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Font Weight
        </label>
        <select
          value={typography.fontWeight}
          onChange={(e) =>
            handleChange(
              'fontWeight',
              parseInt(e.target.value, 10) as TypographyConfig['fontWeight']
            )
          }
          className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary focus:border-primary focus:outline-none"
          disabled={disabled}
        >
          {FONT_WEIGHTS.map(({ value: weightValue, label: weightLabel }) => (
            <option key={weightValue} value={weightValue}>
              {weightValue} - {weightLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Line height */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Line Height: {typography.lineHeight}
        </label>
        <input
          type="range"
          min="0.8"
          max="3"
          step="0.1"
          value={typography.lineHeight}
          onChange={(e) =>
            handleChange('lineHeight', parseFloat(e.target.value))
          }
          className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Letter spacing */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Letter Spacing: {typography.letterSpacing}em
        </label>
        <input
          type="range"
          min="-0.1"
          max="0.5"
          step="0.01"
          value={typography.letterSpacing}
          onChange={(e) =>
            handleChange('letterSpacing', parseFloat(e.target.value))
          }
          className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
          disabled={disabled}
        />
      </div>

      {/* Text transform */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Text Transform
        </label>
        <div className="flex gap-2">
          {TEXT_TRANSFORMS.map(({ value: transformValue, label: transformLabel }) => (
            <button
              key={transformValue || 'none'}
              type="button"
              onClick={() => handleChange('textTransform', transformValue)}
              disabled={disabled}
              className={`
                px-3 py-1.5 text-sm rounded-lg transition-colors
                ${
                  typography.textTransform === transformValue
                    ? 'bg-primary text-white'
                    : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {transformLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      {showColor && (
        <div className="mb-4">
          <ColorPicker
            value={typography.color || '#e2e8f0'}
            onChange={(color) => handleChange('color', color)}
            label="Text Color"
            disabled={disabled}
          />
        </div>
      )}

      {/* Preview */}
      <div className="pt-4 border-t border-border-subtle">
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Preview
        </label>
        <div
          className="p-4 bg-surface-secondary rounded-lg"
          style={{
            fontFamily: typography.fontFamily,
            fontSize: `${typography.fontSize}px`,
            fontWeight: typography.fontWeight,
            lineHeight: typography.lineHeight,
            letterSpacing: `${typography.letterSpacing}em`,
            textTransform: typography.textTransform,
            color: typography.color || 'inherit',
          }}
        >
          The quick brown fox jumps over the lazy dog.
          <br />
          0123456789
        </div>
      </div>
    </div>
  );
};

export default TypographyEditor;
