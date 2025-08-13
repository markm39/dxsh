#!/bin/bash

echo "🎯 Starting Dxsh Development Server"
echo "=================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Set environment variables
export DATABASE_URL=sqlite:///workflow_engine.db
export WORKFLOW_ENGINE_URL=http://localhost:8000
export DASHBOARD_SERVICE_URL=http://localhost:8002
export BUILDER_SERVICE_URL=http://localhost:3000
export VITE_API_BASE_URL=http://localhost:8001

echo "🚀 Starting services..."

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

# Start Builder Service
echo "   Starting Builder Service on :3000"
(cd services/builder-service && npm run dev -- --host 0.0.0.0 --port 3000) > builder-service.log 2>&1 &

sleep 3

echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Access URLs:"
echo "   • Builder UI:      http://localhost:3000"
echo "   • API Gateway:     http://localhost:8001"
echo "   • Workflow Engine: http://localhost:8000"
echo "   • Dashboard:       http://localhost:8002"
echo ""
echo "📋 Logs:"
echo "   tail -f workflow-engine.log api-gateway.log dashboard-service.log builder-service.log"
echo ""
echo "⌨️  Press Ctrl+C to stop all services"

# Wait for user interrupt
while true; do
    sleep 1
done