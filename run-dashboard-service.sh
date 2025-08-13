#!/bin/bash

echo "Starting Dashboard Service locally..."

cd services/dashboard-service

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
export DATABASE_URL=sqlite:///dashboard_service.db
export WORKFLOW_ENGINE_URL=http://localhost:8000

echo "Starting Dashboard Service on http://localhost:8002"
echo "Database: SQLite (dashboard_service.db)"
echo "Workflow Engine: http://localhost:8000"
echo "Press Ctrl+C to stop"

python -m uvicorn src.main:app --host 0.0.0.0 --port 8002 --reload