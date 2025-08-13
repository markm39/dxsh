#!/bin/bash

echo "Starting Workflow Frontend locally..."

cd services/workflow-frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set environment variables
export VITE_API_BASE_URL=http://localhost:8001

echo "Starting Workflow Frontend on http://localhost:3000"
echo "API Gateway: http://localhost:8001"
echo "Press Ctrl+C to stop"

npm run dev -- --host 0.0.0.0 --port 3000