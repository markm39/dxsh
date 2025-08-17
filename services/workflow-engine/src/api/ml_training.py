"""
ML Training API endpoints for machine learning model training and management
Handles linear regression, random forest, and AI-powered data preprocessing
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean
from typing import List, Dict, Any, Optional, Literal
import logging
import openai
import json
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, classification_report
import joblib
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel

from ..auth import get_current_user, AuthUser
from ..database import get_db, Base
from ..models import WorkflowExecution, NodeExecution

router = APIRouter(prefix="/api/v1/ml", tags=["ml-training"])
logger = logging.getLogger(__name__)

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai.api_key = OPENAI_API_KEY

# ML Configuration
ML_MODELS_DIR = Path("ml_models")
ML_MODELS_DIR.mkdir(exist_ok=True)

SUPPORTED_MODEL_TYPES = {
    "linear_regression": {
        "name": "Linear Regression",
        "description": "Predicts continuous values using linear relationships",
        "type": "regression",
        "best_for": "Continuous target variables, linear relationships",
        "parameters": {
            "fit_intercept": {"type": "boolean", "default": True, "description": "Whether to fit intercept"},
            "normalize": {"type": "boolean", "default": False, "description": "Whether to normalize features"}
        }
    },
    "random_forest": {
        "name": "Random Forest",
        "description": "Ensemble model using multiple decision trees",
        "type": "both",  # Can do regression and classification
        "best_for": "Non-linear relationships, feature importance, robust predictions",
        "parameters": {
            "n_estimators": {"type": "integer", "default": 100, "description": "Number of trees"},
            "max_depth": {"type": "integer", "default": None, "description": "Maximum tree depth"},
            "random_state": {"type": "integer", "default": 42, "description": "Random seed"}
        }
    }
}

# Database Models
class MLModel(Base):
    __tablename__ = "ml_models"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    model_type = Column(String(100))
    user_id = Column(Integer)
    node_execution_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)
    model_file_path = Column(String(500))
    model_file_size = Column(Integer)
    preprocessing_notes = Column(Text)
    user_instructions = Column(Text)
    tokens_used = Column(Integer, default=0)
    training_metrics = Column(Text)  # JSON string
    model_metadata = Column(Text)  # JSON string
    features = Column(Text)  # JSON array of feature names
    target = Column(String(255))
    is_classifier = Column(Boolean, default=False)

class MLModelPrediction(Base):
    __tablename__ = "ml_model_predictions"
    
    id = Column(Integer, primary_key=True)
    model_id = Column(Integer)
    user_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)
    input_data = Column(Text)  # JSON string
    predictions = Column(Text)  # JSON string
    prediction_metadata = Column(Text)  # JSON string

# Preprocessing JSON Schema
PREPROCESSING_SCHEMA = {
    "type": "object",
    "properties": {
        "features": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of column names to use as features"
        },
        "target": {
            "type": "string",
            "description": "Column name to use as target variable"
        },
        "preprocessing_steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "column": {"type": "string"},
                    "action": {"type": "string"},
                    "details": {"type": "string"}
                }
            },
            "description": "Steps taken to clean and prepare the data"
        },
        "data_quality_issues": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Issues found in the data"
        },
        "recommendations": {
            "type": "array", 
            "items": {"type": "string"},
            "description": "Recommendations for improving model performance"
        }
    },
    "required": ["features", "target", "preprocessing_steps"]
}

class ModelTrainingRequest(BaseModel):
    input_data: List[Dict[str, Any]]
    model_type: Literal["linear_regression", "random_forest"]
    node_execution_id: int
    user_instructions: Optional[str] = None
    model_name: Optional[str] = None
    features: Optional[List[str]] = None
    target: Optional[str] = None
    model_parameters: Optional[Dict[str, Any]] = None
    use_ai_preprocessing: bool = True

async def ai_preprocess_data(
    data: List[Dict[str, Any]], 
    user_instructions: Optional[str] = None,
    manual_features: Optional[List[str]] = None,
    manual_target: Optional[str] = None
) -> Dict[str, Any]:
    """
    Use AI to intelligently preprocess data for ML training
    """
    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        
        # Prepare data sample for analysis
        data_sample = data[:20] if len(data) > 20 else data
        data_json = json.dumps(data_sample, indent=2, ensure_ascii=False)
        
        # Create preprocessing prompt
        base_prompt = f"""Analyze this dataset and prepare it for machine learning training.

