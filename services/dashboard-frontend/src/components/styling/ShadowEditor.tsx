/**
 * ShadowEditor Component
 *
 * Editor for shadow configuration (x, y, blur, spread, color, inset)
 */

import React, { useCallback } from 'react';
import type { ShadowConfig } from '../../types/styling';
import { DEFAULT_SHADOW } from '../../types/styling';
import ColorPicker from './ColorPicker';

interface ShadowEditorProps {
  value: ShadowConfig;
  onChange: (shadow: ShadowConfig) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const SHADOW_PRESETS: { name: string; shadow: ShadowConfig }[] = [
  {
    name: 'None',
    shadow: {
      enabled: false,
      color: 'rgba(0, 0, 0, 0)',
      x: 0,
      y: 0,
      blur: 0,
      spread: 0,
    },
  },
  {
    name: 'Subtle',
    shadow: {
      enabled: true,
      color: 'rgba(0, 0, 0, 0.1)',
      x: 0,
      y: 1,
      blur: 3,
      spread: 0,
    },
  },
  {
    name: 'Medium',
    shadow: {
      enabled: true,
      color: 'rgba(0, 0, 0, 0.15)',
      x: 0,
      y: 4,
      blur: 6,
      spread: -1,
    },
  },
  {
    name: 'Large',
    shadow: {
      enabled: true,
      color: 'rgba(0, 0, 0, 0.25)',
      x: 0,
      y: 10,
      blur: 15,
      spread: -3,
    },
  },
  {
    name: 'Glow',
    shadow: {
      enabled: true,
      color: 'rgba(59, 130, 246, 0.3)',
      x: 0,
      y: 0,
      blur: 20,
      spread: 0,
    },
  },
  {
    name: 'Inset',
    shadow: {
      enabled: true,
      color: 'rgba(0, 0, 0, 0.2)',
      x: 0,
      y: 2,
      blur: 4,
      spread: 0,
      inset: true,
    },
  },
];

const ShadowEditor: React.FC<ShadowEditorProps> = ({
  value = DEFAULT_SHADOW,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  const shadow: ShadowConfig = {
    enabled: value?.enabled ?? true,
    color: value?.color || 'rgba(0, 0, 0, 0.3)',
    x: value?.x ?? 0,
    y: value?.y ?? 1,
    blur: value?.blur ?? 3,
    spread: value?.spread ?? 0,
    inset: value?.inset ?? false,
  };

  const handleEnabledChange = useCallback(
    (enabled: boolean) => {
      onChange({ ...shadow, enabled });
    },
    [shadow, onChange]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      onChange({ ...shadow, color, enabled: true });
    },
    [shadow, onChange]
  );

  const handleValueChange = useCallback(
    (field: keyof ShadowConfig, fieldValue: number | boolean) => {
      onChange({ ...shadow, [field]: fieldValue, enabled: true });
    },
    [shadow, onChange]
  );

  const applyPreset = useCallback(
    (preset: ShadowConfig) => {
      onChange(preset);
    },
    [onChange]
  );

  const getShadowCSS = (s: ShadowConfig): string => {
    if (!s.enabled) return 'none';
    const inset = s.inset ? 'inset ' : '';
    return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-3">
          {label}
        </label>
      )}

      {/* Enable toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={shadow.enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            className="rounded border-border-subtle"
            disabled={disabled}
          />
          <span className="text-sm text-text-secondary">Enable shadow</span>
        </label>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Presets
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SHADOW_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.shadow)}
              disabled={disabled}
              className={`
                px-3 py-2 text-xs rounded-lg transition-colors
                bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {shadow.enabled && (
        <>
          {/* Shadow color */}
          <div className="mb-4">
            <ColorPicker
              value={shadow.color}
              onChange={handleColorChange}
              label="Shadow Color"
              showOpacity
              disabled={disabled}
            />
          </div>

          {/* X Offset */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              X Offset: {shadow.x}px
            </label>
            <input
              type="range"
              min="-50"
              max="50"
              value={shadow.x}
              onChange={(e) =>
                handleValueChange('x', parseInt(e.target.value, 10))
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          {/* Y Offset */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Y Offset: {shadow.y}px
            </label>
            <input
              type="range"
              min="-50"
              max="50"
              value={shadow.y}
              onChange={(e) =>
                handleValueChange('y', parseInt(e.target.value, 10))
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          {/* Blur */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Blur: {shadow.blur}px
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={shadow.blur}
              onChange={(e) =>
                handleValueChange('blur', parseInt(e.target.value, 10))
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          {/* Spread */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Spread: {shadow.spread}px
            </label>
            <input
              type="range"
              min="-50"
              max="50"
              value={shadow.spread}
              onChange={(e) =>
                handleValueChange('spread', parseInt(e.target.value, 10))
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          {/* Inset toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={shadow.inset}
                onChange={(e) => handleValueChange('inset', e.target.checked)}
                className="rounded border-border-subtle"
                disabled={disabled}
              />
              <span className="text-sm text-text-secondary">Inset shadow</span>
            </label>
          </div>
        </>
      )}

      {/* Preview */}
      <div className="pt-4 border-t border-border-subtle">
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Preview
        </label>
        <div
          className="w-full h-16 bg-surface-secondary rounded-lg"
          style={{ boxShadow: getShadowCSS(shadow) }}
        />
      </div>
    </div>
  );
};

export default ShadowEditor;
