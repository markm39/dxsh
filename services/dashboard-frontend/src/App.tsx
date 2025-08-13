/**
 * Dashboard Application Root Component
 * 
 * Main application component with routing and layout
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './providers/AuthProvider';

// Lazy load pages for better performance
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardListPage = React.lazy(() => import('./pages/DashboardListPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const DashboardEditorPage = React.lazy(() => import('./pages/DashboardEditorPage'));
const EmbedTokensPage = React.lazy(() => import('./pages/EmbedTokensPage'));
const EmbedDashboardPage = React.lazy(() => import('./pages/EmbedDashboardPage'));
const EmbedWidgetPage = React.lazy(() => import('./pages/EmbedWidgetPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Loading spinner component
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
      <p className="text-text-secondary">Loading dashboard...</p>
    </div>
  </div>
);

// Error boundary for route-level errors
const RouteErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
};

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        {/* Login page */}
        <Route
          path="/login"
          element={
            <RouteErrorBoundary>
              {isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
            </RouteErrorBoundary>
          }
        />

        {/* Dashboard list - landing page */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <DashboardListPage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/dashboard/:dashboardId"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <DashboardPage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Dashboard editor - edit mode */}
        <Route
          path="/editor"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <DashboardEditorPage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/editor/:dashboardId"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <DashboardEditorPage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Embed tokens management */}
        <Route
          path="/embed-tokens"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <EmbedTokensPage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Embed routes - NO authentication required, uses embed tokens */}
        <Route
          path="/embed/dashboard/:dashboardId"
          element={
            <RouteErrorBoundary>
              <EmbedDashboardPage />
            </RouteErrorBoundary>
          }
        />

        <Route
          path="/embed/widget/:widgetId"
          element={
            <RouteErrorBoundary>
              <EmbedWidgetPage />
            </RouteErrorBoundary>
          }
        />

        {/* 404 page */}
        <Route
          path="*"
          element={
            <RouteErrorBoundary>
              <NotFoundPage />
            </RouteErrorBoundary>
          }
        />
      </Routes>
    </div>
  );
};

export default App;