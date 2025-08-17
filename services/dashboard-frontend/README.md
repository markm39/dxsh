# Dxsh Dashboard

A professional dashboard application for visualizing data from Dxsh. Built with React, TypeScript, and modern web technologies.

## Features

###  Core Features
- **Responsive Grid Layout**: Drag-and-drop widget positioning with React Grid Layout
- **Real-time Data**: Live updates from Dxsh via API polling
- **Multiple Widget Types**: Charts, metrics, tables, and more
- **Theme Support**: Light and dark themes with custom theme creation
- **Professional UI**: Built with Tailwind CSS and modern design principles

###  Widget Types
- **Chart Widgets**: Line, bar, pie charts using Recharts
- **Metric Widgets**: KPIs with trend indicators and thresholds
- **Table Widgets**: Data tables with sorting and filtering *(coming soon)*
- **Text Widgets**: Markdown and HTML content *(coming soon)*
- **Model Interface Widgets**: ML model prediction interfaces *(coming soon)*

###  Dashboard Management
- **Edit Mode**: Drag, resize, and configure widgets
- **Real-time Preview**: See changes instantly
- **Auto-save**: Automatic saving of layout changes
- **Export/Import**: Dashboard configuration management *(coming soon)*

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3001
```

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment
```bash
# Build image
docker build -t workflow-dashboard .

# Run container
docker run -p 3001:3000 \
  -e WORKFLOW_API_URL=http://your-workflow-engine:5000 \
  workflow-dashboard
```

## Configuration

### Environment Variables
```bash
# Required: Workflow Engine API URL
VITE_WORKFLOW_API_URL=http://localhost:5000

# Optional: API Key for authentication
VITE_WORKFLOW_API_KEY=your-api-key

# Runtime configuration (Docker)
WORKFLOW_API_URL=http://workflow-engine:5000
```

### Dashboard Configuration
Dashboards are configured via JSON with the following structure:

```json
{
  "id": "dashboard-1",
  "name": "Sales Dashboard",
  "description": "Real-time sales metrics and analytics",
  "widgets": [
    {
      "id": "chart-1",
      "type": "chart",
      "title": "Sales Trends",
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "dataSource": {
        "agentId": 1,
        "nodeId": "sales-data-node",
        "refreshOnWorkflowComplete": true
      },
      "config": {
        "chartType": "line",
        "xAxis": "date",
        "yAxis": "sales",
        "showLegend": true
      }
    }
  ]
}
```

## Widget Development

### Creating Custom Widgets
1. Create widget component in `src/components/widgets/`
2. Add configuration types to `shared/types/dashboard.ts`
3. Register widget in `WidgetRenderer.tsx`
4. Add to widget palette in editor

### Widget Data Flow
```
Workflow Engine → API Service → useWidgetData Hook → Widget Component
```

## API Integration

### Endpoints Used
```
GET  /api/v1/dashboards/:id
PUT  /api/v1/dashboards/:id
GET  /api/v1/nodes/:nodeId/output
GET  /api/v1/agents/:agentId/latest-execution
```

### Data Format
Widgets expect data in specific formats:
- **Charts**: Array of objects with x/y values
- **Metrics**: Object with numeric values
- **Tables**: Array of row objects

## Testing

### Unit Tests
```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### E2E Tests
```bash
# Run Playwright tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

## Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, Headless UI
- **Charts**: Recharts
- **Layout**: React Grid Layout
- **State**: Zustand, React Query
- **Testing**: Vitest, Playwright, Testing Library

### Project Structure
```
dashboard/
 src/
    components/          # Reusable components
       widgets/        # Widget implementations
       grid/           # Grid layout components
    hooks/              # Custom React hooks
    pages/              # Route components
    providers/          # Context providers
    services/           # API services
    test/              # Test utilities
 public/                 # Static assets
 dist/                  # Production build
```

### Data Flow
```
Dashboard Provider → Grid Layout → Widget Container → Widget Renderer → Specific Widget
                 ↓
            useWidgetData Hook → API Service → Workflow Engine
```

## Deployment

### Standalone Deployment
The dashboard can be deployed independently of the main workflow application:

```bash
# Build and deploy to any static hosting
npm run build
# Deploy dist/ folder to Netlify, Vercel, etc.
```

### Docker Deployment
```bash
# Using docker-compose (includes backend)
docker-compose up dashboard

# Standalone container
docker run -p 3001:3000 \
  -e WORKFLOW_API_URL=https://your-api.com \
  workflow-dashboard
```

### Production Considerations
- Configure reverse proxy for API calls
- Set up proper CORS on workflow engine
- Use environment-specific API URLs
- Enable gzip compression
- Set up monitoring and logging

## Performance

### Optimization Features
- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Components loaded on demand
- **Data Caching**: React Query with smart invalidation
- **Virtual Scrolling**: For large datasets *(coming soon)*
- **Debounced Updates**: Prevents excessive re-renders

### Monitoring
- Web Vitals tracking in production
- Error boundary for graceful error handling
- Health check endpoints
- Performance budgets in build process

## Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Make changes and test
5. Run tests: `npm run test`
6. Submit pull request

### Code Quality
- TypeScript strict mode enabled
- ESLint + Prettier configuration
- Pre-commit hooks for code quality
- Test coverage requirements
- Component documentation

## License

This project is part of the Workflow Engine ecosystem. See the main project for license details.

---

For more information, see the [main project README](../README.md) or visit the [documentation](../docs/).