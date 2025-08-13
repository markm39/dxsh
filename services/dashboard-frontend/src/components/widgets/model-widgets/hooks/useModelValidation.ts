import { useCallback } from 'react';
import { ModelSchema, ModelFeature, ValidationResult, UseModelValidationReturn } from '../types';

/**
 * Hook for validating model inputs
 * Provides validation logic for different feature types
 */
export function useModelValidation(schema: ModelSchema): UseModelValidationReturn {
  
  const validateField = useCallback((field: string, value: any): string | null => {
    const feature = schema.features.find(f => f.name === field);
    if (!feature) return null;

    // Required field validation
    if (feature.required && (value === undefined || value === null || value === '')) {
      return `${feature.displayName || feature.name} is required`;
    }

    // Skip validation for optional empty fields
    if (!feature.required && (value === undefined || value === null || value === '')) {
      return null;
    }

    // Type-specific validation
    switch (feature.type) {
      case 'number':
        return validateNumberField(feature, value);
      case 'categorical':
        return validateCategoricalField(feature, value);
      case 'boolean':
        return validateBooleanField(feature, value);
      default:
        return null;
    }
  }, [schema]);

  const validate = useCallback((inputs: { [feature: string]: any }): ValidationResult => {
    const errors: { [field: string]: string } = {};

    // Validate each feature in the schema
    schema.features.forEach(feature => {
      const error = validateField(feature.name, inputs[feature.name]);
      if (error) {
        errors[feature.name] = error;
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, [schema, validateField]);

  return {
    validate,
    validateField
  };
}

function validateNumberField(feature: ModelFeature, value: any): string | null {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return `${feature.displayName || feature.name} must be a valid number`;
  }

  if (feature.min !== undefined && numValue < feature.min) {
    return `${feature.displayName || feature.name} must be at least ${feature.min}`;
  }

  if (feature.max !== undefined && numValue > feature.max) {
    return `${feature.displayName || feature.name} must be at most ${feature.max}`;
  }

  // Custom pattern validation
  if (feature.validation?.pattern) {
    const regex = new RegExp(feature.validation.pattern);
    if (!regex.test(String(numValue))) {
      return feature.validation.message || `${feature.displayName || feature.name} format is invalid`;
    }
  }

  return null;
}

function validateCategoricalField(feature: ModelFeature, value: any): string | null {
  if (!feature.options || feature.options.length === 0) {
    return null; // No options specified, assume valid
  }

  if (!feature.options.includes(String(value))) {
    return `${feature.displayName || feature.name} must be one of: ${feature.options.join(', ')}`;
  }

  return null;
}

function validateBooleanField(feature: ModelFeature, value: any): string | null {
  if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
    return `${feature.displayName || feature.name} must be true or false`;
  }

  return null;
}

/**
 * Helper function to get default values for a model schema
 */
export function getDefaultValues(schema: ModelSchema): { [feature: string]: any } {
  const defaults: { [feature: string]: any } = {};

  schema.features.forEach(feature => {
    switch (feature.type) {
      case 'number':
        defaults[feature.name] = feature.defaultValue ?? 0;
        break;
      case 'categorical':
        defaults[feature.name] = feature.defaultOption ?? (feature.options?.[0] || '');
        break;
      case 'boolean':
        defaults[feature.name] = feature.defaultBoolean ?? false;
        break;
    }
  });

  return defaults;
}

/**
 * Helper function to format values for display
 */
export function formatValue(feature: ModelFeature, value: any): string {
  if (value === undefined || value === null) return '';

  switch (feature.type) {
    case 'number':
      return typeof value === 'number' ? value.toString() : String(value);
    case 'categorical':
      return String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

/**
 * Helper function to parse input values to correct types
 */
export function parseInputValue(feature: ModelFeature, value: any): any {
  if (value === undefined || value === null || value === '') {
    return feature.type === 'boolean' ? false : null;
  }

  switch (feature.type) {
    case 'number':
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(numValue) ? null : numValue;
    case 'categorical':
      return String(value);
    case 'boolean':
      return value === true || value === 'true';
    default:
      return value;
  }
}