Dataset sample (first {len(data_sample)} of {len(data)} rows):
{data_json}

Your task:
1. Identify the best columns to use as features (input variables)
2. Identify the target variable (what we want to predict)
3. Identify any data quality issues (missing values, inconsistent formats, etc.)
4. Recommend preprocessing steps needed
5. Provide recommendations for improving model performance

Consider:
- Data types and their suitability for ML
- Missing or null values
- Categorical vs numerical variables
- Target variable type (continuous for regression, categorical for classification)
- Feature relevance and quality

"""
        
        if user_instructions:
            base_prompt += f"\nUser Instructions: {user_instructions}"
            
        if manual_features:
            base_prompt += f"\nUser specified features: {manual_features}"
            
        if manual_target:
            base_prompt += f"\nUser specified target: {manual_target}"
        
        messages = [
            {
                "role": "system",
                "content": "You are a machine learning expert who analyzes datasets and provides preprocessing guidance. Always provide structured JSON output following the exact schema provided."
            },
            {"role": "user", "content": base_prompt}
        ]
        
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "ml_preprocessing_analysis",
                "schema": PREPROCESSING_SCHEMA
            }
        }
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=messages,
            response_format=response_format,
            temperature=0.3
        )
        
        # Parse structured response
        preprocessing_result = json.loads(response.choices[0].message.content)
        
        # Add token usage metadata
        preprocessing_result["ai_metadata"] = {
            "tokens_used": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            "generated_at": datetime.now().isoformat()
        }
        
        return preprocessing_result
        
    except Exception as e:
        logger.error(f"AI preprocessing failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI preprocessing failed: {str(e)}")

def clean_and_prepare_data(
    data: List[Dict[str, Any]], 
    features: List[str], 
    target: str
) -> tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Clean and prepare data for ML training
    """
    try:
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Check if target and features exist
        missing_cols = [col for col in features + [target] if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing columns in data: {missing_cols}"
            )
        
        # Select relevant columns
        df_features = df[features].copy()
        df_target = df[target].copy()
        
        # Handle missing values
        # For features: fill numeric with median, categorical with mode
        for col in df_features.columns:
            if df_features[col].dtype in ['int64', 'float64']:
                df_features[col].fillna(df_features[col].median(), inplace=True)
            else:
                # Convert categorical to numeric if possible, otherwise use mode
                try:
                    df_features[col] = pd.to_numeric(df_features[col], errors='coerce')
                    df_features[col].fillna(df_features[col].median(), inplace=True)
                except:
                    df_features[col].fillna(df_features[col].mode().iloc[0] if not df_features[col].mode().empty else 'unknown', inplace=True)
        
        # Handle target variable
        target_is_numeric = False
        try:
            df_target = pd.to_numeric(df_target, errors='coerce')
            df_target.fillna(df_target.median(), inplace=True)
            target_is_numeric = True
        except:
            # Categorical target - encode as numeric
            from sklearn.preprocessing import LabelEncoder
            le = LabelEncoder()
            df_target = le.fit_transform(df_target.astype(str))
        
        # Convert to numpy arrays
        X = df_features.values
        y = df_target.values if target_is_numeric else df_target
        
        # Get final feature names after processing
        feature_names = list(df_features.columns)
        
        return X, y, feature_names, not target_is_numeric
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data preparation failed: {str(e)}")

@router.get("/models/types")
async def get_model_types(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get available ML model types with descriptions and parameters
    """
    try:
        return {
            "success": True,
            "model_types": SUPPORTED_MODEL_TYPES
        }
        
    except Exception as e:
        logger.error(f"Error retrieving model types: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/train")
async def train_model(
    request: ModelTrainingRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Train a machine learning model with AI-powered preprocessing
    """
    try:
        # Validate input
        if not request.input_data:
            raise HTTPException(status_code=400, detail="input_data is required")
        
        if request.model_type not in SUPPORTED_MODEL_TYPES:
            available = ", ".join(SUPPORTED_MODEL_TYPES.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported model type. Available: {available}"
            )
        
        # Step 1: AI-powered data preprocessing (if enabled)
        preprocessing_result = None
        tokens_used = 0
        
        if request.use_ai_preprocessing and not (request.features and request.target):
            preprocessing_result = await ai_preprocess_data(
                request.input_data,
                request.user_instructions,
                request.features,
                request.target
            )
            tokens_used = preprocessing_result["ai_metadata"]["tokens_used"]["total_tokens"]
            
            # Use AI-suggested features and target if not manually specified
            features = request.features or preprocessing_result["features"]
            target = request.target or preprocessing_result["target"]
        else:
            # Use manually specified features and target
            if not request.features or not request.target:
                raise HTTPException(
                    status_code=400,
                    detail="features and target must be specified when AI preprocessing is disabled"
                )
            features = request.features
            target = request.target
        
        # Step 2: Clean and prepare data
        X, y, final_features, is_classifier = clean_and_prepare_data(
            request.input_data, features, target
        )
        
        # Step 3: Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Step 4: Train model
        model_info = SUPPORTED_MODEL_TYPES[request.model_type]
        model_params = request.model_parameters or {}
        
        # Initialize variables that will be used later for NodeExecution update
        y_pred = None
        metrics = {}
        model_metadata = {}
        
        if request.model_type == "linear_regression":
            if is_classifier:
                raise HTTPException(
                    status_code=400,
                    detail="Linear regression cannot be used for classification. Use random_forest instead."
                )
            
            model = LinearRegression(
                fit_intercept=model_params.get("fit_intercept", True)
            )
            model.fit(X_train, y_train)
            
            # Evaluate
            y_pred = model.predict(X_test)
            metrics = {
                "mse": float(mean_squared_error(y_test, y_pred)),
                "r2_score": float(r2_score(y_test, y_pred)),
                "model_type": "regression"
            }
            
            # Get model coefficients
            model_metadata = {
                "coefficients": model.coef_.tolist() if hasattr(model.coef_, 'tolist') else model.coef_,
                "intercept": float(model.intercept_),
                "feature_names": final_features
            }
            
        elif request.model_type == "random_forest":
            if is_classifier:
                model = RandomForestClassifier(
                    n_estimators=model_params.get("n_estimators", 100),
                    max_depth=model_params.get("max_depth"),
                    random_state=model_params.get("random_state", 42)
                )
                model.fit(X_train, y_train)
                
                y_pred = model.predict(X_test)
                metrics = {
                    "accuracy": float(accuracy_score(y_test, y_pred)),
                    "classification_report": classification_report(y_test, y_pred, output_dict=True),
                    "model_type": "classification"
                }
            else:
                model = RandomForestRegressor(
                    n_estimators=model_params.get("n_estimators", 100),
                    max_depth=model_params.get("max_depth"),
                    random_state=model_params.get("random_state", 42)
                )
                model.fit(X_train, y_train)
                
                y_pred = model.predict(X_test)
                metrics = {
                    "mse": float(mean_squared_error(y_test, y_pred)),
                    "r2_score": float(r2_score(y_test, y_pred)),
                    "model_type": "regression"
                }
            
            # Get feature importance
            model_metadata = {
                "feature_importance": model.feature_importances_.tolist(),
                "feature_names": final_features,
                "n_estimators": model.n_estimators,
                "max_depth": model.max_depth
            }
        
        # Step 5: Save model to disk
        model_name = request.model_name or f"{request.model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        model_filename = f"model_{request.node_execution_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.joblib"
        model_path = ML_MODELS_DIR / model_filename
        
        joblib.dump(model, model_path)
        model_file_size = model_path.stat().st_size
        
        # Step 6: Save model record to database
        db_model = MLModel(
            name=model_name,
            model_type=request.model_type,
            user_id=current_user.user_id,
            node_execution_id=request.node_execution_id,
            model_file_path=str(model_path),
            model_file_size=model_file_size,
            preprocessing_notes=json.dumps(preprocessing_result) if preprocessing_result else None,
            user_instructions=request.user_instructions,
            tokens_used=tokens_used,
            training_metrics=json.dumps(metrics),
            model_metadata=json.dumps(model_metadata),
            features=json.dumps(final_features),
            target=target,
            is_classifier=is_classifier
        )
        
        db.add(db_model)
        db.commit()
        db.refresh(db_model)
        
        logger.info(f"User {current_user.user_id} trained {request.model_type} model (ID: {db_model.id})")
        
        # Update the NodeExecution record with the output data for dashboard widgets
        try:
            logger.info(f" Looking for NodeExecution with ID: {request.node_execution_id}")
            node_execution = db.query(NodeExecution).filter(
                NodeExecution.id == request.node_execution_id
            ).first()
            
            if node_execution:
                # Prepare output data for dashboard consumption
                # Create sample predictions for visualization (limit to 20 samples)
                sample_size = min(20, len(X_test))
                sample_predictions = []
                for i in range(sample_size):
                    sample_predictions.append({
                        "actual": float(y_test.iloc[i]) if hasattr(y_test, 'iloc') else float(y_test[i]),
                        "predicted": float(y_pred[i]),
                        "index": i
                    })
                
                output_data = {
                    "model_id": db_model.id,
                    "model_name": model_name,
                    "model_type": request.model_type,
                    "metrics": metrics,
                    "features": final_features,
                    "target": target,
                    "predictions": sample_predictions,
                    "feature_importance": model_metadata.get("feature_importance", []) if model_metadata else [],
                    "training_samples": len(X_train),
                    "test_samples": len(X_test),
                    "is_classifier": is_classifier
                }
                
                # Update the node execution with results
                node_execution.output_data = output_data
                node_execution.status = 'completed'
                node_execution.completed_at = datetime.utcnow()
                node_execution.node_specific_data = {
                    "model_id": db_model.id,
                    "tokens_used": tokens_used,
                    "preprocessing_method": "ai" if request.use_ai_preprocessing else "manual"
                }
                
                db.commit()
                logger.info(f" Updated NodeExecution {request.node_execution_id} with ML results")
                
                # Debug: Check what was saved
                logger.info(f" NodeExecution details: node_id={node_execution.node_id}, " +
                          f"execution_id={node_execution.execution_id}, " +
                          f"status={node_execution.status}, " +
                          f"has_output_data={bool(node_execution.output_data)}")
            else:
                logger.warning(f" NodeExecution {request.node_execution_id} not found for update")
                
                # Debug: Check all NodeExecutions
                all_node_execs = db.query(NodeExecution).all()
                logger.info(f" Total NodeExecutions in DB: {len(all_node_execs)}")
                for ne in all_node_execs[-5:]:  # Show last 5
                    logger.info(f"   - ID: {ne.id}, node_id: {ne.node_id}, status: {ne.status}")
                
        except Exception as e:
            logger.error(f"Failed to update NodeExecution: {e}")
            # Don't fail the entire request if execution tracking fails
        
        return {
            "success": True,
            "model": {
                "id": db_model.id,
                "name": model_name,
                "type": request.model_type,
                "is_classifier": is_classifier,
                "features": final_features,
                "target": target,
                "metrics": metrics,
                "model_metadata": model_metadata,
                "file_size": model_file_size,
                "tokens_used": tokens_used,
                "created_at": db_model.created_at.isoformat()
            },
            "preprocessing": preprocessing_result,
            "training_data": {
                "total_samples": len(request.input_data),
                "training_samples": len(X_train),
                "test_samples": len(X_test),
                "features_used": len(final_features)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Model training failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")

@router.get("/models")
async def get_user_models(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0
):
    """
    Get user's trained models with pagination
    """
    try:
        models = db.query(MLModel).filter(
            MLModel.user_id == current_user.user_id
        ).offset(offset).limit(limit).all()
        
        model_list = []
        for model in models:
            model_data = {
                "id": model.id,
                "name": model.name,
                "type": model.model_type,
                "is_classifier": model.is_classifier,
                "target": model.target,
                "created_at": model.created_at.isoformat(),
                "file_size": model.model_file_size,
                "tokens_used": model.tokens_used
            }
            
            # Parse JSON fields safely
            try:
                model_data["features"] = json.loads(model.features) if model.features else []
                model_data["metrics"] = json.loads(model.training_metrics) if model.training_metrics else {}
            except:
                model_data["features"] = []
                model_data["metrics"] = {}
            
            model_list.append(model_data)
        
        return {
            "success": True,
            "models": model_list,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": len(model_list)
            }
        }
        
    except Exception as e:
        logger.error(f"Error retrieving models for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/{model_id}")
async def get_model_details(
    model_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific model
    """
    try:
        model = db.query(MLModel).filter(
            MLModel.id == model_id,
            MLModel.user_id == current_user.user_id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Parse JSON fields
        model_details = {
            "id": model.id,
            "name": model.name,
            "type": model.model_type,
            "is_classifier": model.is_classifier,
            "target": model.target,
            "created_at": model.created_at.isoformat(),
            "file_size": model.model_file_size,
            "tokens_used": model.tokens_used,
            "user_instructions": model.user_instructions,
            "features": json.loads(model.features) if model.features else [],
            "metrics": json.loads(model.training_metrics) if model.training_metrics else {},
            "model_metadata": json.loads(model.model_metadata) if model.model_metadata else {},
            "preprocessing_notes": json.loads(model.preprocessing_notes) if model.preprocessing_notes else None
        }
        
        return {
            "success": True,
            "model": model_details
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving model {model_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/models/{model_id}")
async def delete_model(
    model_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a trained model and its associated files
    """
    try:
        model = db.query(MLModel).filter(
            MLModel.id == model_id,
            MLModel.user_id == current_user.user_id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Delete model file if it exists
        if model.model_file_path and Path(model.model_file_path).exists():
            Path(model.model_file_path).unlink()
        
        # Delete from database
        db.delete(model)
        db.commit()
        
        logger.info(f"User {current_user.user_id} deleted model {model_id}")
        
        return {
            "success": True,
            "message": f"Model '{model.name}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting model {model_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/{model_id}/predict")
async def predict_with_model(
    model_id: int,
    request: Dict[str, Any],
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Make predictions using a trained model
    """
    try:
        # Get the model
        model = db.query(MLModel).filter(
            MLModel.id == model_id,
            MLModel.user_id == current_user.user_id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Check if model file exists
        if not model.model_file_path or not Path(model.model_file_path).exists():
            raise HTTPException(status_code=404, detail="Model file not found")
        
        # Load the model
        try:
            trained_model = joblib.load(model.model_file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")
        
        # Get input data
        input_data = request.get('input_data', [])
        if not input_data:
            raise HTTPException(status_code=400, detail="No input_data provided")
        
        # Parse features and prepare input
        features = json.loads(model.features) if model.features else []
        if not features:
            raise HTTPException(status_code=500, detail="Model has no feature information")
        
        # Convert input data to DataFrame for prediction
        try:
            df_input = pd.DataFrame(input_data)
            
            # Ensure all required features are present
            missing_features = [f for f in features if f not in df_input.columns]
            if missing_features:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing required features: {missing_features}"
                )
            
            # Select only the features used in training (in correct order)
            X_input = df_input[features]
            
            # Make predictions
            predictions = trained_model.predict(X_input)
            
            # Convert numpy types to Python types for JSON serialization
            predictions_list = [float(pred) for pred in predictions]
            
            logger.info(f"User {current_user.user_id} made predictions with model {model_id}")
            
            return {
                "success": True,
                "predictions": predictions_list,
                "model_id": model_id,
                "model_name": model.name,
                "features_used": features,
                "input_count": len(input_data)
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Prediction failed: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error making predictions with model {model_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")