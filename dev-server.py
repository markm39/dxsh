#!/usr/bin/env python3
"""
Consolidated Development Server for Dxsh
Runs all services in a single process for local development
"""

import asyncio
import sys
import os
import signal
from pathlib import Path

class DevServer:
    def __init__(self):
        self.processes = {}
        self.running = True
        
    async def start_service(self, name, command, cwd=None, env_vars=None):
        """Start a service subprocess"""
        print(f"🚀 Starting {name}...")
        
        # Set up environment
        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)
            
        # Start process
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        
        self.processes[name] = process
        
        # Monitor output
        asyncio.create_task(self.monitor_output(name, process))
        
        return process
    
    async def monitor_output(self, name, process):
        """Monitor and prefix service output"""
        colors = {
            "Workflow Engine": "\033[94m",  # Blue
            "API Gateway": "\033[92m",      # Green  
            "Dashboard": "\033[93m",        # Yellow
            "Builder": "\033[95m",          # Magenta
        }
        
        color = colors.get(name, "\033[97m")  # White default
        reset = "\033[0m"
        
        async for line in process.stdout:
            if self.running:
                line_str = line.decode().strip()
                if line_str and not line_str.startswith("INFO:     "):  # Filter uvicorn info
                    print(f"{color}[{name}]{reset} {line_str}")
    
    async def start_all_services(self):
        """Start all development services"""
        print("🎯 Dxsh Development Server")
        print("=" * 50)
        
        # Service configurations
        services = [
            {
                "name": "Workflow Engine",
                "command": "python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload",
                "cwd": "services/workflow-engine",
                "env": {
                    "DATABASE_URL": "sqlite:///workflow_engine.db",
                    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", "your_openai_key_here")
                }
            },
            {
                "name": "API Gateway", 
                "command": "python -m uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload",
                "cwd": "services/api-gateway",
                "env": {
                    "DATABASE_URL": "sqlite:///api_gateway.db",
                    "WORKFLOW_ENGINE_URL": "http://localhost:8000",
                    "DASHBOARD_SERVICE_URL": "http://localhost:8002",
                    "BUILDER_SERVICE_URL": "http://localhost:3000"
                }
            },
            {
                "name": "Dashboard",
                "command": "python -m uvicorn src.main:app --host 0.0.0.0 --port 8002 --reload", 
                "cwd": "services/dashboard-service",
                "env": {
                    "DATABASE_URL": "sqlite:///dashboard_service.db",
                    "WORKFLOW_ENGINE_URL": "http://localhost:8000"
                }
            },
            {
                "name": "Builder",
                "command": "npm run dev -- --host 0.0.0.0 --port 3000",
                "cwd": "services/builder-service", 
                "env": {
                    "VITE_API_BASE_URL": "http://localhost:8001"
                }
            }
        ]
        
        # Start services with delays
        for i, service in enumerate(services):
            # Fix parameter name mismatch
            if 'env' in service:
                service['env_vars'] = service.pop('env')
            await self.start_service(**service)
            if i < len(services) - 1:  # Don't wait after last service
                await asyncio.sleep(2)  # Stagger startup
        
        print("\n✅ All services started!")
        print("\n🌐 Access URLs:")
        print("   • Builder UI:      http://localhost:3000")
        print("   • API Gateway:     http://localhost:8001")
        print("   • Workflow Engine: http://localhost:8000")
        print("   • Dashboard:       http://localhost:8002")
        print("\n⌨️  Press Ctrl+C to stop all services")
        
    def stop_all_services(self):
        """Stop all running services"""
        print("\n🛑 Stopping all services...")
        self.running = False
        
        for name, process in self.processes.items():
            try:
                process.terminate()
                print(f"   Stopped {name}")
            except:
                pass
                
        print("✅ All services stopped")
    
    async def run(self):
        """Main run loop"""
        try:
            await self.start_all_services()
            
            # Keep running until interrupted
            while self.running:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            self.stop_all_services()
        except Exception as e:
            print(f"❌ Error: {e}")
            self.stop_all_services()

def signal_handler(_signum, _frame):
    """Handle Ctrl+C gracefully"""
    print("\n\n🛑 Received interrupt signal...")
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handling
    signal.signal(signal.SIGINT, signal_handler)
    
    # Check if we're in the right directory
    if not Path("services").exists():
        print("❌ Error: Must be run from the workflow-engine root directory")
        sys.exit(1)
    
    # Run the development server
    dev_server = DevServer()
    try:
        asyncio.run(dev_server.run())
    except KeyboardInterrupt:
        dev_server.stop_all_services()