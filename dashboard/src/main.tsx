/**
 * Dashboard Application Entry Point
 * 
 * Main React application bootstrap with providers and error boundaries
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import ErrorFallback from './components/ErrorFallback';
import { AuthProvider } from './providers/AuthProvider';
import { DashboardProvider } from './providers/DashboardProvider';
import { ThemeProvider } from './providers/ThemeProvider';

import './index.css';

// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Global error handler
const handleError = (error: Error, errorInfo: { componentStack: string | null }) => {
  console.error('Dashboard Application Error:', error, errorInfo);
  
  // Report to error tracking service in production
  if (import.meta.env.PROD) {
    // TODO: Integrate with error tracking service (Sentry, etc.)
  }
};

// Application root component with all providers
const AppRoot = () => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={handleError}
    onReset={() => window.location.reload()}
  >
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <DashboardProvider>
              <App />
            </DashboardProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </ErrorBoundary>
);


// Mount application
const root = ReactDOM.createRoot(document.getElementById('root')!);

// Enable React 18 concurrent features
root.render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);

// Performance monitoring
if (import.meta.env.PROD) {
  // Web Vitals reporting
  import('web-vitals').then((module) => {
    // @ts-ignore - Web vitals import issue
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = module;
    const reportWebVitals = (metric: any) => {
      console.log('Web Vital:', metric);
      // TODO: Send to analytics service
    };

    if (getCLS) getCLS(reportWebVitals);
    if (getFID) getFID(reportWebVitals);
    if (getFCP) getFCP(reportWebVitals);
    if (getLCP) getLCP(reportWebVitals);
    if (getTTFB) getTTFB(reportWebVitals);
  }).catch(() => {
    // Web vitals not available
  });
}

// Service Worker registration for PWA features (optional)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}