/**
 * BorderEditor Component
 *
 * Editor for border configuration (width, style, color, radius)
 */

import React, { useCallback, useState } from 'react';
import { Link, Unlink } from 'lucide-react';
import type { BorderConfig } from '../../types/styling';
import { DEFAULT_BORDER } from '../../types/styling';
import ColorPicker from './ColorPicker';

interface BorderEditorProps {
  value: BorderConfig;
  onChange: (border: BorderConfig) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
];

const BorderEditor: React.FC<BorderEditorProps> = ({
  value = DEFAULT_BORDER,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  const [linkedRadius, setLinkedRadius] = useState(
    typeof value.radius === 'number'
  );

  const border: BorderConfig = {
    width: value?.width ?? 1,
    style: value?.style || 'solid',
    color: value?.color || '#2a2a2a',
    radius: value?.radius ?? 8,
  };

  const handleWidthChange = useCallback(
    (width: number) => {
      onChange({ ...border, width });
    },
    [border, onChange]
  );

  const handleStyleChange = useCallback(
    (style: BorderConfig['style']) => {
      onChange({ ...border, style });
    },
    [border, onChange]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      onChange({ ...border, color });
    },
    [border, onChange]
  );

  const handleRadiusChange = useCallback(
    (radius: number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number }) => {
      onChange({ ...border, radius });
    },
    [border, onChange]
  );

  const handleIndividualRadiusChange = useCallback(
    (corner: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', cornerValue: number) => {
      const currentRadius =
        typeof border.radius === 'number'
          ? {
              topLeft: border.radius,
              topRight: border.radius,
              bottomRight: border.radius,
              bottomLeft: border.radius,
            }
          : border.radius;

      handleRadiusChange({ ...currentRadius, [corner]: cornerValue });
    },
    [border.radius, handleRadiusChange]
  );

  const toggleLinkedRadius = useCallback(() => {
    if (linkedRadius) {
      // Unlink - convert to individual values
      const value = typeof border.radius === 'number' ? border.radius : 8;
      setLinkedRadius(false);
      handleRadiusChange({
        topLeft: value,
        topRight: value,
        bottomRight: value,
        bottomLeft: value,
      });
    } else {
      // Link - use the average value
      const currentRadius =
        typeof border.radius === 'number'
          ? border.radius
          : Math.round(
              (border.radius.topLeft +
                border.radius.topRight +
                border.radius.bottomRight +
                border.radius.bottomLeft) /
                4
            );
      setLinkedRadius(true);
      handleRadiusChange(currentRadius);
    }
  }, [linkedRadius, border.radius, handleRadiusChange]);

  const radiusValue =
    typeof border.radius === 'number'
      ? border.radius
      : {
          topLeft: border.radius.topLeft,
          topRight: border.radius.topRight,
          bottomRight: border.radius.bottomRight,
          bottomLeft: border.radius.bottomLeft,
        };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-3">
          {label}
        </label>
      )}

      {/* Border style selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Style
        </label>
        <div className="flex flex-wrap gap-2">
          {BORDER_STYLES.map(({ value: styleValue, label: styleLabel }) => (
            <button
              key={styleValue}
              type="button"
              onClick={() => handleStyleChange(styleValue as BorderConfig['style'])}
              disabled={disabled}
              className={`
                px-3 py-1.5 text-sm rounded-lg transition-colors
                ${
                  border.style === styleValue
                    ? 'bg-primary text-white'
                    : 'bg-surface-secondary text-text-secondary hover:bg-surface-secondary/70'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {styleLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Border width */}
      {border.style !== 'none' && (
        <>
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Width: {border.width}px
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={border.width}
              onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>

          {/* Border color */}
          <div className="mb-4">
            <ColorPicker
              value={border.color}
              onChange={handleColorChange}
              label="Color"
              showOpacity
              disabled={disabled}
            />
          </div>
        </>
      )}

      {/* Border radius */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Border Radius
          </label>
          <button
            type="button"
            onClick={toggleLinkedRadius}
            disabled={disabled}
            className={`
              p-1.5 rounded-lg transition-colors
              ${linkedRadius ? 'bg-primary/20 text-primary' : 'bg-surface-secondary text-text-muted'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-secondary/70'}
            `}
            title={linkedRadius ? 'Unlink corners' : 'Link corners'}
          >
            {linkedRadius ? (
              <Link className="w-4 h-4" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
          </button>
        </div>

        {linkedRadius ? (
          <div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="50"
                value={radiusValue as number}
                onChange={(e) =>
                  handleRadiusChange(parseInt(e.target.value, 10))
                }
                className="flex-1 h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                disabled={disabled}
              />
              <span className="text-xs text-text-muted w-12 text-right">
                {radiusValue}px
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map(
              (corner) => (
                <div key={corner}>
                  <label className="block text-2xs text-text-muted mb-1 capitalize">
                    {corner.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={
                        (radiusValue as { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number })[corner]
                      }
                      onChange={(e) =>
                        handleIndividualRadiusChange(
                          corner,
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="flex-1 h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer"
                      disabled={disabled}
                    />
                    <span className="text-2xs text-text-muted w-8 text-right">
                      {(radiusValue as { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number })[corner]}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <label className="block text-xs font-medium text-text-secondary mb-2">
          Preview
        </label>
        <div
          className="w-full h-16 bg-surface-secondary"
          style={{
            borderWidth: border.style !== 'none' ? `${border.width}px` : 0,
            borderStyle: border.style,
            borderColor: border.color,
            borderRadius:
              typeof radiusValue === 'number'
                ? `${radiusValue}px`
                : `${radiusValue.topLeft}px ${radiusValue.topRight}px ${radiusValue.bottomRight}px ${radiusValue.bottomLeft}px`,
          }}
        />
      </div>
    </div>
  );
};

export default BorderEditor;
