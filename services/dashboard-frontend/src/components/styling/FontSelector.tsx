/**
 * FontSelector Component
 *
 * A dropdown component for selecting font families
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Type } from 'lucide-react';
import { FONT_OPTIONS } from '../../types/styling';

interface FontSelectorProps {
  value: string;
  onChange: (fontFamily: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current font label
  const currentFont = FONT_OPTIONS.find((f) => f.value === value);
  const currentLabel = currentFont?.label || 'Custom Font';

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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}

      {/* Selector button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 px-3 py-2 w-full
          bg-surface-secondary border border-border-subtle rounded-lg
          hover:bg-surface-secondary/70 transition-colors text-left
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Type className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span
            className="text-sm text-text-primary truncate"
            style={{ fontFamily: value }}
          >
            {currentLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {FONT_OPTIONS.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => {
                  onChange(font.value);
                  setIsOpen(false);
                }}
                className={`
                  flex items-center justify-between w-full px-4 py-2.5 text-left
                  hover:bg-surface-secondary/50 transition-colors
                  ${value === font.value ? 'bg-primary/10' : ''}
                `}
                style={{ fontFamily: font.value }}
              >
                <span className="text-sm text-text-primary">{font.label}</span>
                {value === font.value && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FontSelector;
