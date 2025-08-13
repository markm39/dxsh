# Troubleshooting Guide

This guide helps resolve common issues when running Dxsh.

## Installation Issues

### Docker Compose Fails to Start

**Problem:** `docker-compose: command not found`

**Solution:**
```bash
# Install Docker Compose V2
docker compose version

# If not installed, download it
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### Port Already in Use

**Problem:** `Error starting userland proxy: bind: address already in use`

**Solution:**
1. Find what's using the port:
```bash
sudo lsof -i :3000  # Replace with the conflicting port
```

2. Either stop the service or change the port in `docker-compose.microservices.yml`

### Permission Denied Errors

**Problem:** `permission denied while trying to connect to the Docker daemon socket`

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

## Database Issues

### Database Connection Failed

**Problem:** `FATAL: database "workflow_engine" does not exist`

**Solution:**
1. Create the database manually:
```bash
docker-compose -f docker-compose.microservices.yml exec postgres \
  createdb -U workflow_user workflow_engine
```

2. Run migrations:
```bash
docker-compose -f docker-compose.microservices.yml exec workflow-engine \
  alembic upgrade head
```

### Migration Errors

**Problem:** `alembic.util.exc.CommandError: Can't locate revision identified by`

**Solution:**
1. Check current migration status:
```bash
docker-compose -f docker-compose.microservices.yml exec workflow-engine \
  alembic current
```

2. Reset migrations if needed:
```bash
docker-compose -f docker-compose.microservices.yml exec workflow-engine \
  alembic stamp head
```

### PostgreSQL Won't Start

**Problem:** `database system is shut down`

**Solution:**
1. Check PostgreSQL logs:
```bash
docker-compose -f docker-compose.microservices.yml logs postgres
```

2. Remove volume and restart:
```bash
docker-compose -f docker-compose.microservices.yml down
docker volume rm workflow-engine_postgres_data
docker-compose -f docker-compose.microservices.yml up -d
```

## Authentication Issues

### Cannot Login

**Problem:** `Invalid credentials` or `Authentication failed`

**Solution:**
1. Verify JWT_SECRET is the same across all services
2. Check that all services are running:
```bash
docker-compose -f docker-compose.microservices.yml ps
```
3. Clear browser cookies and try again

### Token Expired Errors

**Problem:** `JWT token has expired`

**Solution:**
1. Log out and log back in
2. Check token expiration settings in environment files
3. Ensure system time is synchronized

### CORS Errors

**Problem:** `Access to fetch at 'http://localhost:8001' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Solution:**
1. Update CORS_ORIGINS in API Gateway .env:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

2. Restart the API Gateway:
```bash
docker-compose -f docker-compose.microservices.yml restart api-gateway
```

## Frontend Issues

### Blank Page or Loading Forever

**Problem:** Frontend loads but shows blank page

**Solution:**
1. Check browser console for errors (F12)
2. Verify API_BASE_URL in frontend .env files
3. Ensure all backend services are running
4. Clear browser cache

### Cannot Connect to API

**Problem:** `Failed to fetch` or `Network error`

**Solution:**
1. Verify API Gateway is running:
```bash
curl http://localhost:8001/health
```

2. Check frontend environment variables:
```bash
cat services/workflow-frontend/.env
cat services/dashboard-frontend/.env
```

### Assets Not Loading

**Problem:** CSS or JavaScript files return 404

**Solution:**
1. Rebuild frontend services:
```bash
docker-compose -f docker-compose.microservices.yml up -d --build workflow-frontend dashboard-frontend
```

2. Check nginx configuration in Docker container

## Workflow Execution Issues

### Workflow Fails to Execute

**Problem:** Workflow shows error when running

**Solution:**
1. Check workflow-engine logs:
```bash
docker-compose -f docker-compose.microservices.yml logs -f workflow-engine
```

2. Verify node configuration is correct
3. Check data format between nodes

### Python Node Errors

**Problem:** `ModuleNotFoundError` in Python script node

**Solution:**
1. Add required packages to workflow-engine requirements.txt
2. Rebuild the service:
```bash
docker-compose -f docker-compose.microservices.yml up -d --build workflow-engine
```

### Memory Errors

**Problem:** `Container killed due to memory limit`

**Solution:**
1. Increase memory limits in docker-compose.microservices.yml:
```yaml
services:
  workflow-engine:
    mem_limit: 2g
```

2. Optimize workflow to process data in chunks

## Dashboard Issues

### Widgets Not Loading Data

**Problem:** Dashboard widgets show "No data available"

**Solution:**
1. Verify workflow execution completed successfully
2. Check dashboard-service logs
3. Ensure data source configuration is correct

### Embed Tokens Not Working

**Problem:** Embedded dashboards show authentication error

**Solution:**
1. Verify token hasn't expired
2. Check domain restrictions match
3. Ensure CORS is configured for embed domain

### Dashboard Layout Broken

**Problem:** Widgets overlap or don't display correctly

**Solution:**
1. Clear browser cache
2. Reset dashboard layout in settings
3. Check for JavaScript errors in console

## Performance Issues

### Slow Response Times

**Problem:** API requests take too long

**Solution:**
1. Check database query performance
2. Enable caching in services
3. Scale services horizontally:
```bash
docker-compose -f docker-compose.microservices.yml up -d --scale workflow-engine=3
```

### High Memory Usage

**Problem:** Services consuming too much memory

**Solution:**
1. Monitor with `docker stats`
2. Adjust memory limits in docker-compose
3. Implement pagination for large datasets

### Database Queries Slow

**Problem:** Dashboard or workflow queries timeout

**Solution:**
1. Add database indexes:
```sql
CREATE INDEX idx_workflow_user ON workflows(user_id);
CREATE INDEX idx_dashboard_user ON dashboards(user_id);
```

2. Optimize queries in code
3. Consider database connection pooling

## Docker Issues

### Containers Keep Restarting

**Problem:** Services show "Restarting" status

**Solution:**
1. Check logs for the failing service:
```bash
docker-compose -f docker-compose.microservices.yml logs service-name
```

2. Common causes:
   - Missing environment variables
   - Database connection issues
   - Port conflicts

### Disk Space Issues

**Problem:** `No space left on device`

**Solution:**
1. Clean up Docker:
```bash
docker system prune -a --volumes
```

2. Check disk usage:
```bash
df -h
docker system df
```

### Build Failures

**Problem:** `failed to solve with frontend dockerfile.v0`

**Solution:**
1. Update Docker to latest version
2. Clear build cache:
```bash
docker builder prune
```

3. Check Dockerfile syntax

## Getting Help

If you're still experiencing issues:

1. Check service logs for detailed error messages
2. Search existing GitHub issues
3. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Relevant log output