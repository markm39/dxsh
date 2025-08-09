/**
 * Not Found Page Component
 * 
 * 404 error page with helpful navigation
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="p-8 bg-surface border border-border-subtle rounded-xl shadow-xl backdrop-blur-sm">
          {/* Large 404 */}
          <div className="mb-8">
            <h1 className="text-9xl font-bold text-surface-secondary leading-none">
              404
            </h1>
          </div>

          {/* Error message */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              Page Not Found
            </h2>
            <p className="text-text-secondary mb-6">
              The dashboard or page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Link
              to="/"
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Home className="h-5 w-5" />
              Go to Dashboard Home
            </Link>
            
            <Link
              to="/editor"
              className="px-4 py-2 bg-surface-secondary hover:bg-surface-secondary/70 text-text-primary rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Create New Dashboard
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 bg-transparent hover:bg-surface-secondary/30 text-text-secondary rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>

          {/* Help text */}
          <div className="mt-8 pt-8 border-t border-border-subtle">
            <p className="text-xs text-text-muted">
              If you believe this is an error, please check the URL or contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;