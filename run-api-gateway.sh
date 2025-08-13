#!/bin/bash

echo "Starting API Gateway locally..."

cd services/api-gateway

# Activate virtual environment if it exists, create if it doesn't
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=sqlite:///api_gateway.db
export WORKFLOW_ENGINE_URL=http://localhost:8000
export DASHBOARD_SERVICE_URL=http://localhost:8002
export BUILDER_SERVICE_URL=http://localhost:3000

echo "Starting API Gateway on http://localhost:8001"
echo "Database: SQLite (api_gateway.db)"
echo "Workflow Engine: http://localhost:8000"
echo "Press Ctrl+C to stop"

python -m uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload