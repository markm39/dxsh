import React from 'react';
import { BaseModelWidget } from './components/BaseModelWidget';
import { ModelWidgetProps, PredictionResult, ModelData } from './types';

/**
 * Random Forest Model Widget
 * Specialized widget for random forest models with prediction interface
 */
export const RandomForestWidget: React.FC<ModelWidgetProps> = (props) => {
  // Enhanced config for random forest
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
 * Factory function to create a Random Forest widget with mock data
 * Useful for testing and development
 */
export function createMockRandomForestWidget(): {
  widget: React.FC<Omit<ModelWidgetProps, 'modelData' | 'onPredict'>>;
  mockData: ModelData;
} {
  const mockData: ModelData = {
    id: 'rf_model_001',
    type: 'randomForest',
    name: 'Credit Risk Assessment Model',
    description: 'Predicts credit default risk using ensemble decision trees',
    
    schema: {
      features: [
        {
          name: 'credit_score',
          type: 'number',
          displayName: 'Credit Score',
          description: 'FICO credit score',
          min: 300,
          max: 850,
          defaultValue: 650,
          required: true
        },
        {
          name: 'annual_income',
          type: 'number',
          displayName: 'Annual Income',
          description: 'Annual income in USD',
          min: 0,
          max: 500000,
          defaultValue: 50000,
          required: true
        },
        {
          name: 'debt_to_income',
          type: 'number',
          displayName: 'Debt-to-Income Ratio',
          description: 'Ratio of total debt to income',
          min: 0,
          max: 1,
          step: 0.01,
          defaultValue: 0.3,
          required: true
        },
        {
          name: 'employment_years',
          type: 'number',
          displayName: 'Years Employed',
          description: 'Years at current employment',
          min: 0,
          max: 50,
          defaultValue: 5,
          required: true
        },
        {
          name: 'loan_purpose',
          type: 'categorical',
          displayName: 'Loan Purpose',
          description: 'Purpose of the loan',
          options: ['debt_consolidation', 'home_improvement', 'major_purchase', 'medical', 'vacation'],
          defaultOption: 'debt_consolidation',
          required: true
        },
        {
          name: 'owns_home',
          type: 'boolean',
          displayName: 'Owns Home',
          description: 'Whether the applicant owns their home',
          defaultBoolean: false,
          required: false
        }
      ],
      target: {
        name: 'default_risk',
        type: 'categorical',
        displayName: 'Default Risk'
      }
    },

    performance: {
      score: 0.92,
      accuracy: 0.92,
      precision: 0.89,
      recall: 0.85,
      f1_score: 0.87,
      
      feature_importance: [
        { feature: 'credit_score', importance: 0.35 },
        { feature: 'debt_to_income', importance: 0.28 },
        { feature: 'annual_income', importance: 0.18 },
        { feature: 'employment_years', importance: 0.12 },
        { feature: 'loan_purpose', importance: 0.05 },
        { feature: 'owns_home', importance: 0.02 }
      ],

      training_info: {
        training_date: '2025-01-15T10:30:00Z',
        dataset_size: 25000,
        training_time: 12.5,
        cross_validation_score: 0.90
      }
    },

    model_data: {
      n_estimators: 100,
      max_depth: 10,
      feature_importance: {
        credit_score: 0.35,
        debt_to_income: 0.28,
        annual_income: 0.18,
        employment_years: 0.12,
        loan_purpose: 0.05,
        owns_home: 0.02
      }
    },

    visualizations: [
      {
        id: 'feature_importance',
        title: 'Feature Importance',
        type: 'bar',
        data: [
          { feature: 'Credit Score', importance: 0.35 },
          { feature: 'Debt-to-Income', importance: 0.28 },
          { feature: 'Annual Income', importance: 0.18 },
          { feature: 'Employment Years', importance: 0.12 },
          { feature: 'Loan Purpose', importance: 0.05 },
          { feature: 'Owns Home', importance: 0.02 }
        ],
        config: {
          xLabel: 'Features',
          yLabel: 'Importance',
          color: '#8b5cf6'
        }
      },
      {
        id: 'confusion_matrix',
        title: 'Confusion Matrix',
        type: 'heatmap',
        data: {
          matrix: [
            [1520, 45, 12],
            [38, 892, 67],
            [15, 52, 359]
          ],
          labels: ['Low Risk', 'Medium Risk', 'High Risk']
        },
        config: {
          xLabel: 'Predicted',
          yLabel: 'Actual'
        }
      },
      {
        id: 'roc_curve',
        title: 'ROC Curves',
        type: 'line',
        data: {
          curves: [
            {
              name: 'Low Risk (AUC: 0.95)',
              points: Array.from({ length: 100 }, (_, i) => ({
                fpr: i / 100,
                tpr: Math.min(1, (i / 100) * 1.2 + 0.1 + Math.random() * 0.1)
              }))
            },
            {
              name: 'Medium Risk (AUC: 0.88)',
              points: Array.from({ length: 100 }, (_, i) => ({
                fpr: i / 100,
                tpr: Math.min(1, (i / 100) * 1.1 + 0.05 + Math.random() * 0.1)
              }))
            },
            {
              name: 'High Risk (AUC: 0.92)',
              points: Array.from({ length: 100 }, (_, i) => ({
                fpr: i / 100,
                tpr: Math.min(1, (i / 100) * 1.15 + 0.08 + Math.random() * 0.1)
              }))
            }
          ]
        },
        config: {
          xLabel: 'False Positive Rate',
          yLabel: 'True Positive Rate'
        }
      }
    ],

    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T12:45:00Z',
    version: '1.0.0'
  };

  // Mock prediction function
  const mockPredict = async (inputs: { [feature: string]: any }): Promise<PredictionResult> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simple risk assessment based on inputs
    let riskScore = 0;
    
    // Credit score impact (higher is better)
    const creditScore = inputs['credit_score'] || 650;
    riskScore += (creditScore - 500) / 350 * 0.4; // 0-0.4 range
    
    // Debt to income impact (lower is better)
    const debtToIncome = inputs['debt_to_income'] || 0.3;
    riskScore += (1 - debtToIncome) * 0.3; // 0-0.3 range
    
    // Income impact (higher is better, but capped)
    const income = inputs['annual_income'] || 50000;
    riskScore += Math.min(income / 100000, 1) * 0.2; // 0-0.2 range
    
    // Employment stability
    const employmentYears = inputs['employment_years'] || 5;
    riskScore += Math.min(employmentYears / 10, 1) * 0.1; // 0-0.1 range

    // Add some randomness
    riskScore += (Math.random() - 0.5) * 0.2;
    
    // Determine risk category
    let riskCategory: string;
    let confidence: number;
    
    if (riskScore > 0.7) {
      riskCategory = 'low';
      confidence = 0.85 + Math.random() * 0.1;
    } else if (riskScore > 0.4) {
      riskCategory = 'medium';
      confidence = 0.75 + Math.random() * 0.1;
    } else {
      riskCategory = 'high';
      confidence = 0.80 + Math.random() * 0.1;
    }

    // Calculate feature contributions
    const featureContributions = [
      {
        feature: 'Credit Score',
        contribution: Math.abs((creditScore - 500) / 350 * 40),
        impact: creditScore > 650 ? 'positive' as const : 'negative' as const
      },
      {
        feature: 'Debt-to-Income',
        contribution: Math.abs((1 - debtToIncome) * 30),
        impact: debtToIncome < 0.4 ? 'positive' as const : 'negative' as const
      },
      {
        feature: 'Annual Income',
        contribution: Math.abs(Math.min(income / 100000, 1) * 20),
        impact: income > 40000 ? 'positive' as const : 'negative' as const
      }
    ].sort((a, b) => b.contribution - a.contribution);

    return {
      value: riskCategory,
      confidence,
      explanation: {
        featureContributions,
        summary: `Based on the financial profile, the predicted default risk is ${riskCategory}. Key factors include credit score (${creditScore}), debt-to-income ratio (${(debtToIncome * 100).toFixed(1)}%), and annual income ($${income.toLocaleString()}).`
      }
    };
  };

  const Widget: React.FC<Omit<ModelWidgetProps, 'modelData' | 'onPredict'>> = (props) => (
    <RandomForestWidget
      {...props}
      modelData={mockData}
      onPredict={mockPredict}
    />
  );

  return { widget: Widget, mockData };
}

export default RandomForestWidget;