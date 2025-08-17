# Model Widget System

A comprehensive, reusable system for creating interactive machine learning model interfaces with prediction forms, performance metrics, and visualizations.

## Overview

The Model Widget System provides a standardized way to create rich UIs for ML models, making them accessible to non-technical users while providing detailed insights for data scientists.

## Features

-  **Interactive Prediction Forms** - User-friendly input forms with validation
-  **Performance Metrics** - Model accuracy, coefficients, and training info
-  **Type Safety** - Full TypeScript support with comprehensive interfaces
-  **Reusable Components** - Modular architecture for different model types
-  **Configurable UI** - Customizable tabs and layout options
-  **Mock Data Support** - Built-in testing and development data
-  **Extensible** - Easy to add new model types
-  **Responsive** - Works on desktop and mobile devices

## Quick Start

```typescript
import { LinearRegressionWidget, createMockLinearRegressionWidget } from './model-widgets';

// Use with real data
function MyDashboard() {
  const handlePredict = async (inputs) => {
    const response = await fetch('/api/predict', {
      method: 'POST',
      body: JSON.stringify(inputs)
    });
    return response.json();
  };

  return (
    <LinearRegressionWidget
      modelData={myModelData}
      onPredict={handlePredict}
      config={{
        showPredictionForm: true,
        showPerformance: true,
        defaultTab: 'predict'
      }}
    />
  );
}

// Use with mock data for development
function DemoWidget() {
  const { widget: LinearRegressionDemo } = createMockLinearRegressionWidget();
  return <LinearRegressionDemo />;
}
```

## Architecture

### Core Components

```
model-widgets/
 types.ts                 # TypeScript interfaces and types
 components/
    BaseModelWidget.tsx  # Common tabbed interface
    PredictionForm.tsx   # Input form with validation
    PerformanceDisplay.tsx # Metrics and visualizations
 hooks/
    usePrediction.ts     # Prediction state management
    useModelValidation.ts # Input validation logic
 LinearRegressionWidget.tsx # Specialized implementation
 ModelWidgetDemo.tsx      # Development/testing component
 index.ts                 # Main exports
```

### Data Flow

```
User Input → Validation → API Call → Results Display
     ↓           ↓           ↓            ↓
PredictionForm → useModelValidation → onPredict → PredictionResult
```

## Model Data Structure

```typescript
interface ModelData {
  id: string;
  type: 'linearRegression' | 'randomForest' | 'neuralNetwork';
  name: string;
  description?: string;
  
  schema: {
    features: ModelFeature[];  // Input fields
    target: {                  // Output definition
      name: string;
      type: string;
      unit?: string;
    };
  };
  
  performance: {
    score: number;             // Primary metric (R², accuracy, etc.)
    r_squared?: number;        // Regression metrics
    mean_squared_error?: number;
    // ... other metrics
    
    training_info: {
      training_date: string;
      dataset_size: number;
      cross_validation_score?: number;
    };
  };
  
  model_data: {
    coefficients?: { [feature: string]: number };
    feature_importance?: { [feature: string]: number };
    // ... model-specific data
  };
  
  visualizations: ModelVisualization[];
}
```

## Feature Types

The system supports three input types with automatic validation:

### Number Fields
```typescript
{
  name: 'price',
  type: 'number',
  displayName: 'House Price',
  min: 0,
  max: 1000000,
  step: 1000,
  defaultValue: 200000,
  required: true
}
```

### Categorical Fields
```typescript
{
  name: 'location',
  type: 'categorical',
  displayName: 'Neighborhood',
  options: ['Downtown', 'Suburbs', 'Rural'],
  defaultOption: 'Suburbs',
  required: true
}
```

### Boolean Fields
```typescript
{
  name: 'hasGarage',
  type: 'boolean',
  displayName: 'Has Garage',
  defaultBoolean: false,
  required: false
}
```

## Widget Configuration

