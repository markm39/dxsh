# Docker Deployment Guide

This guide covers deploying Dxsh using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ available RAM
- 10GB+ available disk space

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/dxsh.git
cd dxsh
```

### 2. Configure Environment

Copy the example environment files:

```bash
cp .env.example .env
cp services/workflow-engine/.env.example services/workflow-engine/.env
cp services/dashboard-service/.env.example services/dashboard-service/.env
cp services/workflow-frontend/.env.example services/workflow-frontend/.env
cp services/dashboard-frontend/.env.example services/dashboard-frontend/.env
```

### 3. Start All Services

```bash
docker-compose -f docker-compose.microservices.yml up -d
```

This will:
- Build all service images
- Start PostgreSQL database
- Run database migrations
- Start all microservices

### 4. Access the Applications

- Workflow Builder: http://localhost:3000
- Dashboard: http://localhost:3001
- API Documentation: http://localhost:8001/docs

## Service Architecture

The Docker Compose setup includes:

- **postgres**: PostgreSQL database
- **api-gateway**: Central API routing (port 8001)
- **workflow-engine**: Workflow execution service (port 8000)
- **dashboard-service**: Dashboard management (port 8002)
- **workflow-frontend**: Workflow builder UI (port 3000)
- **dashboard-frontend**: Dashboard UI (port 3001)

## Configuration

### Essential Environment Variables

In the root `.env` file:
```env
# Database
POSTGRES_USER=workflow_user
POSTGRES_PASSWORD=workflow_password
POSTGRES_DB=workflow_engine

# Security
JWT_SECRET=your-secret-key-here

# URLs (for production, change these)
API_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:3001
```

### Production Configuration

For production deployments:

1. **Use strong passwords**:
```env
POSTGRES_PASSWORD=strong-random-password
JWT_SECRET=long-random-secret-key
```

2. **Configure external URLs**:
```env
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
DASHBOARD_URL=https://dashboard.yourdomain.com
```

3. **Enable HTTPS** (use a reverse proxy like nginx)

## Common Operations

### View Logs

```bash
# All services
docker-compose -f docker-compose.microservices.yml logs -f

# Specific service
docker-compose -f docker-compose.microservices.yml logs -f workflow-engine
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.microservices.yml restart

# Restart specific service
docker-compose -f docker-compose.microservices.yml restart api-gateway
```

### Stop Services

```bash
docker-compose -f docker-compose.microservices.yml down
```

### Update Services

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.microservices.yml up -d --build
```

## Database Management

### Backup Database

```bash
docker-compose -f docker-compose.microservices.yml exec postgres \
  pg_dump -U workflow_user workflow_engine > backup.sql
```

### Restore Database

```bash
docker-compose -f docker-compose.microservices.yml exec -T postgres \
  psql -U workflow_user workflow_engine < backup.sql
```

### Run Migrations

```bash
# Workflow engine migrations
docker-compose -f docker-compose.microservices.yml exec workflow-engine \
  alembic upgrade head

# Dashboard service migrations  
docker-compose -f docker-compose.microservices.yml exec dashboard-service \
  alembic upgrade head
```

## Scaling Services

Scale individual services for better performance:

```bash
# Scale workflow engine to 3 instances
docker-compose -f docker-compose.microservices.yml up -d --scale workflow-engine=3
```

## Monitoring

### Health Checks

Services include health check endpoints:
- API Gateway: http://localhost:8001/health
- Workflow Engine: http://localhost:8000/health
- Dashboard Service: http://localhost:8002/health

### Resource Usage

```bash
docker stats
```

## Troubleshooting

### Container Won't Start

Check logs for the specific service:
```bash
docker-compose -f docker-compose.microservices.yml logs service-name
```

### Database Connection Issues

1. Verify PostgreSQL is running:
```bash
docker-compose -f docker-compose.microservices.yml ps postgres
```

2. Check database exists:
```bash
docker-compose -f docker-compose.microservices.yml exec postgres \
  psql -U workflow_user -l
```

### Port Conflicts

If ports are already in use, either:
1. Stop conflicting services
2. Change ports in docker-compose.microservices.yml

### Permission Issues

If you encounter permission errors:
```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Or run with sudo
sudo docker-compose -f docker-compose.microservices.yml up -d
```

## Production Deployment

### Using Docker Swarm

1. Initialize swarm:
```bash
docker swarm init
```

2. Deploy stack:
```bash
docker stack deploy -c docker-compose.microservices.yml dxsh
```

### Using Kubernetes

See the Kubernetes deployment guide (coming soon).

### Reverse Proxy Setup

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name app.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Security Considerations

1. **Change default passwords** in production
2. **Use HTTPS** for all external traffic
3. **Restrict database access** to internal network
4. **Regular backups** of PostgreSQL data
5. **Monitor logs** for suspicious activity
6. **Keep Docker images updated**

## Maintenance

### Regular Updates

```bash
# Update base images
docker-compose -f docker-compose.microservices.yml pull

# Rebuild with latest code
docker-compose -f docker-compose.microservices.yml up -d --build
```

### Cleanup

Remove unused images and volumes:
```bash
docker system prune -a
```