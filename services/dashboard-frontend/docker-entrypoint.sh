#!/bin/sh
# Dashboard Docker entrypoint script

set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting Dashboard application..."

# Validate environment variables
if [ -z "$VITE_WORKFLOW_API_URL" ]; then
    log "WARNING: VITE_WORKFLOW_API_URL not set, using default: http://localhost:5000"
    export VITE_WORKFLOW_API_URL="http://localhost:5000"
fi

log "Workflow API URL: $VITE_WORKFLOW_API_URL"

# Replace API URL in built files if needed
if [ -n "$RUNTIME_WORKFLOW_API_URL" ]; then
    log "Replacing API URL at runtime: $RUNTIME_WORKFLOW_API_URL"
    find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|$VITE_WORKFLOW_API_URL|$RUNTIME_WORKFLOW_API_URL|g" {} \;
fi

# Generate nginx config with environment variables
if [ -n "$WORKFLOW_API_URL" ]; then
    log "Configuring nginx proxy to: $WORKFLOW_API_URL"
    sed -i "s|proxy_pass http://workflow-engine:5000;|proxy_pass $WORKFLOW_API_URL;|g" /etc/nginx/nginx.conf
fi

# Create necessary directories
mkdir -p /var/cache/nginx
mkdir -p /var/log/nginx

# Set proper permissions
chown -R nginx:nginx /var/cache/nginx
chown -R nginx:nginx /var/log/nginx

# Test nginx configuration
log "Testing nginx configuration..."
nginx -t

# Start nginx
log "Starting nginx server on port 3000..."
exec nginx -g "daemon off;"