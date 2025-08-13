"""
Machine Learning Executor

Basic ML model training and prediction
Simplified version from backend/app/api/ml_training.py
"""

import logging
import numpy as np
from typing import Dict, Any, Optional, List
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import pandas as pd
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class MLExecutor(BaseNodeExecutor):
    """Execute machine learning nodes for model training and prediction"""
    
    SUPPORTED_MODELS = {
        'linear_regression': LinearRegression,
        'random_forest': RandomForestRegressor
    }
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'linearRegression'  # Keep original name for compatibility
    
    def validate_config(self) -> bool:
        """Validate ML node configuration"""
        try:
            data = self.node_config.get('data', {})
            
            operation = data.get('operation', 'train')
            if operation not in ['train', 'predict']:
                logger.error(f"Invalid ML operation: {operation}. Must be 'train' or 'predict'")
                return False
            
            model_type = data.get('modelType', 'linear_regression')
            if model_type not in self.SUPPORTED_MODELS:
                logger.error(f"Unsupported model type: {model_type}. Supported: {list(self.SUPPORTED_MODELS.keys())}")
                return False
            
            if operation == 'train':
                if not data.get('targetColumn'):
                    logger.error("Training requires 'targetColumn' field")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating ML config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute ML node"""
        try:
            # Get configuration
            data = self.node_config.get('data', {})
            operation = data.get('operation', 'train')
            model_type = data.get('modelType', 'linear_regression')
            
            if operation == 'train':
                return await self._train_model(data, input_data)
            elif operation == 'predict':
                return await self._predict_model(data, input_data)
            else:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=f"Unsupported ML operation: {operation}",
                    metadata={}
                )
        
        except Exception as e:
            logger.error(f"Error in ML execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"ML execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    async def _train_model(self, config: Dict[str, Any], input_data: Optional[Any]) -> NodeExecutionResult:
        """Train ML model"""
        try:
            # Extract training data from various sources
            training_data = None
            
            # First check for data from input dependencies (e.g., from file node)
            if isinstance(input_data, dict):
                # Check for data from file node or other dependency
                for key, value in input_data.items():
                    if key.startswith('input_from_') and isinstance(value, list):
                        training_data = value
                        logger.info(f"Using training data from dependency: {len(training_data)} rows")
                        break
                
                # Fallback to direct input data
                if not training_data and 'inputData' in input_data:
                    training_data = input_data['inputData']
            
            # Fallback to configured data
            if not training_data:
                training_data = config.get('inputData')
            
            if not training_data:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No training data provided",
                    metadata={}
                )
            
            # Convert to DataFrame if needed
            if isinstance(training_data, list) and training_data and isinstance(training_data[0], dict):
                df = pd.DataFrame(training_data)
            else:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="Training data must be a list of dictionaries",
                    metadata={}
                )
            
            # Extract target column - check different config structures
            model_config = config.get('model', {})
            target_column = model_config.get('target') or config.get('targetColumn')
            
            if not target_column:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No target column specified in model configuration",
                    metadata={}
                )
            
            if target_column not in df.columns:
                available_cols = list(df.columns)
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=f"Target column '{target_column}' not found in data. Available columns: {available_cols}",
                    metadata={}
                )
            
            # Prepare features and target - check different config structures
            feature_columns = model_config.get('features') or config.get('featureColumns')
            if feature_columns:
                # Use specified feature columns
                missing_cols = [col for col in feature_columns if col not in df.columns]
                if missing_cols:
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error=f"Feature columns not found: {missing_cols}",
                        metadata={}
                    )
                # Ensure feature columns are numeric
                X = df[feature_columns].copy()
                for col in feature_columns:
                    if X[col].dtype not in ['int64', 'float64']:
                        try:
                            X[col] = pd.to_numeric(X[col], errors='coerce')
                        except:
                            return NodeExecutionResult(
                                node_id=self.node_id,
                                success=False,
                                data=None,
                                error=f"Could not convert feature column '{col}' to numeric",
                                metadata={}
                            )
            else:
                # Use all numeric columns except target
                numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                if target_column in numeric_cols:
                    numeric_cols.remove(target_column)
                
                if not numeric_cols:
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error="No numeric feature columns found",
                        metadata={}
                    )
                
                X = df[numeric_cols]
                feature_columns = numeric_cols
            
            # Ensure target is numeric
            y = df[target_column].copy()
            if y.dtype not in ['int64', 'float64']:
                try:
                    y = pd.to_numeric(y, errors='coerce')
                except:
                    return NodeExecutionResult(
                        node_id=self.node_id,
                        success=False,
                        data=None,
                        error=f"Could not convert target column '{target_column}' to numeric",
                        metadata={}
                    )
            
            # Remove rows with missing values
            mask = ~(X.isnull().any(axis=1) | y.isnull())
            X = X[mask]
            y = y[mask]
            
            if len(X) == 0:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="No valid data rows after removing missing values",
                    metadata={}
                )
            
            # Train model
            model_type = config.get('modelType', 'linear_regression')
            model_class = self.SUPPORTED_MODELS[model_type]
            model = model_class()
            
            # Split data for validation
            test_size = config.get('testSize', 0.2)
            if len(X) > 4 and test_size > 0:
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=test_size, random_state=42
                )
            else:
                X_train, y_train = X, y
                X_test, y_test = X, y
            
            # Train the model
            model.fit(X_train, y_train)
            
            # Evaluate model
            y_pred = model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            # Handle potential NaN or Infinity values
            import math
            if math.isnan(mse) or math.isinf(mse):
                mse = 0.0
                logger.warning("MSE was NaN or Infinity, setting to 0")
            if math.isnan(r2) or math.isinf(r2):
                r2 = 0.0
                logger.warning("R2 score was NaN or Infinity, setting to 0")
            
            # Prepare model data for saving (simplified)
            model_data = {
                'model_type': model_type,
                'feature_columns': feature_columns,
                'target_column': target_column,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'mse': float(mse),
                'r2_score': float(r2),
                'trained_at': pd.Timestamp.now().isoformat()
            }
            
            # Clean predictions of NaN/Infinity values
            predictions_list = []
            for pred in (y_pred[:100] if len(y_pred) > 100 else y_pred):
                if math.isnan(pred) or math.isinf(pred):
                    predictions_list.append(0.0)
                else:
                    predictions_list.append(float(pred))
            
            return NodeExecutionResult(
                node_id=self.node_id,
                success=True,
                data={
                    'model_info': model_data,
                    'metrics': {
                        'mse': float(mse),
                        'r2_score': float(r2),
                        'training_samples': len(X_train)
                    },
                    'predictions': predictions_list
                },
                error=None,
                metadata={
                    'model_type': model_type,
                    'feature_count': len(feature_columns),
                    'training_samples': len(X_train),
                    'r2_score': float(r2)
                }
            )
            
        except Exception as e:
            logger.error(f"Error training ML model: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Model training failed: {str(e)}",
                metadata={'error_type': 'training_error'}
            )
    
    async def _predict_model(self, config: Dict[str, Any], input_data: Optional[Any]) -> NodeExecutionResult:
        """Make predictions with trained model (simplified implementation)"""
        try:
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error="Model prediction not implemented yet in simplified version",
                metadata={'operation': 'predict', 'status': 'not_implemented'}
            )
            
        except Exception as e:
            logger.error(f"Error in model prediction: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Model prediction failed: {str(e)}",
                metadata={'error_type': 'prediction_error'}
            )