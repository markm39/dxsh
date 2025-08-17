# Dxsh Microservices Architecture

 **Migration Complete!** Dxsh has been successfully transformed from a monolithic architecture to a modern microservices platform.

##  Architecture Overview

```

                    CLIENT REQUEST                        

                     

              API GATEWAY (Port 5000)                    
  • Authentication & Authorization                       
  • Request Routing & Load Balancing                     
  • CORS Handling for Embeddings                         

                                                
        
WORKFLOW            DASHBOARD            BUILDER      
 ENGINE              SERVICE             SERVICE      
(Port 5001)  (Port 5002)         (Port 3000)    
                                                      
• 9 Node         • Dashboard CRUD    • Visual Builder 
  Executors      • Widget Mgmt       • React Frontend 
• Workflow       • Chart Gen         • Real-time UI   
  Execution      • Embed APIs                         
        
                                                
      
                           
              
                       DATABASE           
                    PostgreSQL +          
                       Redis              
              
```

##  Services

### 1. **API Gateway** (Port 5000)
- **Purpose**: Single entry point for all client requests
- **Tech**: FastAPI + Python
- **Features**: 
  - JWT authentication
  - Request routing to microservices  
  - CORS for iframe embedding
  - Rate limiting & logging

### 2. **Workflow Engine** (Port 5001)
- **Purpose**: Execute workflows and manage node operations
- **Tech**: FastAPI + Python
- **Features**:
  - All 9 node types (web scraping, AI processing, ML, etc.)
  - Workflow execution engine
  - Node data management
  - Background job processing

### 3. **Dashboard Service** (Port 5002)  
- **Purpose**: Dashboard and widget management
- **Tech**: FastAPI + Python
- **Features**:
  - Dashboard CRUD operations
  - Widget-to-node connections
  - AI-powered chart generation
  - Public embedding APIs (/embed)

### 4. **Builder Service** (Port 3000)
- **Purpose**: Visual workflow builder interface
- **Tech**: React + Vite + TypeScript
- **Features**:
  - Drag-and-drop workflow builder
  - Real-time execution monitoring
  - Node configuration interfaces
  - Dashboard connection tools

##  Deployment Modes

### Full Suite (Recommended for Development)
```bash
docker-compose -f docker-compose.microservices.yml up
```
- **Access**: Builder at http://localhost:3000, API at http://localhost:5000
- **Use Case**: Complete development environment with all features

### Engine-Only Mode (API-First)
```bash
docker-compose -f docker-compose.engine-only.yml up
```
- **Access**: Only API at http://localhost:5000
- **Use Case**: Headless workflow execution, integrations, serverless

### Dashboard-Only Mode (Embedding)
```bash
docker-compose -f docker-compose.dashboard-only.yml up
```
- **Access**: Dashboards and embedding at http://localhost:5000
- **Use Case**: Customer-facing embeds, dashboard hosting

##  Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repo>
   cd workflow-engine
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (OpenAI API key, etc.)
   ```

3. **Start All Services**
   ```bash
   docker-compose -f docker-compose.microservices.yml up --build
   ```

4. **Access Applications**
   - **Workflow Builder**: http://localhost:3000
   - **API Documentation**: http://localhost:5000/docs
   - **Health Checks**: http://localhost:5000/health

##  API Endpoints

### Workflow Engine (via API Gateway)
- `GET /v1/workflows` - List workflows
- `POST /v1/workflows/{id}/execute` - Execute workflow
- `GET /v1/executions/{id}/results` - Get execution results
- `GET /v1/nodes/library` - Available node types

### Dashboard Service (via API Gateway)
- `GET /v1/dashboards` - List dashboards
- `POST /v1/dashboards` - Create dashboard
- `GET /v1/dashboards/{id}/widgets` - Get widgets
- `GET /v1/embed/dashboards/{id}` - **Public embedding**

### Authentication
All requests require JWT token in Authorization header:
```bash
Authorization: Bearer <your-jwt-token>
```

**Exception**: `/v1/embed/*` endpoints are public for iframe embedding.

##  Embedding Dashboards

Embed dashboards in external websites using iframe:

```html
<iframe 
  src="http://localhost:5000/v1/embed/dashboards/123"
  width="800" 
  height="600"
  frameborder="0">
</iframe>
```

Or use the JavaScript API:
```html
<script src="http://localhost:5000/static/embed.js"></script>
<dxsh-widget widget-id="456" theme="dark"></dxsh-widget>
```

##  Development

### Service Dependencies
```bash
# Install backend dependencies
cd services/api-gateway && pip install -r requirements.txt
cd services/workflow-engine && pip install -r requirements.txt  
cd services/dashboard-service && pip install -r requirements.txt

# Install frontend dependencies
cd services/builder-service && npm install
```

### Running Individual Services
```bash
# API Gateway
cd services/api-gateway && uvicorn src.main:app --reload --port 5000

# Workflow Engine  
cd services/workflow-engine && uvicorn src.main:app --reload --port 5001

# Dashboard Service
cd services/dashboard-service && uvicorn src.main:app --reload --port 5002

# Builder Service
cd services/builder-service && npm run dev
```

##  Testing

```bash
# Test individual services
cd services/workflow-engine && pytest
cd services/dashboard-service && pytest  
cd services/api-gateway && pytest

# Integration testing
pytest integration_tests/

# End-to-end testing
cd services/builder-service && npm run test:e2e
```

##  Monitoring & Logs

```bash
# View logs for all services
docker-compose -f docker-compose.microservices.yml logs -f

# View specific service logs
docker-compose -f docker-compose.microservices.yml logs -f workflow-engine

# Health check all services
curl http://localhost:5000/health
```

##  Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for AI processing nodes
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for authentication
- `REDIS_URL`: Redis connection for job queues

### Service URLs (Internal)
- `WORKFLOW_ENGINE_URL=http://workflow-engine:5000`
- `DASHBOARD_SERVICE_URL=http://dashboard-service:5000`  
- `BUILDER_SERVICE_URL=http://builder-service:3000`

##  Migration Benefits

 **Independently deployable services**
 **Embeddable dashboards and widgets**  
 **API-first workflow execution**
 **Scalable microservice architecture**
 **100% functionality preservation**
 **Multiple deployment modes**
 **Clean service boundaries**

##  Troubleshooting

### Common Issues

**Service won't start**: Check health checks and dependencies
```bash
docker-compose -f docker-compose.microservices.yml ps
```

**API calls failing**: Verify API Gateway routing and authentication
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/v1/workflows
```

**Database connection issues**: Check PostgreSQL is running and accessible
```bash
docker-compose -f docker-compose.microservices.yml logs postgres
```

##  Support

- **Issues**: Open GitHub issue with service logs
- **Docs**: Full API documentation at `/docs` endpoints
- **Logs**: Use `docker-compose logs <service-name>`