#!/bin/bash

# Stop Development Services Script
# This script stops all running Dxsh microservices

echo "🛑 Stopping Dxsh development services..."

# Function to kill process by port
kill_by_port() {
    local port=$1
    local service_name=$2
    
    echo "Stopping $service_name on port $port..."
    
    # Find process using the port
    local pid=$(lsof -ti :$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        kill -TERM $pid 2>/dev/null
        sleep 2
        
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            echo "Force killing $service_name..."
            kill -KILL $pid 2>/dev/null
        fi
        
        echo "✅ $service_name stopped"
    else
        echo "ℹ️  $service_name not running on port $port"
    fi
}

# Stop all services by their default ports
kill_by_port 3000 "Workflow Frontend"
kill_by_port 3001 "Dashboard Frontend"
kill_by_port 8000 "Workflow Engine"
kill_by_port 8001 "API Gateway"
kill_by_port 8002 "Dashboard Service"

# Stop any remaining Python processes running our services
echo "Stopping any remaining Python processes..."
pkill -f "main.py" 2>/dev/null || true
pkill -f "workflow-engine" 2>/dev/null || true
pkill -f "dashboard-service" 2>/dev/null || true

# Stop any remaining Node.js processes running our services
echo "Stopping any remaining Node.js processes..."
pkill -f "vite" 2>/dev/null || true
pkill -f "workflow-frontend" 2>/dev/null || true
pkill -f "dashboard-frontend" 2>/dev/null || true

echo ""
echo "🎉 All Dxsh development services have been stopped!"
echo ""
echo "To start services again, run: ./start-dev.sh"