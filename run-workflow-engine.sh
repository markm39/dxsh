#!/bin/bash

echo "Starting Workflow Engine locally..."

cd services/workflow-engine

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
export DATABASE_URL=sqlite:///workflow_engine.db
export OPENAI_API_KEY=${OPENAI_API_KEY:-"your_openai_key_here"}

echo "Starting Workflow Engine on http://localhost:8000"
echo "Database: SQLite (workflow_engine.db)"
echo "Press Ctrl+C to stop"

python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload