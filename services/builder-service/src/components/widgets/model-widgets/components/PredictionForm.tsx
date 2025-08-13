import React, { useState, useCallback } from 'react';
import { Calculator, Loader, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { PredictionFormProps, ModelFeature, PredictionResult } from '../types';
import { useModelValidation, getDefaultValues, parseInputValue } from '../hooks/useModelValidation';

/**
 * Reusable prediction form component
 * Handles input collection and validation for any model type
 */
export const PredictionForm: React.FC<PredictionFormProps> = ({
  schema,
  onPredict,
  loading = false,
  result,
  className = ''
}) => {
  const [inputs, setInputs] = useState<{ [feature: string]: any }>(() => 
    getDefaultValues(schema)
  );
  const [localResult, setLocalResult] = useState<PredictionResult | null>(result || null);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { validate, validateField } = useModelValidation(schema);

  const handleInputChange = useCallback((featureName: string, value: any) => {
    const feature = schema.features.find(f => f.name === featureName);
    if (!feature) return;

    const parsedValue = parseInputValue(feature, value);
    setInputs(prev => ({ ...prev, [featureName]: parsedValue }));
    
    // Clear field-specific errors when user starts typing
    setError(null);
  }, [schema.features]);

  const handlePredict = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = validate(inputs);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      setError(firstError);
      return;
    }

    setLocalLoading(true);
    setError(null);

    try {
      const prediction = await onPredict(inputs);
      setLocalResult(prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLocalLoading(false);
    }
  }, [inputs, validate, onPredict]);

  const isLoading = loading || localLoading;
  const displayResult = result || localResult;

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
          <Calculator className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Make Prediction</h3>
          <p className="text-sm text-text-secondary">
            Enter values to get a prediction from the model
          </p>
        </div>
      </div>

      <form onSubmit={handlePredict} className="space-y-6">
        {/* Feature Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schema.features.map((feature) => (
            <FeatureInput
              key={feature.name}
              feature={feature}
              value={inputs[feature.name]}
              onChange={(value) => handleInputChange(feature.name, value)}
              onValidate={(value) => validateField(feature.name, value)}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Predict Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Predicting...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              Make Prediction
            </>
          )}
        </button>

        {/* Results Display */}
        {displayResult && (
          <PredictionResultDisplay
            result={displayResult}
            targetInfo={schema.target}
          />
        )}
      </form>
    </div>
  );
};

/**
 * Individual feature input component
 */
interface FeatureInputProps {
  feature: ModelFeature;
  value: any;
  onChange: (value: any) => void;
  onValidate: (value: any) => string | null;
  disabled?: boolean;
}

const FeatureInput: React.FC<FeatureInputProps> = ({
  feature,
  value,
  onChange,
  onValidate,
  disabled = false
}) => {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = useCallback((newValue: any) => {
    onChange(newValue);
    
    // Validate and show error
    const error = onValidate(newValue);
    setLocalError(error);
  }, [onChange, onValidate]);

  const renderInput = () => {
    switch (feature.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            min={feature.min}
            max={feature.max}
            step={feature.step || 'any'}
            disabled={disabled}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-blue-500 focus:outline-none disabled:opacity-50"
            placeholder={`Enter ${feature.displayName || feature.name}`}
          />
        );

      case 'categorical':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">Select {feature.displayName || feature.name}</option>
            {feature.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={feature.name}
                checked={value === true}
                onChange={() => handleChange(true)}
                disabled={disabled}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-text-primary">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={feature.name}
                checked={value === false}
                onChange={() => handleChange(false)}
                disabled={disabled}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-text-primary">No</span>
            </label>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-surface text-text-primary p-3 rounded-lg border border-border-subtle focus:border-blue-500 focus:outline-none disabled:opacity-50"
            placeholder={`Enter ${feature.displayName || feature.name}`}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-sm font-medium text-text-primary">
        {feature.displayName || feature.name}
        {feature.required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {/* Description */}
      {feature.description && (
        <p className="text-xs text-text-muted">{feature.description}</p>
      )}

      {/* Input */}
      {renderInput()}

      {/* Error */}
      {localError && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {localError}
        </p>
      )}

      {/* Hints */}
      {feature.type === 'number' && (feature.min !== undefined || feature.max !== undefined) && (
        <p className="text-xs text-text-muted">
          Range: {feature.min ?? '-∞'} to {feature.max ?? '∞'}
        </p>
      )}
    </div>
  );
};

/**
 * Prediction result display component
 */
interface PredictionResultProps {
  result: PredictionResult;
  targetInfo: { name: string; type: string; displayName?: string; unit?: string };
}

const PredictionResultDisplay: React.FC<PredictionResultProps> = ({ result, targetInfo }) => {
  const formatPrediction = (value: number | string): string => {
    if (typeof value === 'string') return value;
    
    // Format numbers with appropriate precision and units
    let formatted = typeof value === 'number' ? value.toLocaleString() : String(value);
    
    if (targetInfo.unit) {
      formatted = `${targetInfo.unit}${formatted}`;
    }
    
    return formatted;
  };

  return (
    <div className="mt-6 p-4 bg-green-500/10 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <h4 className="font-medium text-green-400">Prediction Result</h4>
      </div>

      {/* Main Prediction */}
      <div className="mb-4">
        <div className="text-sm text-text-muted mb-1">
          Predicted {targetInfo.displayName || targetInfo.name}:
        </div>
        <div className="text-2xl font-bold text-green-400">
          {formatPrediction(result.value)}
        </div>
      </div>

      {/* Confidence */}
      {result.confidence !== undefined && (
        <div className="mb-4">
          <div className="text-sm text-text-muted mb-1">Confidence:</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-surface-secondary rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, result.confidence * 100))}%` }}
              />
            </div>
            <span className="text-sm font-medium text-green-400">
              {(result.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Feature Contributions */}
      {result.explanation?.featureContributions && result.explanation.featureContributions.length > 0 && (
        <div>
          <div className="text-sm text-text-muted mb-2">Key Factors:</div>
          <div className="space-y-1">
            {result.explanation.featureContributions
              .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
              .slice(0, 3)
              .map((contrib, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{contrib.feature}:</span>
                  <span className={`font-medium ${
                    contrib.impact === 'positive' ? 'text-green-400' : 
                    contrib.impact === 'negative' ? 'text-red-400' : 
                    'text-text-muted'
                  }`}>
                    {contrib.impact === 'positive' ? '+' : contrib.impact === 'negative' ? '-' : ''}
                    {Math.abs(contrib.contribution).toFixed(2)}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Explanation Summary */}
      {result.explanation?.summary && (
        <div className="mt-3 pt-3 border-t border-green-500/20">
          <p className="text-xs text-text-secondary">{result.explanation.summary}</p>
        </div>
      )}
    </div>
  );
};