```typescript
interface WidgetConfig {
  showPredictionForm?: boolean;    // Show prediction tab
  showPerformance?: boolean;       // Show performance tab
  showVisualizations?: boolean;    // Show visualizations tab
  showExplanation?: boolean;       // Show explanation tab
  defaultTab?: 'predict' | 'performance' | 'visualize' | 'explain';
  height?: number;                 // Widget height in pixels
  compact?: boolean;               // Compact layout mode
}
```

## Creating New Model Types

1. **Define the model-specific interface:**
```typescript
interface RandomForestData extends ModelData {
  type: 'randomForest';
  model_data: {
    n_estimators: number;
    max_depth: number;
    feature_importance: { [feature: string]: number };
  };
}
```

2. **Create the widget component:**
```typescript
export const RandomForestWidget: React.FC<ModelWidgetProps> = (props) => {
  const enhancedConfig = {
    showPredictionForm: true,
    showPerformance: true,
    showVisualizations: true,
    ...props.config
  };

  return <BaseModelWidget {...props} config={enhancedConfig} />;
};
```

3. **Add to the factory function:**
```typescript
export function createModelWidget(modelType: ModelType): React.FC<ModelWidgetProps> {
  switch (modelType) {
    case 'randomForest':
      return RandomForestWidget;
    // ... other cases
  }
}
```

## Prediction API Integration

The `onPredict` function should return a `PredictionResult`:

```typescript
async function handlePredict(inputs: { [feature: string]: any }): Promise<PredictionResult> {
  const response = await fetch('/api/models/my-model/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features: inputs })
  });
  
  const result = await response.json();
  
  return {
    value: result.prediction,
    confidence: result.confidence,
    explanation: {
      featureContributions: result.feature_contributions,
      summary: result.explanation
    }
  };
}
```

## Testing

### Unit Testing
```typescript
import { useModelValidation, getDefaultValues } from './hooks/useModelValidation';

test('should validate required fields', () => {
  const schema = { features: [{ name: 'price', type: 'number', required: true }] };
  const { validate } = useModelValidation(schema);
  
  const result = validate({ price: null });
  expect(result.isValid).toBe(false);
  expect(result.errors.price).toBe('price is required');
});
```

### Integration Testing
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LinearRegressionWidget } from './LinearRegressionWidget';

test('should make predictions when form is submitted', async () => {
  const mockPredict = jest.fn().mockResolvedValue({
    value: 250000,
    confidence: 0.85
  });

  render(
    <LinearRegressionWidget
      modelData={mockModelData}
      onPredict={mockPredict}
    />
  );

  fireEvent.change(screen.getByLabelText('Square Footage'), { target: { value: '2000' } });
  fireEvent.click(screen.getByText('Make Prediction'));

  await waitFor(() => {
    expect(mockPredict).toHaveBeenCalledWith({ sqft: 2000 });
    expect(screen.getByText('$250,000')).toBeInTheDocument();
  });
});
```

## Performance Considerations

- **Lazy Loading**: Visualizations are only rendered when the tab is active
- **Memoization**: Expensive calculations are memoized with React hooks
- **Validation**: Input validation happens on blur, not on every keystroke
- **API Debouncing**: Prediction requests can be debounced for real-time use cases

## Browser Support

-  Chrome 88+
-  Firefox 85+
-  Safari 14+
-  Edge 88+

## Roadmap

- [ ] **Random Forest Widget** - Tree-based ensemble model interface
- [ ] **Neural Network Widget** - Deep learning model visualization
- [ ] **Time Series Widget** - Forecasting model interface
- [ ] **Clustering Widget** - Unsupervised learning visualization
- [ ] **Chart Integration** - Interactive visualizations with Recharts
- [ ] **Export Features** - Model reports and prediction exports
- [ ] **Real-time Predictions** - WebSocket integration for live updates

## Contributing

1. Follow the existing component patterns
2. Add comprehensive TypeScript types
3. Include unit and integration tests
4. Update this documentation
5. Test with the ModelWidgetDemo component

## Examples

See `ModelWidgetDemo.tsx` for a complete working example with all configuration options and usage patterns.