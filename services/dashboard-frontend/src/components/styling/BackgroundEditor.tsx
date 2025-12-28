/**
 * BackgroundEditor Component
 *
 * Editor for background configuration (solid, gradient, image, pattern)
 */

import React, { useCallback } from 'react';
import { Image, Palette, Sparkles, Grid3X3 } from 'lucide-react';
import type { BackgroundConfig, GradientConfig } from '../../types/styling';
import { DEFAULT_BACKGROUND } from '../../types/styling';
import ColorPicker from './ColorPicker';
import GradientPicker from './GradientPicker';

interface BackgroundEditorProps {
  value: BackgroundConfig;
  onChange: (background: BackgroundConfig) => void;
  label?: string;
  showImage?: boolean;
  showPattern?: boolean;
  disabled?: boolean;
  className?: string;
}

const BackgroundEditor: React.FC<BackgroundEditorProps> = ({
  value = DEFAULT_BACKGROUND,
  onChange,
  label,
  showImage = true,
  showPattern = true,
  disabled = false,
  className = '',
}) => {
  const background: BackgroundConfig = {
    type: value?.type || 'solid',
    color: value?.color || '#000000',
    gradient: value?.gradient,
    image: value?.image,
    pattern: value?.pattern,
    overlay: value?.overlay,
  };

  const handleTypeChange = useCallback(
    (type: BackgroundConfig['type']) => {
      const newBackground: BackgroundConfig = { ...background, type };

      // Set defaults for each type
      if (type === 'solid' && !newBackground.color) {
        newBackground.color = '#000000';
      } else if (type === 'gradient' && !newBackground.gradient) {
        newBackground.gradient = {
          type: 'linear',
          angle: 180,
          stops: [
            { color: '#3b82f6', position: 0 },
            { color: '#8b5cf6', position: 100 },
          ],
        };
      } else if (type === 'image' && !newBackground.image) {
        newBackground.image = {
          url: '',
          size: 'cover',
          position: 'center',
          repeat: 'no-repeat',
          opacity: 1,
        };
      } else if (type === 'pattern' && !newBackground.pattern) {
        newBackground.pattern = {
          type: 'grid',
          color: 'rgba(255, 255, 255, 0.1)',
          size: 20,
          opacity: 0.5,
        };
      }

      onChange(newBackground);
    },
    [background, onChange]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      onChange({ ...background, color });
    },
    [background, onChange]
  );

  const handleGradientChange = useCallback(
    (gradient: GradientConfig) => {
      onChange({ ...background, gradient });
    },
    [background, onChange]
  );

  const handleImageChange = useCallback(
    (field: string, fieldValue: any) => {
      onChange({
        ...background,
        image: {
          ...background.image!,
          [field]: fieldValue,
        },
      });
    },
    [background, onChange]
  );

  const handlePatternChange = useCallback(
    (field: string, fieldValue: any) => {
      onChange({
        ...background,
        pattern: {
          ...background.pattern!,
          [field]: fieldValue,
        },
      });
    },
    [background, onChange]
  );

  const handleOverlayChange = useCallback(
    (enabled: boolean, color?: string, opacity?: number) => {
      if (!enabled) {
        onChange({ ...background, overlay: undefined });
      } else {
        onChange({
          ...background,
          overlay: {
            color: color || background.overlay?.color || 'rgba(0, 0, 0, 0.5)',
            opacity: opacity ?? background.overlay?.opacity ?? 0.5,
          },
        });
      }
    },
    [background, onChange]
  );

  const availableTypes: Array<{ type: BackgroundConfig['type']; icon: typeof Palette; label: string }> = [
    { type: 'solid', icon: Palette, label: 'Solid' },
    { type: 'gradient', icon: Sparkles, label: 'Gradient' },
  ];

  if (showImage) {
    availableTypes.push({ type: 'image', icon: Image, label: 'Image' });
  }
  if (showPattern) {
    availableTypes.push({ type: 'pattern', icon: Grid3X3, label: 'Pattern' });
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-3">
          {label}
        </label>
      )}

      {/* Type selector */}
      <div className="flex gap-2 mb-4">
        {availableTypes.map(({ type, icon: Icon, label: typeLabel }) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors
              ${
                background.type === type
                  ? 'bg-primary text-white'
                  : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <Icon className="w-4 h-4" />
            {typeLabel}
          </button>
        ))}
      </div>

      {/* Type-specific controls */}
      {background.type === 'solid' && (
        <ColorPicker
          value={background.color || '#000000'}
          onChange={handleColorChange}
          label="Background Color"
          showOpacity
          disabled={disabled}
        />
      )}

      {background.type === 'gradient' && (
        <GradientPicker
          value={
            background.gradient || {
              type: 'linear',
              angle: 180,
              stops: [
                { color: '#3b82f6', position: 0 },
                { color: '#8b5cf6', position: 100 },
              ],
            }
          }
          onChange={handleGradientChange}
          label="Gradient"
          disabled={disabled}
        />
      )}

      {background.type === 'image' && background.image && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Image URL
            </label>
            <input
              type="text"
              value={background.image.url}
              onChange={(e) => handleImageChange('url', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary focus:border-primary focus:outline-none"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Size
              </label>
              <select
                value={background.image.size}
                onChange={(e) => handleImageChange('size', e.target.value)}
                className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary focus:border-primary focus:outline-none"
                disabled={disabled}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Auto</option>
                <option value="100% 100%">Stretch</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Position
              </label>
              <select
                value={background.image.position}
                onChange={(e) => handleImageChange('position', e.target.value)}
                className="w-full px-3 py-2 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary focus:border-primary focus:outline-none"
                disabled={disabled}
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Opacity: {Math.round(background.image.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={background.image.opacity * 100}
              onChange={(e) =>
                handleImageChange('opacity', parseInt(e.target.value, 10) / 100)
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          {background.image.blur !== undefined && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Blur: {background.image.blur}px
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={background.image.blur}
                onChange={(e) =>
                  handleImageChange('blur', parseInt(e.target.value, 10))
                }
                className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {background.type === 'pattern' && background.pattern && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Pattern Type
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['dots', 'grid', 'lines', 'diagonal', 'crosshatch'] as const).map(
                (patternType) => (
                  <button
                    key={patternType}
                    type="button"
                    onClick={() => handlePatternChange('type', patternType)}
                    className={`
                      px-2 py-1.5 text-xs rounded-lg capitalize transition-colors
                      ${
                        background.pattern!.type === patternType
                          ? 'bg-primary text-white'
                          : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
                      }
                    `}
                    disabled={disabled}
                  >
                    {patternType}
                  </button>
                )
              )}
            </div>
          </div>

          <ColorPicker
            value={background.pattern.color}
            onChange={(color) => handlePatternChange('color', color)}
            label="Pattern Color"
            showOpacity
            disabled={disabled}
          />

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Size: {background.pattern.size}px
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={background.pattern.size}
              onChange={(e) =>
                handlePatternChange('size', parseInt(e.target.value, 10))
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Opacity: {Math.round(background.pattern.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={background.pattern.opacity * 100}
              onChange={(e) =>
                handlePatternChange('opacity', parseInt(e.target.value, 10) / 100)
              }
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Overlay option */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!background.overlay}
            onChange={(e) => handleOverlayChange(e.target.checked)}
            className="rounded border-border-subtle"
            disabled={disabled}
          />
          <span className="text-sm text-text-secondary">Add color overlay</span>
        </label>

        {background.overlay && (
          <div className="mt-3 space-y-3">
            <ColorPicker
              value={background.overlay.color}
              onChange={(color) =>
                handleOverlayChange(true, color, background.overlay!.opacity)
              }
              label="Overlay Color"
              disabled={disabled}
            />
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Overlay Opacity: {Math.round(background.overlay.opacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={background.overlay.opacity * 100}
                onChange={(e) =>
                  handleOverlayChange(
                    true,
                    background.overlay!.color,
                    parseInt(e.target.value, 10) / 100
                  )
                }
                className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundEditor;
