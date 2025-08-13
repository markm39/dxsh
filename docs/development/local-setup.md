# Local Development Setup

This guide covers how to run Dxsh locally for development.

## Prerequisites

- Python 3.9+
- Node.js 18+
- Git

## Quick Start

### Using the Development Script (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/dxsh.git
cd dxsh

# Run the development setup script
./start-dev.sh
```

The `start-dev.sh` script will:

- Create Python virtual environments
- Install all dependencies
- Set up environment files
- Run database migrations
- Start all services

### Manual Setup

If you prefer to set up services manually:

1. **Set up the database**

```bash
createdb workflow_engine
```

2. **Configure environment files**

```bash
cp .env.example .env
cp services/workflow-engine/.env.example services/workflow-engine/.env
cp services/dashboard-service/.env.example services/dashboard-service/.env
cp services/workflow-frontend/.env.example services/workflow-frontend/.env
cp services/dashboard-frontend/.env.example services/dashboard-frontend/.env
```

3. **Run database migrations**

```bash
cd services/workflow-engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

cd ../dashboard-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

4. **Start services individually**

See the `start-dev.sh` script for the exact commands to run each service.

## Accessing the Applications

Once all services are running:

- Workflow Builder: http://localhost:3000
- Dashboard: http://localhost:3001
- API Documentation: http://localhost:8001/docs

## Creating Your First User

1. Open the Workflow Builder at http://localhost:3000
2. Click "Sign Up" to create a new account
3. Use the same credentials to access the Dashboard

## Service Ports

- API Gateway: 8001
- Workflow Engine: 8000
- Dashboard Service: 8002
- Workflow Frontend: 3000
- Dashboard Frontend: 3001

## Stopping Services

Use `Ctrl+C` in each terminal window or run:

```bash
./stop-dev.sh
```

## Troubleshooting

### Database Connection Error

- Verify the database "workflow_engine" exists
- Check DATABASE_URL in .env files

### Port Already in Use

- Stop any services using the required ports
- Or change the port in the service configuration

### Frontend Won't Load

- Ensure all backend services are running first
- Check browser console for errors
- Verify API_BASE_URL in frontend .env files
