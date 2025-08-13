/**
 * Inline Editable Text Component
 * 
 * Allows inline editing of text with save/cancel functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Edit2 } from 'lucide-react';

interface InlineEditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  showEditIcon?: boolean;
  autoFocus?: boolean;
}

export const InlineEditableText: React.FC<InlineEditableTextProps> = ({
  value,
  onSave,
  onCancel,
  placeholder = '',
  className = '',
  disabled = false,
  maxLength,
  showEditIcon = true,
  autoFocus = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, autoFocus]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsEditing(true);
      setEditValue(value);
    }
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      onSave(trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={handleInputClick}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`
            bg-surface border border-border-subtle rounded px-2 py-1 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30
            ${className}
          `}
        />
        <button
          onClick={handleSave}
          className="p-1 rounded hover:bg-green-500/10 transition-colors"
          title="Save"
        >
          <Check className="h-3 w-3 text-green-400" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 rounded hover:bg-red-500/10 transition-colors"
          title="Cancel"
        >
          <X className="h-3 w-3 text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`
        group flex items-center gap-2 cursor-pointer
        ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-secondary/20 rounded px-1 py-0.5'}
        ${className}
      `}
      onClick={handleStartEdit}
      title={disabled ? '' : 'Click to edit'}
    >
      <span className="truncate">
        {value || placeholder}
      </span>
      {showEditIcon && !disabled && (
        <Edit2 className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      )}
    </div>
  );
};

export default InlineEditableText;