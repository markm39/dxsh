"""
Machine Learning Service for model training and inference
Supports linear regression with AI-powered data preprocessing
"""
import os
import json
import joblib
import logging
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
import openai

logger = logging.getLogger(__name__)

class MLService:
    """Service for training and managing machine learning models"""
    
    # Model storage directory
    MODELS_DIR = os.path.join(os.path.dirname(__file__), '../../ml_models')
    
    # Supported model types
    SUPPORTED_MODELS = {
        'linear_regression': {
            'name': 'Linear Regression',
            'description': 'Predicts continuous values using linear relationships',
            'class': LinearRegression,
            'supports_multivariate': True
        },
        'random_forest': {
            'name': 'Random Forest',
            'description': 'Ensemble of decision trees for improved accuracy and reduced overfitting',
            'class': RandomForestRegressor,
            'supports_multivariate': True
        }
    }
    
    # AI system prompts for data structure analysis
    SYSTEM_PROMPTS = {
        'linear_regression': """You are an expert data scientist helping to prepare data for linear regression training.

Your task is to analyze the input data and structure it for model training based on the user's description.

CRITICAL: You MUST attempt to extract features even from messy, unstructured data. Be creative and aggressive in parsing the data.

REQUIREMENTS:
1. Extract feature columns (X) and target column (y) based on user instructions
2. Handle missing values appropriately 
3. Ensure all features are numeric (convert if needed)
4. Validate that target variable is continuous/numeric
5. Remove any rows with missing target values
6. Return features as a 2D array where each row is a sample and each column is a feature
7. Return structured training data ready for scikit-learn

DATA PARSING STRATEGIES:
- DO NOT give up easily - unless it is completely unparseable, try to extract something useful
SUCCESS CASE:
Return a JSON object with this exact structure:
{
  "success": true,
  "features": [
    [1.0, 2.0],
    [1.5, 2.5]
  ],
  "targets": [10.0, 15.0],
  "feature_names": ["feature_1", "feature_2"],
  "target_name": "target_variable",
  "sample_count": 2,
  "preprocessing_notes": "Converted categorical variables to numeric, removed 3 rows with missing targets",
  "error": "",
  "reason": ""
}

ERROR CASE:
If data cannot be structured, return:
{
  "success": false,
  "features": [],
  "targets": [],
  "feature_names": [],
  "target_name": "",
  "sample_count": 0,
  "preprocessing_notes": "",
  "error": "Specific error description",
  "reason": "Why the data couldn't be processed"
}

IMPORTANT: All numeric values must be JSON-serializable (no NaN, no infinity)."""
    }
    
    # JSON schemas for structured outputs
    ML_SCHEMAS = {
        'linear_regression': {
            'type': 'json_schema',
            'json_schema': {
                'name': 'linear_regression_response',
                'strict': True,
                'schema': {
                    'type': 'object',
                    'properties': {
                        'success': {'type': 'boolean'},
                        'features': {
                            'type': 'array',
                             'items': {
                                'type': 'array',
                                'items': {'type': 'number'}
                            }
                        },
                        'targets': {
                            'type': 'array',
                            'items': {'type': 'number'}
                        },
                        'feature_names': {
                            'type': 'array',
                            'items': {'type': 'string'}
                        },
                        'target_name': {'type': 'string'},
                        'sample_count': {'type': 'integer'},
                        'preprocessing_notes': {'type': 'string'},
                        'error': {'type': 'string'},
                        'reason': {'type': 'string'}
                    },
                    'required': ['success', 'features', 'targets', 'feature_names', 'target_name', 'sample_count', 'preprocessing_notes', 'error', 'reason'],
                    'additionalProperties': False
                }
            }
        }
    }
    
    @classmethod
    def get_supported_models(cls) -> List[Dict[str, Any]]:
        """Get list of supported model types"""
        return [
            {
                'value': key,
                'label': info['name'],
                'description': info['description'],
                'supports_multivariate': info['supports_multivariate']
            }
            for key, info in cls.SUPPORTED_MODELS.items()
        ]
    
    @classmethod
    def preprocess_data(cls, input_data: List[Dict], model_type: str, user_instructions: str) -> Dict[str, Any]:
        """
        Use AI to preprocess and structure data for ML training
        
        Args:
            input_data: Raw data from previous workflow nodes
            model_type: Type of model to train ('linear_regression', etc.)
            user_instructions: User description of how to structure the data
            
        Returns:
            Dictionary with structured training data or error information
        """
        if model_type not in cls.SUPPORTED_MODELS:
            return {'error': f'Unsupported model type: {model_type}'}
        
        if not input_data:
            return {'error': 'No input data provided'}
        
        try:
            logger.info(f"Starting preprocessing for {model_type} with {len(input_data)} input records")
            
            # Initialize OpenAI client
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                logger.error("OpenAI API key not configured")
                return {'error': 'OpenAI API key not configured'}
            
            client = openai.OpenAI(api_key=api_key)
            logger.info("OpenAI client initialized successfully")
            
            # Prepare the prompt
            system_prompt = cls.SYSTEM_PROMPTS[model_type]
            
            # Add user instructions to system prompt if provided
            if user_instructions:
                system_prompt += f"\n\nUSER INSTRUCTIONS: {user_instructions}"
            
            user_prompt = f"""Please analyze and structure this data for {model_type} training:

DATA:
{json.dumps(input_data[:10], indent=2, default=str)}

{f"... and {len(input_data) - 10} more records" if len(input_data) > 10 else ""}

TOTAL RECORDS: {len(input_data)}

Structure this data according to the user's instructions, extracting appropriate features and target variables for training."""
            
            # Call OpenAI with structured output
            logger.info(f"Calling OpenAI API with model gpt-4o-2024-08-06")
            logger.info(f"User prompt length: {len(user_prompt)} characters")
            logger.info(f"System prompt length: {len(system_prompt)} characters")
            
            response = client.chat.completions.create(
                model='gpt-4o-2024-08-06',  # Model that supports structured outputs
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                response_format=cls.ML_SCHEMAS[model_type],
                temperature=0.1,
                max_tokens=4000
            )
            
            logger.info(f"OpenAI API call successful, usage: {response.usage}")
            
            # Debug the raw response
            raw_content = response.choices[0].message.content
            logger.info(f"Raw OpenAI response content: {raw_content}")
            logger.info(f"Response content type: {type(raw_content)}")
            logger.info(f"Response content length: {len(raw_content) if raw_content else 0}")
            
            # Parse the structured response
            try:
                result = json.loads(raw_content)
                result['tokens_used'] = response.usage.total_tokens
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                logger.error(f"Problematic content: {raw_content[:500]}...")  # First 500 chars
                raise
            
            logger.info(f"AI preprocessing completed for {model_type}, tokens: {result['tokens_used']}")
            logger.info(f"Result keys: {list(result.keys())}")
            logger.info(f"Success: {result.get('success')}")
            
            if result.get('success'):
                logger.info(f"Features shape: {len(result.get('features', []))}x{len(result.get('features', [[]])[0]) if result.get('features') else 0}")
                logger.info(f"Targets count: {len(result.get('targets', []))}")
                logger.info(f"Feature names: {result.get('feature_names', [])}")
            else:
                logger.warning(f"Preprocessing failed: {result.get('error', 'Unknown error')}")
                logger.warning(f"Reason: {result.get('reason', 'No reason provided')}")
            
            return result
            
        except openai.RateLimitError:
            logger.error("OpenAI rate limit exceeded")
            return {'error': 'OpenAI API rate limit exceeded'}
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return {'error': f'OpenAI API error: {str(e)}'}
        except json.JSONDecodeError:
            logger.error("Failed to parse OpenAI response as JSON")
            return {'error': 'Invalid JSON response from AI preprocessing'}
        except Exception as e:
            logger.error(f"Error in AI preprocessing: {e}")
            return {'error': f'Preprocessing failed: {str(e)}'}
    
    @classmethod
    def train_linear_regression(cls, training_data: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Train a linear regression model
        
        Args:
            training_data: Structured training data from preprocess_data
            config: Optional model configuration (test_size, normalize, etc.)
            
        Returns:
            Dictionary with model info, metrics, and file path
        """
        try:
            # Extract data
            features_2d = training_data['features']  # Now a 2D array
            targets = training_data['targets']
            feature_names = training_data['feature_names']
            target_name = training_data['target_name']
            
            # Convert 2D array to pandas DataFrame
            X = pd.DataFrame(features_2d, columns=feature_names)
            y = np.array(targets)
            
            # Validate data
            if len(X) != len(y):
                return {'error': 'Feature and target data length mismatch'}
            
            if len(X) < 2:
                return {'error': 'Insufficient data for training (need at least 2 samples)'}
            
            # Configuration defaults
            config = config or {}
            test_size = config.get('test_size', 0.2)
            normalize = config.get('normalize', True)
            random_state = config.get('random_state', 42)
            
            # Split data
            if len(X) > 4:  # Only split if we have enough data
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=test_size, random_state=random_state
                )
            else:
                # Use all data for training if dataset is very small
                X_train, X_test, y_train, y_test = X, X, y, y
            
            # Feature scaling if requested
            scaler = None
            if normalize:
                scaler = StandardScaler()
                X_train_scaled = scaler.fit_transform(X_train)
                X_test_scaled = scaler.transform(X_test)
            else:
                X_train_scaled = X_train.values
                X_test_scaled = X_test.values
            
            # Train model
            model = LinearRegression()
            model.fit(X_train_scaled, y_train)
            
            # Make predictions
            y_train_pred = model.predict(X_train_scaled)
            y_test_pred = model.predict(X_test_scaled)
            
            # Calculate metrics
            train_r2 = r2_score(y_train, y_train_pred)
            test_r2 = r2_score(y_test, y_test_pred)
            train_mse = mean_squared_error(y_train, y_train_pred)
            test_mse = mean_squared_error(y_test, y_test_pred)
            train_mae = mean_absolute_error(y_train, y_train_pred)
            test_mae = mean_absolute_error(y_test, y_test_pred)
            
            # Prepare model metadata
            model_metadata = {
                'model_type': 'linear_regression',
                'feature_names': feature_names,
                'target_name': target_name,
                'n_features': len(feature_names),
                'n_samples': len(X),
                'train_size': len(X_train),
                'test_size': len(X_test),
                'normalized': normalize,
                'coefficients': model.coef_.tolist(),
                'intercept': float(model.intercept_),
                'training_metrics': {
                    'train_r2': float(train_r2),
                    'test_r2': float(test_r2),
                    'train_mse': float(train_mse),
                    'test_mse': float(test_mse),
                    'train_mae': float(train_mae),
                    'test_mae': float(test_mae)
                },
                'created_at': datetime.now().isoformat(),
                'config': config
            }
            
            # Prepare model package for saving
            model_package = {
                'model': model,
                'scaler': scaler,
                'metadata': model_metadata
            }
            
            # Generate visualization data
            visualization_data = {
                'actual_vs_predicted': {
                    'train': {
                        'actual': y_train.tolist(),
                        'predicted': y_train_pred.tolist()
                    },
                    'test': {
                        'actual': y_test.tolist(),
                        'predicted': y_test_pred.tolist()
                    }
                },
                'residuals': {
                    'train': (y_train - y_train_pred).tolist(),
                    'test': (y_test - y_test_pred).tolist()
                },
                'feature_importance': [
                    {'feature': name, 'coefficient': float(coef)}
                    for name, coef in zip(feature_names, model.coef_)
                ]
            }
            
            return {
                'success': True,
                'model_package': model_package,
                'visualization_data': visualization_data,
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Error training linear regression model: {e}")
            return {'error': f'Model training failed: {str(e)}'}
    
    @classmethod
    def train_random_forest(cls, training_data: Dict[str, Any], config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Train a random forest model
        
        Args:
            training_data: Structured training data from preprocess_data
            config: Optional model configuration (test_size, n_estimators, etc.)
            
        Returns:
            Dictionary with model info, metrics, and file path
        """
        try:
            # Extract data
            features_2d = training_data['features']  # Now a 2D array
            targets = training_data['targets']
            feature_names = training_data['feature_names']
            target_name = training_data['target_name']
            
            # Convert 2D array to pandas DataFrame
            X = pd.DataFrame(features_2d, columns=feature_names)
            y = np.array(targets)
            
            # Validate data
            if len(X) != len(y):
                return {'error': 'Feature and target data length mismatch'}
            
            if len(X) < 2:
                return {'error': 'Insufficient data for training (need at least 2 samples)'}
            
            # Configuration defaults
            config = config or {}
            test_size = config.get('test_size', 0.2)
            n_estimators = config.get('nEstimators', 100)
            max_depth = config.get('maxDepth', None)
            min_samples_split = config.get('minSamplesSplit', 2)
            random_state = config.get('random_state', 42)
            
            # Split data
            if len(X) > 4:  # Only split if we have enough data
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=test_size, random_state=random_state
                )
            else:
                # Use all data for training if dataset is very small
                X_train, X_test, y_train, y_test = X, X, y, y
            
            # Train Random Forest model
            model = RandomForestRegressor(
                n_estimators=n_estimators,
                max_depth=max_depth,
                min_samples_split=min_samples_split,
                random_state=random_state,
                n_jobs=-1  # Use all available cores
            )
            model.fit(X_train, y_train)
            
            # Make predictions
            y_train_pred = model.predict(X_train)
            y_test_pred = model.predict(X_test)
            
            # Calculate metrics
            train_r2 = r2_score(y_train, y_train_pred)
            test_r2 = r2_score(y_test, y_test_pred)
            train_mse = mean_squared_error(y_train, y_train_pred)
            test_mse = mean_squared_error(y_test, y_test_pred)
            train_mae = mean_absolute_error(y_train, y_train_pred)
            test_mae = mean_absolute_error(y_test, y_test_pred)
            
            # Get feature importance from Random Forest
            feature_importance = model.feature_importances_
            
            # Prepare model metadata
            model_metadata = {
                'model_type': 'random_forest',
                'feature_names': feature_names,
                'target_name': target_name,
                'n_features': len(feature_names),
                'n_samples': len(X),
                'train_size': len(X_train),
                'test_size': len(X_test),
                'n_estimators': n_estimators,
                'max_depth': max_depth,
                'min_samples_split': min_samples_split,
                'feature_importance': feature_importance.tolist(),
                'training_metrics': {
                    'train_r2': float(train_r2),
                    'test_r2': float(test_r2),
                    'train_mse': float(train_mse),
                    'test_mse': float(test_mse),
                    'train_mae': float(train_mae),
                    'test_mae': float(test_mae)
                },
                'created_at': datetime.now().isoformat(),
                'config': config
            }
            
            # Prepare model package for saving
            model_package = {
                'model': model,
                'scaler': None,  # Random Forest doesn't require scaling
                'metadata': model_metadata
            }
            
            # Generate visualization data
            visualization_data = {
                'actual_vs_predicted': {
                    'train': {
                        'actual': y_train.tolist(),
                        'predicted': y_train_pred.tolist()
                    },
                    'test': {
                        'actual': y_test.tolist(),
                        'predicted': y_test_pred.tolist()
                    }
                },
                'residuals': {
                    'train': (y_train - y_train_pred).tolist(),
                    'test': (y_test - y_test_pred).tolist()
                },
                'feature_importance': [
                    {'feature': name, 'importance': float(importance)}
                    for name, importance in zip(feature_names, feature_importance)
                ]
            }
            
            return {
                'success': True,
                'model_package': model_package,
                'visualization_data': visualization_data,
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Error training random forest model: {e}")
            return {'error': f'Model training failed: {str(e)}'}
    
    @classmethod
    def save_model(cls, model_package: Dict[str, Any], model_id: str) -> Dict[str, Any]:
        """
        Save trained model to disk
        
        Args:
            model_package: Model package from training
            model_id: Unique identifier for the model
            
        Returns:
            Dictionary with file path and metadata
        """
        try:
            # Ensure models directory exists
            os.makedirs(cls.MODELS_DIR, exist_ok=True)
            
            # Generate file path
            model_filename = f"model_{model_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.joblib"
            model_path = os.path.join(cls.MODELS_DIR, model_filename)
            
            # Save model using joblib
            joblib.dump(model_package, model_path)
            
            logger.info(f"Model saved to: {model_path}")
            
            return {
                'success': True,
                'model_path': model_path,
                'model_filename': model_filename,
                'file_size': os.path.getsize(model_path)
            }
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return {'error': f'Failed to save model: {str(e)}'}
    
    @classmethod
    def load_model(cls, model_path: str) -> Dict[str, Any]:
        """
        Load trained model from disk
        
        Args:
            model_path: Path to the saved model file
            
        Returns:
            Dictionary with loaded model package or error
        """
        try:
            if not os.path.exists(model_path):
                return {'error': 'Model file not found'}
            
            model_package = joblib.load(model_path)
            
            return {
                'success': True,
                'model_package': model_package
            }
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return {'error': f'Failed to load model: {str(e)}'}
    
    @classmethod
    def predict(cls, model_package: Dict[str, Any], input_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Make predictions using a trained model
        
        Args:
            model_package: Loaded model package
            input_data: Input data for prediction
            
        Returns:
            Dictionary with predictions or error
        """
        try:
            model = model_package['model']
            scaler = model_package.get('scaler')
            metadata = model_package['metadata']
            feature_names = metadata['feature_names']
            
            # Convert input data to DataFrame
            X = pd.DataFrame(input_data)
            
            # Ensure we have the right features
            missing_features = set(feature_names) - set(X.columns)
            if missing_features:
                return {'error': f'Missing required features: {list(missing_features)}'}
            
            # Select and order features correctly
            X = X[feature_names]
            
            # Apply scaling if model was trained with scaling
            if scaler:
                X_scaled = scaler.transform(X)
            else:
                X_scaled = X.values
            
            # Make predictions
            predictions = model.predict(X_scaled)
            
            return {
                'success': True,
                'predictions': predictions.tolist(),
                'input_count': len(input_data),
                'feature_names': feature_names,
                'target_name': metadata['target_name']
            }
            
        except Exception as e:
            logger.error(f"Error making predictions: {e}")
            return {'error': f'Prediction failed: {str(e)}'}