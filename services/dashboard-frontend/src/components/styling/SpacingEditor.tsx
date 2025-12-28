/**
 * SpacingEditor Component
 *
 * Editor for spacing configuration (padding/margin with individual sides)
 */

import React, { useCallback, useState } from 'react';
import { Link, Unlink } from 'lucide-react';
import type { SpacingConfig } from '../../types/styling';
import { DEFAULT_SPACING } from '../../types/styling';

interface SpacingEditorProps {
  value: SpacingConfig;
  onChange: (spacing: SpacingConfig) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  max?: number;
}

const SPACING_PRESETS: { name: string; value: SpacingConfig }[] = [
  { name: 'None', value: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'XS', value: { top: 4, right: 4, bottom: 4, left: 4 } },
  { name: 'S', value: { top: 8, right: 8, bottom: 8, left: 8 } },
  { name: 'M', value: { top: 16, right: 16, bottom: 16, left: 16 } },
  { name: 'L', value: { top: 24, right: 24, bottom: 24, left: 24 } },
  { name: 'XL', value: { top: 32, right: 32, bottom: 32, left: 32 } },
];

const SpacingEditor: React.FC<SpacingEditorProps> = ({
  value = DEFAULT_SPACING,
  onChange,
  label,
  disabled = false,
  className = '',
  max = 100,
}) => {
  const spacing: SpacingConfig = {
    top: value?.top ?? 16,
    right: value?.right ?? 16,
    bottom: value?.bottom ?? 16,
    left: value?.left ?? 16,
  };

  const isLinked =
    spacing.top === spacing.right &&
    spacing.right === spacing.bottom &&
    spacing.bottom === spacing.left;

  const [linked, setLinked] = useState(isLinked);

  const handleChange = useCallback(
    (side: keyof SpacingConfig, sideValue: number) => {
      if (linked) {
        // Apply to all sides
        onChange({
          top: sideValue,
          right: sideValue,
          bottom: sideValue,
          left: sideValue,
        });
      } else {
        onChange({ ...spacing, [side]: sideValue });
      }
    },
    [linked, spacing, onChange]
  );

  const toggleLinked = useCallback(() => {
    if (!linked) {
      // Link - use average value
      const avg = Math.round(
        (spacing.top + spacing.right + spacing.bottom + spacing.left) / 4
      );
      onChange({ top: avg, right: avg, bottom: avg, left: avg });
    }
    setLinked(!linked);
  }, [linked, spacing, onChange]);

  const applyPreset = useCallback(
    (preset: SpacingConfig) => {
      onChange(preset);
    },
    [onChange]
  );

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-3">
          {label}
        </label>
      )}

      {/* Presets */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {SPACING_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.value)}
              disabled={disabled}
              className={`
                px-3 py-1.5 text-xs rounded-lg transition-colors
                ${
                  spacing.top === preset.value.top &&
                  spacing.right === preset.value.right &&
                  spacing.bottom === preset.value.bottom &&
                  spacing.left === preset.value.left
                    ? 'bg-primary text-white'
                    : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Link toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-text-secondary">
          {linked ? 'All sides linked' : 'Individual sides'}
        </span>
        <button
          type="button"
          onClick={toggleLinked}
          disabled={disabled}
          className={`
            p-1.5 rounded-lg transition-colors
            ${linked ? 'bg-primary/20 text-primary' : 'bg-surface-secondary text-text-muted'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-secondary/70'}
          `}
          title={linked ? 'Unlink sides' : 'Link sides'}
        >
          {linked ? <Link className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
        </button>
      </div>

      {/* Spacing inputs */}
      {linked ? (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            All Sides: {spacing.top}px
          </label>
          <input
            type="range"
            min="0"
            max={max}
            value={spacing.top}
            onChange={(e) => handleChange('top', parseInt(e.target.value, 10))}
            className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visual representation */}
          <div className="relative w-full aspect-square max-w-[160px] mx-auto">
            {/* Center box */}
            <div className="absolute inset-8 bg-surface-secondary rounded border border-border-subtle" />

            {/* Top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span className="text-2xs text-text-muted mb-1">Top</span>
              <input
                type="number"
                min="0"
                max={max}
                value={spacing.top}
                onChange={(e) =>
                  handleChange('top', parseInt(e.target.value, 10) || 0)
                }
                className="w-12 px-1 py-0.5 text-xs text-center bg-surface-secondary border border-border-subtle rounded text-text-primary focus:border-primary focus:outline-none"
                disabled={disabled}
              />
            </div>

            {/* Right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
              <input
                type="number"
                min="0"
                max={max}
                value={spacing.right}
                onChange={(e) =>
                  handleChange('right', parseInt(e.target.value, 10) || 0)
                }
                className="w-12 px-1 py-0.5 text-xs text-center bg-surface-secondary border border-border-subtle rounded text-text-primary focus:border-primary focus:outline-none"
                disabled={disabled}
              />
              <span className="text-2xs text-text-muted ml-1">Right</span>
            </div>

            {/* Bottom */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <input
                type="number"
                min="0"
                max={max}
                value={spacing.bottom}
                onChange={(e) =>
                  handleChange('bottom', parseInt(e.target.value, 10) || 0)
                }
                className="w-12 px-1 py-0.5 text-xs text-center bg-surface-secondary border border-border-subtle rounded text-text-primary focus:border-primary focus:outline-none"
                disabled={disabled}
              />
              <span className="text-2xs text-text-muted mt-1">Bottom</span>
            </div>

            {/* Left */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center">
              <span className="text-2xs text-text-muted mr-1">Left</span>
              <input
                type="number"
                min="0"
                max={max}
                value={spacing.left}
                onChange={(e) =>
                  handleChange('left', parseInt(e.target.value, 10) || 0)
                }
                className="w-12 px-1 py-0.5 text-xs text-center bg-surface-secondary border border-border-subtle rounded text-text-primary focus:border-primary focus:outline-none"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Slider controls */}
          <div className="grid grid-cols-2 gap-3">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <div key={side}>
                <label className="block text-2xs text-text-muted mb-1 capitalize">
                  {side}: {spacing[side]}px
                </label>
                <input
                  type="range"
                  min="0"
                  max={max}
                  value={spacing[side]}
                  onChange={(e) =>
                    handleChange(side, parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpacingEditor;
