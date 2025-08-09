# Dashboard System Architecture

## Overview

The Dashboard System is a standalone React application that connects to the Workflow Engine to create customizable, real-time data visualization dashboards.

## Architecture Principles

### 1. Microservices Design
- **Workflow Engine**: Backend data processing service (Port 5000)
- **Dashboard App**: Frontend visualization service (Port 3001)
- **Shared Types**: Common TypeScript definitions
- **Independent Deployment**: Each service can be deployed separately

### 2. Technology Stack

**Dashboard Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Grid Layout (drag-and-drop grid)
- Recharts (data visualization)
- Zustand (state management)
- React Query (data fetching)

**Testing Stack:**
- Vitest (unit testing)
- React Testing Library (component testing)
- Playwright (E2E testing)
- MSW (API mocking)

### 3. Data Flow

```
┌─────────────────┐    HTTP/WS    ┌─────────────────┐
│ Workflow Engine │◄─────────────►│ Dashboard App   │
│                 │               │                 │
│ - Execute nodes │               │ - Render widgets│
│ - Store results │               │ - Update layouts│
│ - Send updates  │               │ - Handle config │
└─────────────────┘               └─────────────────┘
```

## Core Components

### 1. Widget System
- **Chart Widgets**: Line, bar, pie, scatter plots
- **Data Widgets**: Tables, metrics, KPIs
- **Input Widgets**: Model interfaces, form controls
- **Text Widgets**: Markdown, HTML content

### 2. Layout System
- Grid-based responsive layout
- Drag-and-drop widget positioning
- Configurable widget sizes
- Layout persistence

### 3. Data Binding
- Connect widgets to workflow node outputs
- Real-time data updates
- Data transformation pipelines
- Error handling and fallbacks

### 4. Configuration Management
- JSON-based dashboard configs
- Environment-based API connections
- Theme and styling options
- Import/export capabilities

## API Design

### Dashboard Endpoints
```
GET    /api/v1/dashboards/:id
POST   /api/v1/dashboards
PUT    /api/v1/dashboards/:id
DELETE /api/v1/dashboards/:id

GET    /api/v1/dashboards/:id/widgets/:widgetId/data
POST   /api/v1/dashboards/:id/widgets
PUT    /api/v1/dashboards/:id/widgets/:widgetId
DELETE /api/v1/dashboards/:id/widgets/:widgetId
```

### Data Access Endpoints
```
GET /api/v1/agents/:agentId/latest-execution
GET /api/v1/nodes/:nodeId/output
GET /api/v1/executions/:executionId/results
```

### Real-time Updates
```
WebSocket: /ws/dashboard/:dashboardId
Server-Sent Events: /api/v1/dashboards/:id/stream
```

## Security Considerations

1. **API Authentication**: JWT tokens for dashboard access
2. **CORS Configuration**: Proper cross-origin setup
3. **Data Sanitization**: Clean node outputs before display
4. **Rate Limiting**: Prevent API abuse
5. **Input Validation**: Validate all configuration data

## Performance Optimizations

1. **Data Caching**: Cache node outputs and execution results
2. **Lazy Loading**: Load widgets on demand
3. **Virtual Scrolling**: Handle large datasets efficiently
4. **Debounced Updates**: Batch real-time updates
5. **Compression**: Gzip API responses

## Testing Strategy

1. **Unit Tests**: Individual components and utilities
2. **Integration Tests**: Widget-to-API communication
3. **E2E Tests**: Complete dashboard workflows
4. **Performance Tests**: Load and stress testing
5. **Visual Regression**: UI consistency testing

## Deployment Options

### Development
```bash
docker-compose up -d
# Workflow Engine: http://localhost:5000
# Dashboard: http://localhost:3001
```

### Production
```bash
# Option 1: Combined deployment
docker-compose -f docker-compose.prod.yml up -d

# Option 2: Separate deployment
docker build -t dashboard ./dashboard
docker run -p 3001:3000 -e VITE_WORKFLOW_API_URL=https://api.example.com dashboard
```

## Future Enhancements

1. **Dashboard Templates**: Pre-built industry-specific dashboards
2. **Custom Widgets**: Plugin system for custom components
3. **Collaboration**: Multi-user dashboard editing
4. **Mobile App**: React Native dashboard viewer
5. **Embedding**: iframe/widget embedding for external sites