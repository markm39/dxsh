"""
Machine Learning Training API endpoints
"""
import logging
import os
from datetime import datetime
from flask import request, jsonify
from app.api import api_bp
from app import db
from app.auth import auth_required, get_current_user
from app.services.ml_service import MLService
from app.models.ml_model import MLModel, MLModelPrediction, MLTrainingData
from app.models.execution import NodeExecution

logger = logging.getLogger(__name__)


@api_bp.route('/ml/models/types', methods=['GET'])
@auth_required
def get_model_types():
    """Get supported ML model types"""
    try:
        model_types = MLService.get_supported_models()
        return jsonify({
            'success': True,
            'model_types': model_types
        })
    except Exception as e:
        logger.error(f"Error getting model types: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/ml/models/train', methods=['POST'])
@auth_required
def train_model():
    """Train a machine learning model"""
    try:
        # Add print statements to ensure we reach this point
        print("=== ML TRAINING ENDPOINT CALLED ===")
        print(f"Request method: {request.method}")
        print(f"Request path: {request.path}")
        
        # Log raw request details
        logger.info(f"Raw request content type: {request.content_type}")
        logger.info(f"Raw request data length: {len(request.data) if request.data else 0}")
        
        data = request.get_json()
        print(f"Request data keys: {list(data.keys()) if data else 'None'}")
        logger.info(f"ML training request received. Data keys: {list(data.keys()) if data else 'None'}")
        
        # Log the full request data (be careful with sensitive info)
        if data:
            print(f"Sample data: {str(data)[:200]}...")
            logger.info(f"Full request data: {str(data)[:1000]}...")  # Truncate for safety
        
        # Validate required fields
        required_fields = ['input_data', 'model_type', 'node_execution_id']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            logger.error(f"Missing required fields: {missing_fields}")
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing_fields}'
            }), 400
        
        input_data = data['input_data']
        model_type = data['model_type']
        node_execution_id = data['node_execution_id']
        user_instructions = data.get('user_instructions', '')
        model_name = data.get('model_name', f'{model_type.title()} Model')
        model_config = data.get('config', {})
        manual_selection = data.get('manual_selection', False)
        features = data.get('features', [])
        target = data.get('target', '')
        
        logger.info(f"Training parameters: model_type={model_type}, node_execution_id={node_execution_id}")
        logger.info(f"Input data type: {type(input_data)}, length: {len(input_data) if hasattr(input_data, '__len__') else 'N/A'}")
        logger.info(f"User instructions: {user_instructions[:100]}..." if len(user_instructions) > 100 else f"User instructions: {user_instructions}")
        logger.info(f"Model config: {model_config}")
        
        # Validate node execution exists
        node_execution = NodeExecution.query.get(node_execution_id)
        if not node_execution:
            logger.error(f"Node execution not found: {node_execution_id}")
            return jsonify({
                'success': False,
                'error': 'Node execution not found'
            }), 404
        
        logger.info(f"Node execution found: {node_execution.id}, type: {node_execution.node_type}")
        logger.info(f"Manual selection: {manual_selection}, features: {features}, target: {target}")
        
        # Step 1: Preprocess data - use manual selection if configured, otherwise use AI
        if manual_selection and features and target:
            logger.info(f"Using manual feature selection: features={features}, target={target}")
            
            # Direct feature selection without AI preprocessing
            try:
                if not isinstance(input_data, list) or len(input_data) == 0:
                    raise ValueError("Input data must be a non-empty list")
                
                # Validate that all specified columns exist in the data
                first_record = input_data[0]
                if not isinstance(first_record, dict):
                    raise ValueError("Input data records must be dictionaries/objects")
                
                available_columns = set(first_record.keys())
                missing_features = [f for f in features if f not in available_columns]
                if missing_features:
                    raise ValueError(f"Feature columns not found in data: {missing_features}")
                
                if target not in available_columns:
                    raise ValueError(f"Target column '{target}' not found in data")
                
                # Extract features and targets
                feature_data = []
                target_data = []
                
                for record in input_data:
                    # Extract feature values
                    feature_values = []
                    for feature in features:
                        value = record[feature]
                        # Convert to float if possible
                        try:
                            feature_values.append(float(value))
                        except (ValueError, TypeError):
                            raise ValueError(f"Feature '{feature}' contains non-numeric value: {value}")
                    
                    feature_data.append(feature_values)
                    
                    # Extract target value
                    target_value = record[target]
                    try:
                        target_data.append(float(target_value))
                    except (ValueError, TypeError):
                        raise ValueError(f"Target '{target}' contains non-numeric value: {target_value}")
                
                training_data = {
                    'features': feature_data,
                    'targets': target_data,
                    'feature_names': features,
                    'target_name': target,
                    'sample_count': len(input_data)
                }
                preprocessing_notes = f"Manual feature selection: {len(features)} features, {len(input_data)} samples"
                tokens_used = 0
                
                logger.info(f"Manual preprocessing completed: {len(feature_data)} samples, {len(features)} features")
                
            except Exception as e:
                logger.error(f"Manual preprocessing failed: {e}")
                return jsonify({
                    'success': False,
                    'error': f'Manual preprocessing failed: {str(e)}',
                    'stage': 'manual_preprocessing'
                }), 400
                
        else:
            # Use AI preprocessing (legacy mode)
            logger.info(f"Using AI preprocessing for {model_type}")
            preprocessing_result = MLService.preprocess_data(
                input_data=input_data,
                model_type=model_type,
                user_instructions=user_instructions
            )
            
            logger.info(f"Preprocessing result keys: {list(preprocessing_result.keys())}")
            logger.info(f"Preprocessing success: {preprocessing_result.get('success')}")
            
            if 'error' in preprocessing_result and preprocessing_result['error']:
                error_msg = preprocessing_result.get('error', 'Unknown preprocessing error')
                logger.error(f"Preprocessing error found: '{error_msg}'")
                logger.error(f"Full preprocessing result: {preprocessing_result}")
                return jsonify({
                    'success': False,
                    'error': error_msg,
                    'stage': 'preprocessing',
                    'full_result': preprocessing_result
                }), 400
            
            if not preprocessing_result.get('success'):
                logger.error(f"Preprocessing failed: {preprocessing_result}")
                return jsonify({
                    'success': False,
                    'error': preprocessing_result.get('error', 'Preprocessing failed'),
                    'reason': preprocessing_result.get('reason', ''),
                    'stage': 'preprocessing',
                    'debug_info': preprocessing_result
                }), 400
            
            # Extract training data from flattened structure
            training_data = {
                'features': preprocessing_result['features'],
                'targets': preprocessing_result['targets'], 
                'feature_names': preprocessing_result['feature_names'],
                'target_name': preprocessing_result['target_name'],
                'sample_count': preprocessing_result['sample_count']
            }
            preprocessing_notes = preprocessing_result.get('preprocessing_notes', '')
            tokens_used = preprocessing_result.get('tokens_used', 0)
        
        logger.info(f"Extracted training data - Features shape: {len(training_data['features'])}x{len(training_data['features'][0]) if training_data['features'] else 0}")
        logger.info(f"Targets count: {len(training_data['targets'])}")
        logger.info(f"Feature names: {training_data['feature_names']}")
        logger.info(f"Target name: {training_data['target_name']}")
        logger.info(f"Sample count: {training_data['sample_count']}")
        logger.info(f"Tokens used: {tokens_used}")
        
        # Step 2: Train the model
        logger.info(f"Starting model training for {model_type}")
        if model_type == 'linear_regression':
            training_result = MLService.train_linear_regression(training_data, model_config)
        elif model_type == 'random_forest':
            training_result = MLService.train_random_forest(training_data, model_config)
        else:
            logger.error(f"Unsupported model type: {model_type}")
            return jsonify({
                'success': False,
                'error': f'Unsupported model type: {model_type}'
            }), 400
        
        logger.info(f"Training result keys: {list(training_result.keys())}")
        logger.info(f"Training success: {training_result.get('success')}")
        
        if 'error' in training_result and training_result['error']:
            logger.error(f"Training error: {training_result['error']}")
            return jsonify({
                'success': False,
                'error': training_result['error'],
                'stage': 'training'
            }), 400
        
        model_package = training_result['model_package']
        visualization_data = training_result['visualization_data']
        
        # Step 3: Save model to disk
        model_id = f"{node_execution_id}_{int(datetime.now().timestamp())}"
        save_result = MLService.save_model(model_package, model_id)
        
        if 'error' in save_result and save_result['error']:
            return jsonify({
                'success': False,
                'error': save_result['error'],
                'stage': 'saving'
            }), 500
        
        # Step 4: Save model metadata to database
        ml_model = MLModel(
            node_execution_id=node_execution_id,
            model_type=model_type,
            model_name=model_name,
            feature_names=training_data['feature_names'],
            target_name=training_data['target_name'],
            n_features=len(training_data['feature_names']),
            n_samples=training_data['sample_count'],
            train_size=model_package['metadata']['train_size'],
            test_size=model_package['metadata']['test_size'],
            model_config=model_config,
            training_metrics=model_package['metadata']['training_metrics'],
            model_metadata=model_package['metadata'],
            model_file_path=save_result['model_path'],
            model_file_size=save_result['file_size'],
            preprocessing_notes=preprocessing_notes,
            user_instructions=user_instructions,
            tokens_used=tokens_used
        )
        
        db.session.add(ml_model)
        db.session.flush()  # Get the model ID
        
        # Step 5: Save training data for visualization
        training_data_record = MLTrainingData(
            model_id=ml_model.id,
            features_data=training_data['features'],
            targets_data=training_data['targets'],
            visualization_data=visualization_data,
            data_split='full'
        )
        
        db.session.add(training_data_record)
        
        # Step 6: Update NodeExecution with output data for dashboard integration
        output_data = {
            'success': True,
            'model': ml_model.to_dict(),
            'visualization_data': visualization_data,
            'preprocessing_notes': preprocessing_notes,
            'tokens_used': tokens_used
        }
        
        node_execution.output_data = output_data
        node_execution.status = 'completed'
        node_execution.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Successfully trained and saved {model_type} model (ID: {ml_model.id})")
        logger.info(f"Updated NodeExecution {node_execution.id} with output data")
        
        logger.info(f"ML training completed successfully. Model ID: {ml_model.id}")
        return jsonify(output_data)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error training model: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error traceback:", exc_info=True)
        
        # Update NodeExecution with error status
        if 'node_execution' in locals():
            try:
                node_execution.status = 'failed'
                node_execution.error_message = str(e)
                node_execution.completed_at = datetime.utcnow()
                db.session.commit()
                logger.info(f"Updated NodeExecution {node_execution.id} with error status")
            except Exception as update_error:
                logger.error(f"Failed to update NodeExecution with error: {update_error}")
                db.session.rollback()
        
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'stage': 'general'
        }), 500


