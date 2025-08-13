import { useState, useCallback } from 'react';
import { PredictionResult, UsePredictionReturn } from '../types';

/**
 * Hook for managing model predictions
 * Provides state management and error handling for prediction requests
 */
export function usePrediction(): UsePredictionReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async (
    predictFn: (inputs: { [feature: string]: any }) => Promise<PredictionResult>,
    inputs: { [feature: string]: any }
  ): Promise<PredictionResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const predictionResult = await predictFn(inputs);
      setResult(predictionResult);
      return predictionResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Prediction failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    predict: (inputs: { [feature: string]: any }) => 
      Promise.reject(new Error('Predict function not bound')), // Will be overridden
    loading,
    result,
    error,
    clear
  };
}

/**
 * Hook factory that creates a prediction hook bound to a specific predict function
 */
export function createPredictionHook(
  predictFn: (inputs: { [feature: string]: any }) => Promise<PredictionResult>
): () => UsePredictionReturn {
  return function useBoundPrediction(): UsePredictionReturn {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const predict = useCallback(async (inputs: { [feature: string]: any }): Promise<PredictionResult> => {
      setLoading(true);
      setError(null);
      
      try {
        const predictionResult = await predictFn(inputs);
        setResult(predictionResult);
        return predictionResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Prediction failed';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    }, []);

    const clear = useCallback(() => {
      setResult(null);
      setError(null);
      setLoading(false);
    }, []);

    return {
      predict,
      loading,
      result,
      error,
      clear
    };
  };
}