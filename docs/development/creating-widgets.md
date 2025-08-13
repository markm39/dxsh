# Creating Custom Dashboard Widgets

This guide explains how to create custom widgets for the dashboard system.

## Widget Structure

Widgets consist of:
1. A React component that renders the widget
2. Configuration that defines widget properties
3. Backend endpoint for data (if needed)

## Creating a Widget Component

### 1. Create the Widget Component

Create a new file in `services/dashboard-frontend/src/widgets/`:

```typescript
// services/dashboard-frontend/src/widgets/MyCustomWidget.tsx
import React from 'react';
import { BaseWidget } from './BaseWidget';
import { WidgetProps } from '../types/widget';

export const MyCustomWidget: React.FC<WidgetProps> = ({ 
  config, 
  data, 
  isEditMode,
  onUpdate 
}) => {
  // Widget rendering logic
  const { title, settings } = config;
  
  return (
    <BaseWidget title={title} isEditMode={isEditMode}>
      <div className="p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-4">
          {/* Your widget content */}
          <p>Value: {data?.value || 'No data'}</p>
        </div>
      </div>
    </BaseWidget>
  );
};
```

### 2. Define Widget Configuration

```typescript
// services/dashboard-frontend/src/widgets/MyCustomWidget.tsx (continued)

export const MyCustomWidgetConfig = {
  type: 'my_custom',
  name: 'My Custom Widget',
  description: 'A custom widget for displaying data',
  category: 'display',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  settings: [
    {
      id: 'dataSource',
      label: 'Data Source',
      type: 'select',
      options: ['workflow', 'manual', 'api'],
      default: 'workflow'
    },
    {
      id: 'refreshInterval',
      label: 'Refresh Interval (seconds)',
      type: 'number',
      default: 60,
      min: 10
    }
  ]
};
```

### 3. Register the Widget

Add to `services/dashboard-frontend/src/widgets/index.ts`:

```typescript
import { MyCustomWidget, MyCustomWidgetConfig } from './MyCustomWidget';

export const widgetComponents = {
  // ... existing widgets ...
  my_custom: MyCustomWidget,
};

export const widgetConfigs = {
  // ... existing configs ...
  my_custom: MyCustomWidgetConfig,
};
```

## Widget Categories

Standard widget categories:
- `display` - Charts, graphs, visualizations
- `metric` - Single values, KPIs
- `table` - Data tables and lists
- `control` - Interactive controls
- `text` - Text and markdown content

## Widget Props

All widgets receive these props:

```typescript
interface WidgetProps {
  id: string;                    // Widget instance ID
  config: WidgetConfig;          // Widget configuration
  data: any;                     // Widget data
  isEditMode: boolean;           // Edit mode flag
  onUpdate: (updates: any) => void;  // Update callback
  onRemove: () => void;          // Remove callback
}
```

## Common Widget Patterns

### 1. Chart Widget

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export const ChartWidget: React.FC<WidgetProps> = ({ config, data }) => {
  const chartData = data?.points || [];
  
  return (
    <BaseWidget title={config.title}>
      <LineChart width={400} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="y" stroke="#8884d8" />
      </LineChart>
    </BaseWidget>
  );
};
```

### 2. Metric Widget

```typescript
export const MetricWidget: React.FC<WidgetProps> = ({ config, data }) => {
  const value = data?.value || 0;
  const change = data?.change || 0;
  
  return (
    <BaseWidget title={config.title}>
      <div className="text-center p-4">
        <div className="text-3xl font-bold">{value}</div>
        <div className={`text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
        </div>
      </div>
    </BaseWidget>
  );
};
```

### 3. Table Widget

```typescript
export const TableWidget: React.FC<WidgetProps> = ({ config, data }) => {
  const rows = data?.rows || [];
  const columns = config.settings?.columns || [];
  
  return (
    <BaseWidget title={config.title}>
      <table className="w-full">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.id}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.id}>{row[col.id]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </BaseWidget>
  );
};
```

## Data Sources

### 1. Workflow Data

Connect to workflow execution results:

```typescript
// In widget settings
{
  id: 'workflowId',
  label: 'Source Workflow',
  type: 'workflow-select'
}

// Data will be automatically fetched from workflow results
```

### 2. API Data

Fetch from external APIs:

```typescript
// In widget component
useEffect(() => {
  if (config.settings?.apiUrl) {
    fetch(config.settings.apiUrl)
      .then(res => res.json())
      .then(data => onUpdate({ data }));
  }
}, [config.settings?.apiUrl]);
```

### 3. Real-time Data

Use WebSocket for live updates:

```typescript
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:8001/ws/${widgetId}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onUpdate({ data });
  };
  
  return () => ws.close();
}, [widgetId]);
```

## Widget Settings

### Setting Types

- `string` - Text input
- `number` - Numeric input
- `boolean` - Toggle switch
- `select` - Dropdown menu
- `color` - Color picker
- `json` - JSON editor
- `workflow-select` - Workflow selector

### Dynamic Settings

```typescript
settings: [
  {
    id: 'chartType',
    label: 'Chart Type',
    type: 'select',
    options: ['line', 'bar', 'pie']
  },
  {
    id: 'xAxis',
    label: 'X Axis',
    type: 'select',
    // Options populated from data
    options: (data) => Object.keys(data?.[0] || {})
  }
]
```

## Styling Widgets

Use Tailwind CSS classes for consistent styling:

```typescript
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
    {title}
  </h3>
  <div className="mt-4 text-gray-600 dark:text-gray-300">
    {content}
  </div>
</div>
```

## Best Practices

### 1. Error Handling

```typescript
export const MyWidget: React.FC<WidgetProps> = ({ data, config }) => {
  if (!data) {
    return (
      <BaseWidget title={config.title}>
        <div className="text-center text-gray-500 p-4">
          No data available
        </div>
      </BaseWidget>
    );
  }
  
  try {
    // Render widget
  } catch (error) {
    return (
      <BaseWidget title={config.title}>
        <div className="text-red-500 p-4">
          Error: {error.message}
        </div>
      </BaseWidget>
    );
  }
};
```

### 2. Loading States

```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData().finally(() => setLoading(false));
}, []);

if (loading) {
  return <LoadingSpinner />;
}
```

### 3. Responsive Design

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid layout */}
</div>
```

## Testing Widgets

### 1. Component Tests

```typescript
// MyCustomWidget.test.tsx
import { render, screen } from '@testing-library/react';
import { MyCustomWidget } from './MyCustomWidget';

test('renders widget with title', () => {
  const props = {
    config: { title: 'Test Widget' },
    data: { value: 42 }
  };
  
  render(<MyCustomWidget {...props} />);
  expect(screen.getByText('Test Widget')).toBeInTheDocument();
  expect(screen.getByText('Value: 42')).toBeInTheDocument();
});
```

### 2. Integration Testing

1. Add widget to a dashboard
2. Configure settings
3. Verify data display
4. Test interactivity

## Deployment

After creating your widget:

1. Build the dashboard-frontend service
2. The widget will appear in the widget selector
3. Test in various dashboard layouts
4. Verify embed functionality works

## Examples

See existing widgets for reference:
- `ChartWidget.tsx` - Data visualization
- `MetricWidget.tsx` - KPI display
- `TableWidget.tsx` - Data tables
- `TextWidget.tsx` - Rich text content