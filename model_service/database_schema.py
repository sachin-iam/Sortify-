"""
Database schema for dynamic category management and classification results
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os

Base = declarative_base()

class Category(Base):
    """Categories table for dynamic category management"""
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, default="")
    keywords = Column(JSON, default=list)
    color = Column(String(7), default="#6B7280")  # Hex color code
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), default="system")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "keywords": self.keywords or [],
            "color": self.color,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by
        }

class ClassificationResult(Base):
    """Classification results table for storing predictions"""
    __tablename__ = "classification_results"
    
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(String(100), index=True)  # Reference to email in main system
    subject = Column(Text)
    body = Column(Text)
    predicted_category = Column(String(100), index=True)
    predicted_category_id = Column(Integer, index=True)
    confidence = Column(Float)
    scores = Column(JSON)  # All category scores
    processing_time_ms = Column(Float)
    model_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "email_id": self.email_id,
            "subject": self.subject,
            "body": self.body,
            "predicted_category": self.predicted_category,
            "predicted_category_id": self.predicted_category_id,
            "confidence": self.confidence,
            "scores": self.scores or {},
            "processing_time_ms": self.processing_time_ms,
            "model_version": self.model_version,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class ModelVersion(Base):
    """Model versions table for tracking model updates"""
    __tablename__ = "model_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, index=True)
    model_name = Column(String(100))
    categories = Column(JSON)  # Categories at time of training
    accuracy = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)
    training_data_size = Column(Integer)
    training_duration_minutes = Column(Float)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "version": self.version,
            "model_name": self.model_name,
            "categories": self.categories or [],
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "training_data_size": self.training_data_size,
            "training_duration_minutes": self.training_duration_minutes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class PerformanceMetrics(Base):
    """Performance metrics table for monitoring"""
    __tablename__ = "performance_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    total_predictions = Column(Integer, default=0)
    total_batch_predictions = Column(Integer, default=0)
    average_confidence = Column(Float, default=0.0)
    average_processing_time_ms = Column(Float, default=0.0)
    cache_hit_rate = Column(Float, default=0.0)
    memory_usage_mb = Column(Float, default=0.0)
    cpu_usage_percent = Column(Float, default=0.0)
    active_categories_count = Column(Integer, default=0)
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "total_predictions": self.total_predictions,
            "total_batch_predictions": self.total_batch_predictions,
            "average_confidence": self.average_confidence,
            "average_processing_time_ms": self.average_processing_time_ms,
            "cache_hit_rate": self.cache_hit_rate,
            "memory_usage_mb": self.memory_usage_mb,
            "cpu_usage_percent": self.cpu_usage_percent,
            "active_categories_count": self.active_categories_count
        }

class DatabaseManager:
    """Database manager for dynamic category operations"""
    
    def __init__(self, database_url: str = None):
        if database_url is None:
            # Default to SQLite for development
            database_url = "sqlite:///./sortify_ml.db"
        
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Create tables
        Base.metadata.create_all(bind=self.engine)
    
    def get_session(self):
        """Get database session"""
        return self.SessionLocal()
    
    def add_category(self, name: str, description: str = "", keywords: list = None, 
                    color: str = "#6B7280", is_default: bool = False, created_by: str = "system"):
        """Add a new category to database"""
        session = self.get_session()
        try:
            # Check if category already exists
            existing = session.query(Category).filter(Category.name == name).first()
            if existing:
                return False, "Category already exists"
            
            # Get next available ID
            max_id = session.query(Category).count()
            
            category = Category(
                id=max_id,
                name=name,
                description=description,
                keywords=keywords or [],
                color=color,
                is_default=is_default,
                created_by=created_by
            )
            
            session.add(category)
            session.commit()
            return True, category.to_dict()
            
        except Exception as e:
            session.rollback()
            return False, str(e)
        finally:
            session.close()
    
    def remove_category(self, name: str):
        """Remove a category from database"""
        session = self.get_session()
        try:
            category = session.query(Category).filter(Category.name == name).first()
            if not category:
                return False, "Category not found"
            
            if category.is_default:
                return False, "Cannot remove default category"
            
            # Soft delete by setting is_active to False
            category.is_active = False
            category.updated_at = datetime.utcnow()
            session.commit()
            return True, "Category removed successfully"
            
        except Exception as e:
            session.rollback()
            return False, str(e)
        finally:
            session.close()
    
    def update_category(self, name: str, **kwargs):
        """Update category metadata"""
        session = self.get_session()
        try:
            category = session.query(Category).filter(Category.name == name).first()
            if not category:
                return False, "Category not found"
            
            for key, value in kwargs.items():
                if hasattr(category, key):
                    setattr(category, key, value)
            
            category.updated_at = datetime.utcnow()
            session.commit()
            return True, category.to_dict()
            
        except Exception as e:
            session.rollback()
            return False, str(e)
        finally:
            session.close()
    
    def get_categories(self, active_only: bool = True):
        """Get all categories"""
        session = self.get_session()
        try:
            query = session.query(Category)
            if active_only:
                query = query.filter(Category.is_active == True)
            
            categories = query.all()
            return [cat.to_dict() for cat in categories]
            
        except Exception as e:
            return []
        finally:
            session.close()
    
    def get_category_by_name(self, name: str):
        """Get category by name"""
        session = self.get_session()
        try:
            category = session.query(Category).filter(Category.name == name).first()
            return category.to_dict() if category else None
        except Exception as e:
            return None
        finally:
            session.close()
    
    def save_classification_result(self, email_id: str, subject: str, body: str,
                                 predicted_category: str, predicted_category_id: int,
                                 confidence: float, scores: dict, processing_time_ms: float,
                                 model_version: str = "3.0.0"):
        """Save classification result"""
        session = self.get_session()
        try:
            result = ClassificationResult(
                email_id=email_id,
                subject=subject,
                body=body,
                predicted_category=predicted_category,
                predicted_category_id=predicted_category_id,
                confidence=confidence,
                scores=scores,
                processing_time_ms=processing_time_ms,
                model_version=model_version
            )
            
            session.add(result)
            session.commit()
            return True, result.to_dict()
            
        except Exception as e:
            session.rollback()
            return False, str(e)
        finally:
            session.close()
    
    def get_classification_stats(self, category_name: str = None, days: int = 30):
        """Get classification statistics"""
        session = self.get_session()
        try:
            from datetime import timedelta
            start_date = datetime.utcnow() - timedelta(days=days)
            
            query = session.query(ClassificationResult).filter(
                ClassificationResult.created_at >= start_date
            )
            
            if category_name:
                query = query.filter(ClassificationResult.predicted_category == category_name)
            
            results = query.all()
            
            if not results:
                return {
                    "total_classifications": 0,
                    "average_confidence": 0.0,
                    "category_distribution": {},
                    "average_processing_time": 0.0
                }
            
            total = len(results)
            avg_confidence = sum(r.confidence for r in results) / total
            avg_processing_time = sum(r.processing_time_ms for r in results) / total
            
            # Category distribution
            category_dist = {}
            for result in results:
                cat = result.predicted_category
                category_dist[cat] = category_dist.get(cat, 0) + 1
            
            return {
                "total_classifications": total,
                "average_confidence": round(avg_confidence, 4),
                "category_distribution": category_dist,
                "average_processing_time": round(avg_processing_time, 2)
            }
            
        except Exception as e:
            return {"error": str(e)}
        finally:
            session.close()
    
    def save_performance_metrics(self, metrics: dict):
        """Save performance metrics"""
        session = self.get_session()
        try:
            perf = PerformanceMetrics(**metrics)
            session.add(perf)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            return False
        finally:
            session.close()

# Initialize database manager
db_manager = DatabaseManager()
