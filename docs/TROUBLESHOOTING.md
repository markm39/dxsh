# Dxsh Troubleshooting Guide

This guide helps you resolve common issues when setting up and running Dxsh locally.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Service Startup Problems](#service-startup-problems)
- [Database Connection Errors](#database-connection-errors)
- [Frontend Build Errors](#frontend-build-errors)
- [API and CORS Issues](#api-and-cors-issues)
- [Python Environment Issues](#python-environment-issues)
- [Node.js and npm Issues](#nodejs-and-npm-issues)
- [Playwright Browser Issues](#playwright-browser-issues)

## Installation Issues

### Python Version Incompatibility

**Problem:** Error messages about Python version when running `start-dev.sh`

**Solution:**
```bash
# Check your Python version
python3 --version

# Dxsh requires Python 3.9 or higher
# Install Python 3.11 (recommended):
# Ubuntu/Debian:
sudo apt update
sudo apt install python3.11 python3.11-venv

# macOS (using Homebrew):
brew install python@3.11
```

### Node.js Version Incompatibility

**Problem:** npm errors or build failures

**Solution:**
```bash
# Check your Node.js version
node --version

# Dxsh requires Node.js 18 or higher
# Install Node.js 18+ using nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

## Service Startup Problems

### Services Won't Start

**Problem:** Running `start-dev.sh` but services don't start

**Solution:**

1. Check if ports are already in use:
```bash
# Check which process is using port 8000, 8001, 8002, 3000, or 3001
lsof -i :8000
lsof -i :8001
lsof -i :8002
lsof -i :3000
lsof -i :3001

# Kill the process if needed
kill -9 <PID>
```

2. Check service logs for errors:
```bash
tail -f workflow-engine.log
tail -f api-gateway.log
tail -f dashboard-service.log
tail -f workflow-frontend.log
tail -f dashboard-frontend.log
```

3. Ensure all dependencies are installed:
```bash
# For Python services
cd services/workflow-engine
source venv/bin/activate
pip install -r requirements.txt

# For Node services
cd services/workflow-frontend
npm install
```

### Virtual Environment Activation Fails

**Problem:** `source venv/bin/activate` doesn't work

**Solution:**
```bash
# Remove the corrupted venv and recreate it
cd services/workflow-engine
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Database Connection Errors

### SQLite Database Lock

**Problem:** `database is locked` error

**Solution:**
```bash
# Stop all services first
./stop-dev.sh

# Remove the lock file
rm -f workflow_engine.db-journal

# Restart services
./start-dev.sh
```

### Database Schema Issues

**Problem:** Errors about missing tables or columns

**Solution:**
```bash
# Delete the database and let it recreate
rm -f workflow_engine.db
./start-dev.sh
```

### PostgreSQL Connection Refused (Docker)

**Problem:** Can't connect to PostgreSQL when using Docker

**Solution:**
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# If not running, start Docker Compose
docker-compose -f docker-compose.microservices.yml up -d postgres

# Check PostgreSQL logs
docker-compose -f docker-compose.microservices.yml logs postgres
```

## Frontend Build Errors

### Vite Build Fails

**Problem:** `npm run build` fails with errors

**Solution:**
```bash
# Clear npm cache and reinstall
cd services/workflow-frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build
```

### TypeScript Errors

**Problem:** TypeScript compilation errors

**Solution:**
```bash
# Make sure you have the latest dependencies
npm install

# Check tsconfig.json is present
ls -la tsconfig.json

# Try running type check
npm run type-check
```

### Missing Environment Variables

**Problem:** `VITE_API_BASE_URL is undefined` errors

**Solution:**
```bash
# Create .env file in the frontend directory
cd services/workflow-frontend
cat > .env << EOF
VITE_API_BASE_URL=http://localhost:8001
VITE_APP_NAME=Dxsh Workflow Builder
VITE_NODE_ENV=development
EOF
```

## API and CORS Issues

### CORS Errors in Browser

**Problem:** Browser console shows CORS policy errors

**Solution:**

1. Ensure API Gateway is running on port 8001:
```bash
curl http://localhost:8001/health
```

2. Check CORS configuration in `services/api-gateway/src/main.py`:
   - Verify `CORS_ORIGINS` includes your frontend URL
   - Default should include `http://localhost:3000` and `http://localhost:3001`

3. Clear browser cache and hard reload (Ctrl+Shift+R)

### 404 Not Found Errors

**Problem:** API requests returning 404

**Solution:**

1. Check API Gateway is routing correctly:
```bash
curl http://localhost:8001/api/v1/workflows
```

2. Verify service URLs are correct:
```bash
# Should see services running
curl http://localhost:8000/health  # Workflow Engine
curl http://localhost:8002/health  # Dashboard Service
```

3. Check logs for routing errors:
```bash
tail -f api-gateway.log | grep ERROR
```

## Python Environment Issues

### ModuleNotFoundError

**Problem:** `ModuleNotFoundError: No module named 'xxx'`

**Solution:**
```bash
# Make sure virtual environment is activated
cd services/workflow-engine
source venv/bin/activate

# Reinstall requirements
pip install -r requirements.txt

# Verify installation
pip list | grep <module-name>
```

### pip Install Fails

**Problem:** Errors when running `pip install`

**Solution:**
```bash
# Upgrade pip first
pip install --upgrade pip setuptools wheel

# Install with verbose output to see what's failing
pip install -r requirements.txt -v

# If specific package fails, try installing it separately
pip install <package-name>
```

### Import Errors

**Problem:** `ImportError` or `ModuleNotFoundError` when running services

**Solution:**
```bash
# Set PYTHONPATH correctly
export PYTHONPATH=/app

# Or run from the service directory with -m flag
cd services/workflow-engine
source venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## Node.js and npm Issues

### npm Install Fails

**Problem:** Errors during `npm install`

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# If still failing, try using --legacy-peer-deps
npm install --legacy-peer-deps
```

### Module Resolution Errors

**Problem:** `Cannot find module` errors

**Solution:**
```bash
# Check if node_modules exists
ls -la node_modules

# Reinstall if missing modules
npm install

# For TypeScript path mapping issues, check tsconfig.json
```

### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find and kill the process using the port
lsof -ti:3000 | xargs kill -9

# Or change the port in package.json dev script
npm run dev -- --port 3002
```

## Playwright Browser Issues

### Playwright Browser Not Installed

**Problem:** `browserType.launch: Executable doesn't exist` errors

**Solution:**
```bash
# Activate virtual environment
cd services/workflow-engine
source venv/bin/activate

# Install Playwright browsers
playwright install chromium

# Install system dependencies (Linux)
playwright install-deps
```

### Playwright Fails in Headless Mode

**Problem:** Playwright crashes or times out

**Solution:**
```bash
# Install required system libraries (Ubuntu/Debian)
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2
```

### Permission Denied for Playwright

**Problem:** Permission errors when running Playwright

**Solution:**
```bash
# Fix permissions for Playwright directory
chmod -R 755 ~/.cache/ms-playwright/

# Or reinstall Playwright
pip uninstall playwright
pip install playwright
playwright install chromium
```

## General Debugging Tips

### Enable Debug Logging

**Python Services:**
```bash
# Set environment variable for debug logging
export LOG_LEVEL=DEBUG
```

**Frontend:**
```bash
# Enable Vite debug mode
export DEBUG=vite:*
npm run dev
```

### Check All Services Status

```bash
# Quick health check for all services
curl http://localhost:8000/health && echo " - Workflow Engine OK" || echo " - Workflow Engine FAIL"
curl http://localhost:8001/health && echo " - API Gateway OK" || echo " - API Gateway FAIL"
curl http://localhost:8002/health && echo " - Dashboard Service OK" || echo " - Dashboard Service FAIL"
curl http://localhost:3000 && echo " - Workflow Frontend OK" || echo " - Workflow Frontend FAIL"
curl http://localhost:3001 && echo " - Dashboard Frontend OK" || echo " - Dashboard Frontend FAIL"
```

### Clean Restart

```bash
# Stop everything
./stop-dev.sh

# Clean up logs and temp files
rm -f *.log *.pid

# Restart
./start-dev.sh
```

### Complete Reset

```bash
# WARNING: This will delete all data and reinstall everything

# Stop services
./stop-dev.sh

# Remove virtual environments
rm -rf services/*/venv

# Remove node_modules
rm -rf services/*/node_modules

# Remove database
rm -f workflow_engine.db

# Remove logs
rm -f *.log

# Restart (will reinstall everything)
./start-dev.sh
```

## Still Having Issues?

If you're still experiencing problems:

1. Check GitHub Issues: https://github.com/markm39/dxsh/issues
2. Join our Discord: https://discord.gg/m4g7suRu
3. Create a new issue with:
   - Your operating system and version
   - Python and Node.js versions
   - Full error messages
   - Steps to reproduce the problem
   - Relevant log files

## Common Error Messages Reference

| Error Message | Likely Cause | Quick Fix |
|---------------|--------------|-----------|
| `Port already in use` | Another service using the port | `lsof -ti:PORT \| xargs kill -9` |
| `ModuleNotFoundError` | Missing Python package | `pip install <package>` |
| `Cannot find module` | Missing npm package | `npm install` |
| `database is locked` | SQLite lock file | Stop services, remove .db-journal |
| `CORS policy error` | Frontend can't reach API | Check API Gateway CORS config |
| `Connection refused` | Service not running | Check service status and logs |
| `Playwright executable not found` | Browser not installed | `playwright install chromium` |
| `Permission denied` | File/directory permissions | `chmod` or run with proper user |
| `Out of memory` | Insufficient RAM | Increase system memory or swap |
| `TypeScript compilation error` | Type errors in code | Fix types or use `@ts-ignore` |
