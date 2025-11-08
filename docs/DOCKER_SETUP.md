# Docker Setup Guide for Dxsh

This comprehensive guide covers everything you need to know about running Dxsh with Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [Docker Compose Configurations](#docker-compose-configurations)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)
- [Troubleshooting Docker](#troubleshooting-docker)
- [Advanced Configuration](#advanced-configuration)

## Prerequisites

### Required Software

1. **Docker** (version 20.10 or higher)
   ```bash
   # Check Docker version
   docker --version

   # Install Docker (Ubuntu/Debian)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Add your user to docker group (avoid sudo)
   sudo usermod -aG docker $USER
   newgrp docker
   ```

2. **Docker Compose** (version 2.0 or higher)
   ```bash
   # Check Docker Compose version
   docker-compose --version

   # Docker Compose usually comes with Docker Desktop
   # For Linux, install separately:
   sudo apt-get install docker-compose-plugin
   ```

3. **System Requirements**
   - CPU: 4+ cores recommended
   - RAM: 8GB minimum, 16GB recommended
   - Disk: 20GB free space minimum
   - OS: Linux, macOS, or Windows with WSL2

### Verify Installation

```bash
# Test Docker
docker run hello-world

# Test Docker Compose
docker-compose version
```

## Quick Start with Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/markm39/dxsh.git
cd dxsh
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Minimum required variables:**
```env
# OpenAI API Key (for AI features)
OPENAI_API_KEY=sk-your-key-here

# JWT Secret (generate a secure random string)
JWT_SECRET_KEY=your-secret-key-here

# Database (PostgreSQL in Docker)
DATABASE_URL=postgresql://workflow:workflow@postgres:5432/workflow_engine
```

### 3. Start All Services

```bash
# Build and start all services
docker-compose -f docker-compose.microservices.yml up -d

# View logs
docker-compose -f docker-compose.microservices.yml logs -f

# Check service status
docker-compose -f docker-compose.microservices.yml ps
```

### 4. Access the Application

Once all services are running:

- **Workflow Builder**: http://localhost:3000
- **Dashboard Interface**: http://localhost:3001
- **API Gateway**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

### 5. Stop Services

```bash
# Stop all services
docker-compose -f docker-compose.microservices.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.microservices.yml down -v
```

## Docker Compose Configurations

Dxsh provides three Docker Compose configurations for different use cases:

### 1. Full Microservices (Recommended)

**File:** `docker-compose.microservices.yml`

**Includes:**
- PostgreSQL database
- Redis cache
- API Gateway
- Workflow Engine
- Dashboard Service
- Workflow Frontend
- Dashboard Frontend

**Use case:** Complete production-ready deployment

```bash
docker-compose -f docker-compose.microservices.yml up -d
```

### 2. Workflow Engine Only

**File:** `docker-compose.engine-only.yml`

**Includes:**
- PostgreSQL database
- Workflow Engine service
- Workflow Frontend

**Use case:** Running just the workflow builder

```bash
docker-compose -f docker-compose.engine-only.yml up -d
```

### 3. Dashboard Only

**File:** `docker-compose.dashboard-only.yml`

**Includes:**
- PostgreSQL database
- Dashboard Service
- Dashboard Frontend

**Use case:** Running just the dashboard system

```bash
docker-compose -f docker-compose.dashboard-only.yml up -d
```

## Environment Variables

### Essential Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://workflow:workflow@postgres:5432/workflow_engine` | Yes |
| `JWT_SECRET_KEY` | Secret for JWT token generation | - | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | - | No* |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` | Yes |

*Required for AI-powered workflow nodes

### Service-Specific Variables

**API Gateway:**
```env
WORKFLOW_ENGINE_URL=http://workflow-engine:5000
DASHBOARD_SERVICE_URL=http://dashboard-service:5000
WORKFLOW_FRONTEND_URL=http://workflow-frontend:3000
DASHBOARD_FRONTEND_URL=http://dashboard-frontend:3000
```

**Frontend Services:**
```env
VITE_API_BASE_URL=http://localhost:8001
VITE_WORKFLOW_API_URL=http://localhost:8001
VITE_APP_NAME=Dxsh Workflow Builder
VITE_NODE_ENV=production
```

### Security Variables

```env
# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# JWT Configuration
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

## Production Deployment

### 1. Security Hardening

**Update docker-compose.microservices.yml for production:**

```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # Use strong password from .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  api-gateway:
    environment:
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - CORS_ORIGINS=${PRODUCTION_CORS_ORIGINS}
    restart: always
```

**Production .env:**
```env
# Strong credentials
POSTGRES_PASSWORD=<generate-strong-password>
JWT_SECRET_KEY=<generate-secure-random-string-256-bits>

# Production URLs
CORS_ORIGINS=https://yourdomain.com,https://dashboard.yourdomain.com
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 2. Use Docker Secrets (Recommended)

```bash
# Create secrets
echo "your-db-password" | docker secret create db_password -
echo "your-jwt-secret" | docker secret create jwt_secret -

# Update docker-compose.yml to use secrets
```

```yaml
services:
  api-gateway:
    secrets:
      - jwt_secret
      - db_password
    environment:
      - JWT_SECRET_KEY_FILE=/run/secrets/jwt_secret

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

### 3. Enable HTTPS with Nginx Reverse Proxy

**Create nginx configuration:**

```nginx
# /etc/nginx/sites-available/dxsh
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. Set Resource Limits

```yaml
services:
  workflow-engine:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    restart: unless-stopped
```

### 5. Configure Logging

```yaml
services:
  api-gateway:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 6. Database Backups

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec dxsh-postgres pg_dump -U workflow workflow_engine > backup_$DATE.sql

# Compress
gzip backup_$DATE.sql

# Upload to S3 or backup storage
aws s3 cp backup_$DATE.sql.gz s3://your-backup-bucket/
```

**Add to crontab:**
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

## Troubleshooting Docker

### Common Issues

#### 1. Services Not Starting

**Check logs:**
```bash
docker-compose -f docker-compose.microservices.yml logs api-gateway
docker-compose -f docker-compose.microservices.yml logs workflow-engine
```

**Check service health:**
```bash
docker-compose -f docker-compose.microservices.yml ps
```

**Restart specific service:**
```bash
docker-compose -f docker-compose.microservices.yml restart api-gateway
```

#### 2. Port Conflicts

**Error:** `Bind for 0.0.0.0:8001 failed: port is already allocated`

**Solution:**
```bash
# Find process using the port
lsof -i :8001

# Kill the process or change port in docker-compose.yml
```

#### 3. Database Connection Issues

**Error:** `could not connect to server: Connection refused`

**Solution:**
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Check PostgreSQL logs
docker-compose -f docker-compose.microservices.yml logs postgres

# Restart PostgreSQL
docker-compose -f docker-compose.microservices.yml restart postgres
```

#### 4. Build Failures

**Error:** Build fails during `docker-compose up`

**Solution:**
```bash
# Rebuild from scratch
docker-compose -f docker-compose.microservices.yml build --no-cache

# Check Dockerfile in failing service
docker build -t test services/workflow-engine/

# View build logs
docker-compose -f docker-compose.microservices.yml up --build
```

#### 5. Out of Disk Space

```bash
# Clean up unused containers, images, and volumes
docker system prune -a --volumes

# Check disk usage
docker system df
```

#### 6. Playwright Browser Issues in Docker

**Error:** Playwright fails to launch browser

**Solution:** The Dockerfile already includes necessary dependencies. If issues persist:

```bash
# Rebuild the workflow-engine service
docker-compose -f docker-compose.microservices.yml build --no-cache workflow-engine
docker-compose -f docker-compose.microservices.yml up -d workflow-engine
```

### Health Checks

All services include health checks. Monitor them:

```bash
# View health status
docker-compose -f docker-compose.microservices.yml ps

# Service is healthy when status shows "(healthy)"
```

### Performance Monitoring

```bash
# View resource usage
docker stats

# View resource usage for specific service
docker stats dxsh-api-gateway
```

## Advanced Configuration

### Scaling Services

```bash
# Scale workflow engine to 3 instances
docker-compose -f docker-compose.microservices.yml up -d --scale workflow-engine=3

# Load balancer configuration needed for multiple instances
```

### Custom Networks

```yaml
networks:
  dxsh-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### External Database

To use an external PostgreSQL database instead of the Docker container:

1. Remove the `postgres` service from docker-compose.yml
2. Update `DATABASE_URL` to point to your external database:
   ```env
   DATABASE_URL=postgresql://user:password@external-host:5432/dbname
   ```

### Volume Management

**Backup volumes:**
```bash
# Backup PostgreSQL data
docker run --rm -v dxsh_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/postgres_backup.tar.gz /data
```

**Restore volumes:**
```bash
# Restore PostgreSQL data
docker run --rm -v dxsh_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/postgres_backup.tar.gz -C /
```

### Running Behind a Proxy

```yaml
services:
  api-gateway:
    environment:
      - HTTP_PROXY=http://proxy.example.com:8080
      - HTTPS_PROXY=http://proxy.example.com:8080
      - NO_PROXY=localhost,127.0.0.1
```

## Docker Compose Commands Reference

```bash
# Start services in detached mode
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down

# Restart a service
docker-compose restart [service-name]

# Rebuild services
docker-compose build [service-name]

# Execute command in running container
docker-compose exec [service-name] bash

# View running containers
docker-compose ps

# Remove stopped containers
docker-compose rm

# Pull latest images
docker-compose pull

# Validate configuration
docker-compose config
```

## Maintenance

### Regular Tasks

**Weekly:**
- Check disk space: `docker system df`
- Review logs for errors
- Test backups

**Monthly:**
- Update images: `docker-compose pull && docker-compose up -d`
- Clean unused resources: `docker system prune`
- Security scan: `docker scan [image-name]`

**Quarterly:**
- Review and rotate secrets
- Update Docker and Docker Compose
- Load testing and performance review

## Getting Help

If you encounter issues not covered in this guide:

1. Check logs: `docker-compose logs -f`
2. Check GitHub Issues: https://github.com/markm39/dxsh/issues
3. Join our Discord: https://discord.gg/m4g7suRu
4. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for general issues

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Dxsh Documentation](../README.md)
