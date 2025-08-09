/**
 * Error Fallback Component
 * 
 * Displayed when the application encounters an unhandled error
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { FallbackProps } from 'react-error-boundary';

interface ErrorFallbackProps extends FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const isDevelopment = import.meta.env.DEV;

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full">
        <div className="p-6 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-red-400 mb-4">
              <AlertTriangle className="h-full w-full" />
            </div>
            
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Something went wrong
            </h1>
            
            <p className="text-text-secondary mb-6">
              We encountered an unexpected error. Please try refreshing the page or 
              return to the dashboard.
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={resetErrorBoundary}
                className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              
              <button
                onClick={handleGoHome}
                className="w-full px-4 py-2 bg-surface-secondary hover:bg-surface-secondary/70 text-text-primary rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
              
              <button
                onClick={handleReload}
                className="w-full px-4 py-2 bg-transparent hover:bg-surface-secondary/30 text-text-secondary rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>
            
            {isDevelopment && (
              <details className="text-left bg-surface-secondary rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-text-secondary mb-2">
                  Error Details (Development)
                </summary>
                <div className="text-sm text-text-muted space-y-2">
                  <div>
                    <strong>Error:</strong> {error.name}
                  </div>
                  <div>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;