import React from 'react';
import { BaseModelWidget } from './components/BaseModelWidget';
import { ModelWidgetProps, PredictionResult, ModelData } from './types';

/**
 * Linear Regression Model Widget
 * Specialized widget for linear regression models with prediction interface
 */
export const LinearRegressionWidget: React.FC<ModelWidgetProps> = (props) => {
  // Enhanced config for linear regression
  const enhancedConfig = {
    showPredictionForm: true,
    showPerformance: true,
    showVisualizations: true,
    showExplanation: true,
    defaultTab: 'predict' as const,
    ...props.config
  };

  return (
    <BaseModelWidget
      {...props}
      config={enhancedConfig}
    />
  );
};

/**
 * Factory function to create a Linear Regression widget with mock data
 * Useful for testing and development
 */
export function createMockLinearRegressionWidget(): {
  widget: React.FC<Omit<ModelWidgetProps, 'modelData' | 'onPredict'>>;
  mockData: ModelData;
} {
  const mockData: ModelData = {
    id: 'lr_model_001',
    type: 'linearRegression',
    name: 'House Price Prediction Model',
    description: 'Predicts house prices based on property features like size, location, and amenities',
    
    schema: {
      features: [
        {
          name: 'sqft',
          type: 'number',
          displayName: 'Square Footage',
          description: 'Total living area in square feet',
          min: 500,
          max: 10000,
          defaultValue: 2000,
          required: true
        },
        {
          name: 'bedrooms',
          type: 'number',
          displayName: 'Bedrooms',
          description: 'Number of bedrooms',
          min: 1,
          max: 10,
          step: 1,
          defaultValue: 3,
          required: true
        },
        {
          name: 'bathrooms',
          type: 'number',
          displayName: 'Bathrooms',
          description: 'Number of bathrooms',
          min: 1,
          max: 8,
          step: 0.5,
          defaultValue: 2,
          required: true
        },
        {
          name: 'age',
          type: 'number',
          displayName: 'House Age',
          description: 'Age of the house in years',
          min: 0,
          max: 200,
          defaultValue: 10,
          required: true
        },
        {
          name: 'location',
          type: 'categorical',
          displayName: 'Location',
          description: 'Neighborhood or area',
          options: ['Downtown', 'Suburbs', 'Rural', 'Waterfront', 'Mountain'],
          defaultOption: 'Suburbs',
          required: true
        },
        {
          name: 'garage',
          type: 'boolean',
          displayName: 'Has Garage',
          description: 'Whether the property has a garage',
          defaultBoolean: true,
          required: false
        }
      ],
      target: {
        name: 'price',
        type: 'number',
        displayName: 'House Price',
        unit: '$'
      }
    },

    performance: {
      score: 0.87,
      r_squared: 0.87,
      mean_squared_error: 1234567890.12,
      mean_absolute_error: 25430.50,
      root_mean_squared_error: 35136.34,
      
      coefficients: [
        { feature: 'sqft', coefficient: 150.25, p_value: 0.001 },
        { feature: 'bedrooms', coefficient: 8500.75, p_value: 0.012 },
        { feature: 'bathrooms', coefficient: 12300.50, p_value: 0.005 },
        { feature: 'age', coefficient: -1200.25, p_value: 0.003 },
        { feature: 'location_Downtown', coefficient: 45000.00, p_value: 0.001 },
        { feature: 'location_Waterfront', coefficient: 85000.00, p_value: 0.001 },
        { feature: 'garage', coefficient: 15000.00, p_value: 0.025 }
      ],

      training_info: {
        training_date: '2025-01-15T10:30:00Z',
        dataset_size: 15420,
        training_time: 2.45,
        cross_validation_score: 0.85
      }
    },

    model_data: {
      coefficients: {
        sqft: 150.25,
        bedrooms: 8500.75,
        bathrooms: 12300.50,
        age: -1200.25,
        location_Downtown: 45000.00,
        location_Suburbs: 0, // baseline
        location_Rural: -15000.00,
        location_Waterfront: 85000.00,
        location_Mountain: 25000.00,
        garage: 15000.00
      },
      intercept: 50000.00
    },

    visualizations: [
      {
        id: 'actual_vs_predicted',
        title: 'Actual vs Predicted Prices',
        type: 'scatter',
        data: {
          // Mock data for scatter plot
          points: Array.from({ length: 100 }, (_, i) => ({
            actual: 200000 + Math.random() * 400000,
            predicted: 200000 + Math.random() * 400000
          }))
        },
        config: {
          xLabel: 'Actual Price ($)',
          yLabel: 'Predicted Price ($)',
          color: '#3b82f6'
        }
      },
      {
        id: 'residuals',
        title: 'Residual Plot',
        type: 'scatter',
        data: {
          points: Array.from({ length: 100 }, () => ({
            predicted: 200000 + Math.random() * 400000,
            residual: (Math.random() - 0.5) * 100000
          }))
        },
        config: {
          xLabel: 'Predicted Price ($)',
          yLabel: 'Residual ($)',
          color: '#ef4444'
        }
      },
      {
        id: 'coefficients',
        title: 'Feature Coefficients',
        type: 'bar',
        data: {
          features: [
            { name: 'Square Footage', coefficient: 150.25 },
            { name: 'Bedrooms', coefficient: 8500.75 },
            { name: 'Bathrooms', coefficient: 12300.50 },
            { name: 'Age', coefficient: -1200.25 },
            { name: 'Downtown', coefficient: 45000.00 },
            { name: 'Waterfront', coefficient: 85000.00 },
            { name: 'Garage', coefficient: 15000.00 }
          ]
        },
        config: {
          xLabel: 'Features',
          yLabel: 'Coefficient Value',
          color: '#8b5cf6'
        }
      }
    ],

    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T12:45:00Z',
    version: '1.2.0'
  };

  // Mock prediction function
  const mockPredict = async (inputs: { [feature: string]: any }): Promise<PredictionResult> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simple linear regression calculation using mock coefficients
    let prediction = mockData.model_data.intercept || 50000;
    
    // Add contributions from each feature
    Object.entries(inputs).forEach(([feature, value]) => {
      const coefficient = mockData.model_data.coefficients?.[feature];
      if (coefficient && value !== undefined && value !== null) {
        if (feature === 'location') {
          // Handle categorical variable
          const locationCoeff = mockData.model_data.coefficients?.[`location_${value}`] || 0;
          prediction += locationCoeff;
        } else if (typeof value === 'number') {
          prediction += coefficient * value;
        } else if (typeof value === 'boolean') {
          prediction += coefficient * (value ? 1 : 0);
        }
      }
    });

    // Add some randomness to simulate model uncertainty
    const noise = (Math.random() - 0.5) * 20000;
    prediction += noise;

    // Calculate confidence based on how close inputs are to "typical" values
    const confidence = Math.max(0.6, Math.min(0.95, 0.85 + (Math.random() - 0.5) * 0.2));

    // Calculate feature contributions for explanation
    const featureContributions = Object.entries(inputs).map(([feature, value]) => {
      const coefficient = mockData.model_data.coefficients?.[feature] || 0;
      let contribution = 0;
      
      if (feature === 'location') {
        contribution = mockData.model_data.coefficients?.[`location_${value}`] || 0;
      } else if (typeof value === 'number') {
        contribution = coefficient * value;
      } else if (typeof value === 'boolean') {
        contribution = coefficient * (value ? 1 : 0);
      }

      return {
        feature: feature === 'location' ? `Location: ${value}` : feature,
        contribution: Math.abs(contribution),
        impact: contribution > 0 ? 'positive' as const : 
                contribution < 0 ? 'negative' as const : 'neutral' as const
      };
    }).filter(contrib => contrib.contribution > 0);

    return {
      value: Math.round(prediction),
      confidence,
      explanation: {
        featureContributions: featureContributions.sort((a, b) => b.contribution - a.contribution),
        summary: `Based on the property features, the predicted price is $${Math.round(prediction).toLocaleString()}. The most significant factors are ${featureContributions.slice(0, 2).map(f => f.feature).join(' and ')}.`
      }
    };
  };

  const Widget: React.FC<Omit<ModelWidgetProps, 'modelData' | 'onPredict'>> = (props) => (
    <LinearRegressionWidget
      {...props}
      modelData={mockData}
      onPredict={mockPredict}
    />
  );

  return { widget: Widget, mockData };
}

export default LinearRegressionWidget;