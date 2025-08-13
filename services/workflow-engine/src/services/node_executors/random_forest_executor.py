"""
Random Forest Executor

Random Forest model training and prediction
Specialized version of MLExecutor for Random Forest nodes
"""

import logging
import numpy as np
from typing import Dict, Any, Optional, List
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import pandas as pd
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class RandomForestExecutor(BaseNodeExecutor):
    """Execute Random Forest machine learning nodes for model training and prediction"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'randomForest'
    
    def validate_config(self) -> bool:
        """Validate Random Forest node configuration"""
        try:
            data = self.node_config.get('data', {})
            
            operation = data.get('operation', 'train')
            if operation not in ['train', 'predict']:
                logger.error(f"Invalid Random Forest operation: {operation}. Must be 'train' or 'predict'")
                return False
            
            if operation == 'train':
                if not data.get('targetColumn'):
                    logger.error("Training requires 'targetColumn' field")
                    return False
            
            # Validate Random Forest specific parameters
            n_estimators = data.get('n_estimators', 100)
            if not isinstance(n_estimators, int) or n_estimators <= 0:
                logger.error(f"n_estimators must be a positive integer, got: {n_estimators}")
                return False
                
            max_depth = data.get('max_depth')
            if max_depth is not None and (not isinstance(max_depth, int) or max_depth <= 0):
                logger.error(f"max_depth must be a positive integer or None, got: {max_depth}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating Random Forest config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute Random Forest node"""
        try:
            # Get configuration
            data = self.node_config.get('data', {})
            operation = data.get('operation', 'train')
            
            if operation == 'train':
                return await self._train_model(data, input_data)
            elif operation == 'predict':
                return await self._predict_model(data, input_data)
            else:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error=f"Unsupported Random Forest operation: {operation}",
                    metadata={}
                )
        
        except Exception as e:
            logger.error(f"Error in Random Forest execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Random Forest execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    async def _train_model(self, config: Dict[str, Any], input_data: Optional[Any]) -> NodeExecutionResult:
        """Train Random Forest model"""
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
            
            # Configure Random Forest model with parameters - check different config structures
            n_estimators = model_config.get('n_estimators') or config.get('n_estimators', 100)
            max_depth = model_config.get('max_depth') or config.get('max_depth', None)
            min_samples_split = model_config.get('min_samples_split') or config.get('min_samples_split', 2)
            min_samples_leaf = model_config.get('min_samples_leaf') or config.get('min_samples_leaf', 1)
            random_state = model_config.get('randomState') or config.get('random_state', 42)
            
            model = RandomForestRegressor(
                n_estimators=n_estimators,
                max_depth=max_depth,
                min_samples_split=min_samples_split,
                min_samples_leaf=min_samples_leaf,
                random_state=random_state
            )
            
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
            
            # Get feature importances
            feature_importances = dict(zip(feature_columns, model.feature_importances_))
            
            # Prepare model data for saving
            model_data = {
                'model_type': 'random_forest',
                'feature_columns': feature_columns,
                'target_column': target_column,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'mse': float(mse),
                'r2_score': float(r2),
                'feature_importances': {k: float(v) for k, v in feature_importances.items()},
                'parameters': {
                    'n_estimators': n_estimators,
                    'max_depth': max_depth,
                    'min_samples_split': min_samples_split,
                    'min_samples_leaf': min_samples_leaf
                },
                'trained_at': pd.Timestamp.now().isoformat()
            }
            
            return NodeExecutionResult(
                node_id=self.node_id,
                success=True,
                data={
                    'model_info': model_data,
                    'metrics': {
                        'mse': float(mse),
                        'r2_score': float(r2),
                        'training_samples': len(X_train),
                        'feature_importances': {k: float(v) for k, v in feature_importances.items()}
                    },
                    'predictions': y_pred.tolist() if len(y_pred) <= 100 else y_pred[:100].tolist()
                },
                error=None,
                metadata={
                    'model_type': 'random_forest',
                    'feature_count': len(feature_columns),
                    'training_samples': len(X_train),
                    'r2_score': float(r2),
                    'n_estimators': n_estimators
                }
            )
            
        except Exception as e:
            logger.error(f"Error training Random Forest model: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Random Forest training failed: {str(e)}",
                metadata={'error_type': 'training_error'}
            )
    
    async def _predict_model(self, config: Dict[str, Any], input_data: Optional[Any]) -> NodeExecutionResult:
        """Make predictions with trained Random Forest model (simplified implementation)"""
        try:
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error="Random Forest prediction not implemented yet in simplified version",
                metadata={'operation': 'predict', 'status': 'not_implemented'}
            )
            
        except Exception as e:
            logger.error(f"Error in Random Forest prediction: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Random Forest prediction failed: {str(e)}",
                metadata={'error_type': 'prediction_error'}
            )