# backend/app/models/user.py
from app import db
from sqlalchemy import String, DateTime, Boolean
from datetime import datetime
from app.auth import hash_password, check_password_hash_func

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(String(255), unique=True, nullable=False)
    password_hash = db.Column(String(255), nullable=False)
    is_active = db.Column(Boolean, default=True)
    created_at = db.Column(DateTime, default=datetime.utcnow)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - removed agents until proper foreign key setup
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def set_password(self, password):
        """Set password hash"""
        self.password_hash = hash_password(password)
    
    def check_password(self, password):
        """Check if password matches hash"""
        return check_password_hash_func(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def create_user(cls, email, password):
        """Create a new user"""
        user = cls(email=email)
        user.set_password(password)
        return user