@api_bp.route('/ml/models/<int:model_id>', methods=['GET'])
@auth_required
def get_model(model_id):
    """Get model details and metadata"""
    try:
        ml_model = MLModel.query.get(model_id)
        if not ml_model:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
        
        # Get training data for visualization
        training_data = MLTrainingData.query.filter_by(
            model_id=model_id,
            data_split='full'
        ).first()
        
        response_data = {
            'success': True,
            'model': ml_model.to_dict()
        }
        
        if training_data:
            response_data['training_data'] = training_data.to_dict()
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error getting model {model_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/ml/models/<int:model_id>/predict', methods=['POST'])
@auth_required
def predict_with_model(model_id):
    """Make predictions using a trained model"""
    try:
        data = request.get_json()
        
        if 'input_data' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing input_data field'
            }), 400
        
        input_data = data['input_data']
        
        # Get model from database
        ml_model = MLModel.query.get(model_id)
        if not ml_model:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
        
        # Load model from disk
        load_result = MLService.load_model(ml_model.model_file_path)
        if 'error' in load_result:
            return jsonify({
                'success': False,
                'error': load_result['error']
            }), 500
        
        model_package = load_result['model_package']
        
        # Make predictions
        prediction_result = MLService.predict(model_package, input_data)
        
        if 'error' in prediction_result:
            return jsonify({
                'success': False,
                'error': prediction_result['error']
            }), 400
        
        # Save prediction history
        prediction_record = MLModelPrediction(
            model_id=model_id,
            input_data=input_data,
            predictions=prediction_result['predictions'],
            prediction_metadata={
                'input_count': prediction_result['input_count'],
                'feature_names': prediction_result['feature_names'],
                'target_name': prediction_result['target_name']
            }
        )
        
        db.session.add(prediction_record)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'predictions': prediction_result['predictions'],
            'input_count': prediction_result['input_count'],
            'feature_names': prediction_result['feature_names'],
            'target_name': prediction_result['target_name'],
            'prediction_id': prediction_record.id
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error making prediction with model {model_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/ml/models/<int:model_id>/predictions', methods=['GET'])
@auth_required
def get_model_predictions(model_id):
    """Get prediction history for a model"""
    try:
        # Verify model exists
        ml_model = MLModel.query.get(model_id)
        if not ml_model:
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
        
        # Get predictions with pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        predictions = MLModelPrediction.query.filter_by(model_id=model_id)\
            .order_by(MLModelPrediction.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'success': True,
            'predictions': [pred.to_dict() for pred in predictions.items],
            'pagination': {
                'page': predictions.page,
                'pages': predictions.pages,
                'per_page': predictions.per_page,
                'total': predictions.total
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting predictions for model {model_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/ml/models', methods=['GET'])
@auth_required
def get_user_models():
    """Get all models for the current user"""
    try:
        # Get models through node executions (assuming user filtering through workflow executions)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        model_type = request.args.get('model_type')
        
        query = MLModel.query.join(NodeExecution).order_by(MLModel.created_at.desc())
        
        if model_type:
            query = query.filter(MLModel.model_type == model_type)
        
        models = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'success': True,
            'models': [model.to_dict() for model in models.items],
            'pagination': {
                'page': models.page,
                'pages': models.pages,
                'per_page': models.per_page,
                'total': models.total
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting user models: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500