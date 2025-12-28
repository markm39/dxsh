/**
 * ColorPicker Component
 *
 * A comprehensive color picker with hex input, presets, and opacity support
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pipette, Check, X } from 'lucide-react';
import { parseColor, rgbToHex, hexToRgba } from '../../utils/styleUtils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  showOpacity?: boolean;
  presets?: string[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_PRESETS = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#64748b',
];

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  showOpacity = false,
  presets = DEFAULT_PRESETS,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [opacity, setOpacity] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse initial value
  useEffect(() => {
    const parsed = parseColor(value);
    if (parsed) {
      setHexInput(rgbToHex(parsed.r, parsed.g, parsed.b));
      setOpacity(Math.round(parsed.a * 100));
    } else {
      setHexInput(value);
    }
  }, [value]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let hex = e.target.value;
      setHexInput(hex);

      // Add # if not present
      if (hex && !hex.startsWith('#')) {
        hex = '#' + hex;
      }

      // Validate and update
      if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
        if (showOpacity && opacity < 100) {
          onChange(hexToRgba(hex, opacity / 100));
        } else {
          onChange(hex);
        }
      }
    },
    [onChange, showOpacity, opacity]
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newOpacity = parseInt(e.target.value, 10);
      setOpacity(newOpacity);

      if (showOpacity) {
        onChange(hexToRgba(hexInput, newOpacity / 100));
      }
    },
    [onChange, showOpacity, hexInput]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      setHexInput(color);
      if (showOpacity && opacity < 100) {
        onChange(hexToRgba(color, opacity / 100));
      } else {
        onChange(color);
      }
    },
    [onChange, showOpacity, opacity]
  );

  const handleNativeColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value;
      setHexInput(color);
      if (showOpacity && opacity < 100) {
        onChange(hexToRgba(color, opacity / 100));
      } else {
        onChange(color);
      }
    },
    [onChange, showOpacity, opacity]
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}

      {/* Color preview button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 w-full
          bg-surface-secondary border border-border-subtle rounded-lg
          hover:bg-surface-secondary/70 transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div
          className="w-6 h-6 rounded border border-border-subtle"
          style={{
            backgroundColor: value,
            backgroundImage:
              opacity < 100
                ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                : undefined,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
          }}
        >
          <div
            className="w-full h-full rounded"
            style={{ backgroundColor: value }}
          />
        </div>
        <span className="text-sm text-text-primary font-mono flex-1 text-left">
          {hexInput.toUpperCase()}
          {showOpacity && opacity < 100 && ` (${opacity}%)`}
        </span>
        <Pipette className="w-4 h-4 text-text-muted" />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg z-50 p-4">
          {/* Native color picker */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="color"
                ref={inputRef}
                value={hexInput}
                onChange={handleNativeColorChange}
                className="w-full h-32 rounded-lg cursor-pointer border border-border-subtle"
                style={{ padding: 0 }}
              />
            </div>
          </div>

          {/* Hex input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Hex Color
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={hexInput}
                onChange={handleHexChange}
                placeholder="#000000"
                className="flex-1 px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-sm font-mono text-text-primary focus:border-primary focus:outline-none"
              />
              <div
                className="w-10 h-10 rounded-lg border border-border-subtle"
                style={{ backgroundColor: value }}
              />
            </div>
          </div>

          {/* Opacity slider */}
          {showOpacity && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Opacity: {opacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={handleOpacityChange}
                className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Preset colors */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Presets
            </label>
            <div className="grid grid-cols-10 gap-1">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`
                    w-5 h-5 rounded border transition-all
                    ${
                      hexInput.toLowerCase() === preset.toLowerCase()
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border-subtle hover:border-border-accent'
                    }
                  `}
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
