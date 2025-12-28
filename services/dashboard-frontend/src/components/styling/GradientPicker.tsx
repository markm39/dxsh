/**
 * GradientPicker Component
 *
 * A comprehensive gradient editor with multiple stops and angle control
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, RotateCw } from 'lucide-react';
import type { GradientConfig, GradientStop } from '../../types/styling';
import { gradientToCSS } from '../../utils/styleUtils';
import ColorPicker from './ColorPicker';

interface GradientPickerProps {
  value: GradientConfig;
  onChange: (gradient: GradientConfig) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_GRADIENT: GradientConfig = {
  type: 'linear',
  angle: 180,
  stops: [
    { color: '#3b82f6', position: 0 },
    { color: '#8b5cf6', position: 100 },
  ],
};

const PRESET_GRADIENTS: GradientConfig[] = [
  {
    type: 'linear',
    angle: 90,
    stops: [
      { color: '#667eea', position: 0 },
      { color: '#764ba2', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#f093fb', position: 0 },
      { color: '#f5576c', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 90,
    stops: [
      { color: '#4facfe', position: 0 },
      { color: '#00f2fe', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 45,
    stops: [
      { color: '#43e97b', position: 0 },
      { color: '#38f9d7', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#fa709a', position: 0 },
      { color: '#fee140', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 180,
    stops: [
      { color: '#a8edea', position: 0 },
      { color: '#fed6e3', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 90,
    stops: [
      { color: '#0a0a0a', position: 0 },
      { color: '#1a1a2e', position: 50 },
      { color: '#16213e', position: 100 },
    ],
  },
  {
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#0f0c29', position: 0 },
      { color: '#302b63', position: 50 },
      { color: '#24243e', position: 100 },
    ],
  },
];

const GradientPicker: React.FC<GradientPickerProps> = ({
  value = DEFAULT_GRADIENT,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure value has required properties
  const gradient: GradientConfig = {
    type: value?.type || 'linear',
    angle: value?.angle ?? 180,
    stops: value?.stops || DEFAULT_GRADIENT.stops,
  };

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

  const handleTypeChange = useCallback(
    (type: GradientConfig['type']) => {
      onChange({ ...gradient, type });
    },
    [gradient, onChange]
  );

  const handleAngleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...gradient, angle: parseInt(e.target.value, 10) });
    },
    [gradient, onChange]
  );

  const handleStopColorChange = useCallback(
    (index: number, color: string) => {
      const newStops = [...gradient.stops];
      newStops[index] = { ...newStops[index], color };
      onChange({ ...gradient, stops: newStops });
    },
    [gradient, onChange]
  );

  const handleStopPositionChange = useCallback(
    (index: number, position: number) => {
      const newStops = [...gradient.stops];
      newStops[index] = { ...newStops[index], position };
      onChange({ ...gradient, stops: newStops });
    },
    [gradient, onChange]
  );

  const addStop = useCallback(() => {
    if (gradient.stops.length >= 5) return;

    // Find a position between existing stops
    const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);
    let newPosition = 50;

    // Find the largest gap
    let maxGap = 0;
    let gapStart = 0;
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const gap = sortedStops[i + 1].position - sortedStops[i].position;
      if (gap > maxGap) {
        maxGap = gap;
        gapStart = sortedStops[i].position;
      }
    }
    newPosition = gapStart + maxGap / 2;

    const newStops: GradientStop[] = [
      ...gradient.stops,
      { color: '#ffffff', position: newPosition },
    ];
    onChange({ ...gradient, stops: newStops });
  }, [gradient, onChange]);

  const removeStop = useCallback(
    (index: number) => {
      if (gradient.stops.length <= 2) return;

      const newStops = gradient.stops.filter((_, i) => i !== index);
      onChange({ ...gradient, stops: newStops });
    },
    [gradient, onChange]
  );

  const applyPreset = useCallback(
    (preset: GradientConfig) => {
      onChange(preset);
    },
    [onChange]
  );

  const gradientCSS = gradientToCSS(gradient);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}

      {/* Gradient preview button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full h-12 rounded-lg border border-border-subtle
          hover:border-border-accent transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={{ backgroundImage: gradientCSS }}
      />

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg z-50 p-4">
          {/* Gradient preview */}
          <div
            className="w-full h-16 rounded-lg mb-4 border border-border-subtle"
            style={{ backgroundImage: gradientCSS }}
          />

          {/* Gradient type selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {(['linear', 'radial', 'conic'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`
                    flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors capitalize
                    ${
                      gradient.type === type
                        ? 'bg-primary text-white'
                        : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
                    }
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Angle control (for linear and conic) */}
          {(gradient.type === 'linear' || gradient.type === 'conic') && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Angle: {gradient.angle}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={gradient.angle}
                  onChange={handleAngleChange}
                  className="flex-1 h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                />
                <div
                  className="w-8 h-8 rounded-full border border-border-subtle bg-surface-secondary flex items-center justify-center"
                  style={{
                    transform: `rotate(${gradient.angle}deg)`,
                  }}
                >
                  <RotateCw className="w-4 h-4 text-text-muted" />
                </div>
              </div>
            </div>
          )}

          {/* Color stops */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-secondary">
                Color Stops
              </label>
              <button
                type="button"
                onClick={addStop}
                disabled={gradient.stops.length >= 5}
                className="p-1 hover:bg-surface-secondary rounded transition-colors disabled:opacity-50"
                title="Add stop"
              >
                <Plus className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            <div className="space-y-2">
              {gradient.stops.map((stop, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    <ColorPicker
                      value={stop.color}
                      onChange={(color) => handleStopColorChange(index, color)}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={stop.position}
                    onChange={(e) =>
                      handleStopPositionChange(index, parseInt(e.target.value, 10))
                    }
                    className="flex-1 h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-text-muted w-8 text-right">
                    {stop.position}%
                  </span>
                  {gradient.stops.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeStop(index)}
                      className="p-1 hover:bg-red-500/10 rounded transition-colors"
                      title="Remove stop"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preset gradients */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_GRADIENTS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="h-8 rounded border border-border-subtle hover:border-border-accent transition-colors"
                  style={{ backgroundImage: gradientToCSS(preset) }}
                  title={`Preset ${index + 1}`}
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

export default GradientPicker;
