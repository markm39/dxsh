"""
Machine Learning Model database models
"""
from datetime import datetime
from app import db
from sqlalchemy.dialects.postgresql import JSON


class MLModel(db.Model):
    """Trained machine learning model metadata"""
    __tablename__ = 'ml_models'
    
    id = db.Column(db.Integer, primary_key=True)
    node_execution_id = db.Column(db.Integer, db.ForeignKey('node_executions.id', ondelete='CASCADE'), nullable=False)
    model_type = db.Column(db.String(50), nullable=False, index=True)  # 'linear_regression', etc.
    model_name = db.Column(db.String(200), nullable=True)
    feature_names = db.Column(JSON, nullable=False)  # List of feature column names
    target_name = db.Column(db.String(100), nullable=False)  # Target variable name
    n_features = db.Column(db.Integer, nullable=False)  # Number of features
    n_samples = db.Column(db.Integer, nullable=False)  # Total training samples
    train_size = db.Column(db.Integer, nullable=False)  # Training set size
    test_size = db.Column(db.Integer, nullable=False)  # Test set size
    model_config = db.Column(JSON, nullable=True)  # Training configuration (test_size, normalize, etc.)
    training_metrics = db.Column(JSON, nullable=False)  # R2, MSE, MAE scores
    model_metadata = db.Column(JSON, nullable=True)  # Coefficients, intercept, etc.
    model_file_path = db.Column(db.String(500), nullable=False)  # Path to saved model file
    model_file_size = db.Column(db.Integer, nullable=True)  # File size in bytes
    preprocessing_notes = db.Column(db.Text, nullable=True)  # AI preprocessing notes
    user_instructions = db.Column(db.Text, nullable=True)  # User's training instructions
    tokens_used = db.Column(db.Integer, nullable=True)  # OpenAI tokens used for preprocessing
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    node_execution = db.relationship('NodeExecution', backref='ml_models')
    predictions = db.relationship('MLModelPrediction', backref='model', cascade='all, delete-orphan')
    training_data = db.relationship('MLTrainingData', backref='model', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert model to dictionary"""
        return {
            'id': self.id,
            'node_execution_id': self.node_execution_id,
            'model_type': self.model_type,
            'model_name': self.model_name,
            'feature_names': self.feature_names,
            'target_name': self.target_name,
            'n_features': self.n_features,
            'n_samples': self.n_samples,
            'train_size': self.train_size,
            'test_size': self.test_size,
            'model_config': self.model_config,
            'training_metrics': self.training_metrics,
            'model_metadata': self.model_metadata,
            'model_file_path': self.model_file_path,
            'model_file_size': self.model_file_size,
            'preprocessing_notes': self.preprocessing_notes,
            'user_instructions': self.user_instructions,
            'tokens_used': self.tokens_used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class MLModelPrediction(db.Model):
    """Prediction history for ML models"""
    __tablename__ = 'ml_model_predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    model_id = db.Column(db.Integer, db.ForeignKey('ml_models.id', ondelete='CASCADE'), nullable=False)
    input_data = db.Column(JSON, nullable=False)  # Input features for prediction
    predictions = db.Column(JSON, nullable=False)  # Model predictions
    prediction_metadata = db.Column(JSON, nullable=True)  # Additional prediction info
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """Convert prediction to dictionary"""
        return {
            'id': self.id,
            'model_id': self.model_id,
            'input_data': self.input_data,
            'predictions': self.predictions,
            'prediction_metadata': self.prediction_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class MLTrainingData(db.Model):
    """Training data snapshots for visualization"""
    __tablename__ = 'ml_training_data'
    
    id = db.Column(db.Integer, primary_key=True)
    model_id = db.Column(db.Integer, db.ForeignKey('ml_models.id', ondelete='CASCADE'), nullable=False)
    features_data = db.Column(JSON, nullable=False)  # Feature values
    targets_data = db.Column(JSON, nullable=False)  # Target values
    visualization_data = db.Column(JSON, nullable=True)  # Data for plots (actual vs predicted, residuals)
    data_split = db.Column(db.String(20), nullable=False, index=True)  # 'train', 'test', 'full'
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert training data to dictionary"""
        return {
            'id': self.id,
            'model_id': self.model_id,
            'features_data': self.features_data,
            'targets_data': self.targets_data,
            'visualization_data': self.visualization_data,
            'data_split': self.data_split,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }