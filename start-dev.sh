#!/bin/bash

echo "Starting Dxsh Development Server"
echo "=================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    echo "All services stopped"
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed"
    echo "Please install Python 3.9+ and try again"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed"
    echo "Please install Node.js 18+ and try again"
    exit 1
fi

echo "Setting up development environment..."

# Setup Python services
setup_python_service() {
    local service_path=$1
    local service_name=$2
    
    echo "  Setting up $service_name..."
    
    if [ ! -d "$service_path/venv" ]; then
        echo "    Creating virtual environment..."
        (cd "$service_path" && python3 -m venv venv)
    fi
    
    echo "    Installing Python dependencies..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS: Install with conda-forge for better compatibility
        (cd "$service_path" && source venv/bin/activate && pip install -r requirements.txt --find-links https://download.pytorch.org/whl/torch_stable.html > /dev/null 2>&1)
    else
        (cd "$service_path" && source venv/bin/activate && pip install -r requirements.txt > /dev/null 2>&1)
    fi
    
    if [ "$service_name" == "Workflow Engine" ]; then
        echo "    Installing Playwright browser..."
        (cd "$service_path" && source venv/bin/activate && playwright install chromium > /dev/null 2>&1)
    fi
}

# Setup Node.js services
setup_node_service() {
    local service_path=$1
    local service_name=$2
    
    echo "  Setting up $service_name..."
    
    if [ ! -d "$service_path/node_modules" ]; then
        echo "    Installing Node.js dependencies..."
        (cd "$service_path" && npm install > /dev/null 2>&1)
    else
        echo "    Node.js dependencies already installed"
    fi
}

# Setup backend services
setup_python_service "services/workflow-engine" "Workflow Engine"
setup_python_service "services/api-gateway" "API Gateway"
setup_python_service "services/dashboard-service" "Dashboard Service"

# Setup frontend services
setup_node_service "services/workflow-frontend" "Workflow Frontend"
setup_node_service "services/dashboard-frontend" "Dashboard Frontend"

# Copy environment files if they don't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env to add your OpenAI API key for AI features"
fi

echo "Setup complete!"
echo ""

# Set environment variables for service communication
export DATABASE_URL=sqlite:///workflow_engine.db

# For dashboard service to call API Gateway
export WORKFLOW_ENGINE_URL=http://localhost:8001

# For API Gateway to call actual services
export WORKFLOW_ENGINE_BACKEND_URL=http://localhost:8000
export DASHBOARD_SERVICE_URL=http://localhost:8002
export WORKFLOW_FRONTEND_URL=http://localhost:3000
export DASHBOARD_FRONTEND_URL=http://localhost:3001

# For frontend clients to call API Gateway
export VITE_API_BASE_URL=http://localhost:8001
export VITE_WORKFLOW_API_URL=http://localhost:8001

echo "Starting services..."

# Start Workflow Engine
echo "   Starting Workflow Engine on :8000"
(cd services/workflow-engine && source venv/bin/activate && python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload) > workflow-engine.log 2>&1 &

sleep 2

# Start API Gateway
echo "   Starting API Gateway on :8001"
(cd services/api-gateway && source venv/bin/activate && python -m uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload) > api-gateway.log 2>&1 &

sleep 2

# Start Dashboard Service
echo "   Starting Dashboard Service on :8002"
(cd services/dashboard-service && source venv/bin/activate && python -m uvicorn src.main:app --host 0.0.0.0 --port 8002 --reload) > dashboard-service.log 2>&1 &

sleep 2

# Start Workflow Frontend
echo "   Starting Workflow Frontend on :3000"
(cd services/workflow-frontend && npm run dev -- --host 0.0.0.0 --port 3000) > workflow-frontend.log 2>&1 &

sleep 2

# Start Dashboard Frontend
echo "   Starting Dashboard Frontend on :3001"
(cd services/dashboard-frontend && npm run dev -- --host 0.0.0.0 --port 3001) > dashboard-frontend.log 2>&1 &

sleep 3

echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Access URLs:"
echo "   • Builder UI:        http://localhost:3000"
echo "   • Dashboard UI:      http://localhost:3001"
echo "   • API Gateway:       http://localhost:8001"
echo "   • Workflow Engine:   http://localhost:8000"
echo "   • Dashboard Service: http://localhost:8002"
echo ""
echo "📋 Logs:"
echo "   tail -f workflow-engine.log api-gateway.log dashboard-service.log workflow-frontend.log dashboard-frontend.log"
echo ""
echo "⌨️  Press Ctrl+C to stop all services"

# Wait for user interrupt
while true; do
    sleep 1
done