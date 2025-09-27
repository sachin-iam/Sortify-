"""
Dynamic Email Classifier with Real-time Category Management
Supports adding/removing categories without model retraining
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    AutoConfig
)
import logging
import json
import asyncio
from datetime import datetime
import threading
from collections import defaultdict
import pickle
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DynamicCategoryManager:
    """Manages dynamic categories with real-time updates"""
    
    def __init__(self, categories_file: str = "categories.json"):
        self.categories_file = categories_file
        self.categories = {}
        self.category_embeddings = {}
        self.category_metadata = {}
        self.lock = threading.RLock()
        self.load_categories()
    
    def load_categories(self):
        """Load categories from file"""
        try:
            if os.path.exists(self.categories_file):
                with open(self.categories_file, 'r') as f:
                    data = json.load(f)
                    self.categories = data.get('categories', {})
                    self.category_embeddings = data.get('embeddings', {})
                    self.category_metadata = data.get('metadata', {})
                logger.info(f"Loaded {len(self.categories)} categories")
            else:
                self._initialize_default_categories()
        except Exception as e:
            logger.error(f"Error loading categories: {e}")
            self._initialize_default_categories()
    
    def _initialize_default_categories(self):
        """Initialize with default categories"""
        default_categories = {
            "Academic": {
                "id": 0,
                "description": "Academic and educational content",
                "keywords": ["lecture", "course", "assignment", "research", "university"],
                "color": "#3B82F6",
                "created_at": datetime.now().isoformat()
            },
            "Promotions": {
                "id": 1,
                "description": "Promotional and marketing content",
                "keywords": ["sale", "offer", "discount", "promotion", "deal"],
                "color": "#10B981",
                "created_at": datetime.now().isoformat()
            },
            "Placement": {
                "id": 2,
                "description": "Job and career opportunities",
                "keywords": ["job", "career", "hiring", "interview", "position"],
                "color": "#F59E0B",
                "created_at": datetime.now().isoformat()
            },
            "Spam": {
                "id": 3,
                "description": "Spam and unwanted content",
                "keywords": ["spam", "unwanted", "junk", "scam", "phishing"],
                "color": "#EF4444",
                "created_at": datetime.now().isoformat()
            },
            "Other": {
                "id": 4,
                "description": "Miscellaneous content",
                "keywords": ["other", "misc", "general"],
                "color": "#6B7280",
                "created_at": datetime.now().isoformat()
            }
        }
        
        self.categories = default_categories
        self._save_categories()
    
    def add_category(self, name: str, description: str = "", keywords: List[str] = None, color: str = "#6B7280") -> bool:
        """Add a new category dynamically"""
        with self.lock:
            if name in self.categories:
                logger.warning(f"Category '{name}' already exists")
                return False
            
            # Get next available ID
            max_id = max([cat['id'] for cat in self.categories.values()]) if self.categories else -1
            new_id = max_id + 1
            
            self.categories[name] = {
                "id": new_id,
                "description": description,
                "keywords": keywords or [],
                "color": color,
                "created_at": datetime.now().isoformat()
            }
            
            self._save_categories()
            logger.info(f"Added new category: {name} (ID: {new_id})")
            return True
    
    def remove_category(self, name: str) -> bool:
        """Remove a category"""
        with self.lock:
            if name not in self.categories:
                logger.warning(f"Category '{name}' not found")
                return False
            
            # Don't allow removing default categories
            default_categories = ["Academic", "Promotions", "Placement", "Spam", "Other"]
            if name in default_categories:
                logger.warning(f"Cannot remove default category: {name}")
                return False
            
            del self.categories[name]
            if name in self.category_embeddings:
                del self.category_embeddings[name]
            if name in self.category_metadata:
                del self.category_metadata[name]
            
            self._save_categories()
            logger.info(f"Removed category: {name}")
            return True
    
    def update_category(self, name: str, **kwargs) -> bool:
        """Update category metadata"""
        with self.lock:
            if name not in self.categories:
                logger.warning(f"Category '{name}' not found")
                return False
            
            for key, value in kwargs.items():
                if key in self.categories[name]:
                    self.categories[name][key] = value
            
            self.categories[name]['updated_at'] = datetime.now().isoformat()
            self._save_categories()
            logger.info(f"Updated category: {name}")
            return True
    
    def get_categories(self) -> Dict[str, Any]:
        """Get all categories"""
        with self.lock:
            return self.categories.copy()
    
    def get_category_names(self) -> List[str]:
        """Get list of category names"""
        with self.lock:
            return list(self.categories.keys())
    
    def get_category_by_id(self, category_id: int) -> Optional[str]:
        """Get category name by ID"""
        with self.lock:
            for name, data in self.categories.items():
                if data['id'] == category_id:
                    return name
            return None
    
    def _save_categories(self):
        """Save categories to file"""
        try:
            data = {
                'categories': self.categories,
                'embeddings': self.category_embeddings,
                'metadata': self.category_metadata,
                'last_updated': datetime.now().isoformat()
            }
            with open(self.categories_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving categories: {e}")

class DynamicEmailClassifier:
    """High-performance dynamic email classifier"""
    
    def __init__(self, model_name: str = "distilbert-base-uncased", max_length: int = 512):
        self.model_name = model_name
        self.max_length = max_length
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize components
        self.category_manager = DynamicCategoryManager()
        self.tokenizer = None
        self.model = None
        self.classification_head = None
        
        # Performance optimization
        self.batch_size = 32
        self.max_batch_size = 1000
        self.cache_size = 10000
        self.prediction_cache = {}
        
        # Initialize model
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the DistilBERT model with dynamic classification head"""
        try:
            logger.info(f"Initializing model: {self.model_name}")
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            # Load base model with correct number of labels
            num_categories = len(self.category_manager.get_categories())
            config = AutoConfig.from_pretrained(
                self.model_name,
                num_labels=num_categories,
                problem_type="single_label_classification"
            )
            
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                config=config
            )
            
            # Move to device
            self.model.to(self.device)
            self.model.eval()
            
            logger.info("Model initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            raise RuntimeError(f"Model initialization failed: {e}")
    
    def _update_classification_head(self):
        """Update classification head for current categories"""
        try:
            num_categories = len(self.category_manager.get_categories())
            
            # Update the model's classification head
            if hasattr(self.model, 'classifier'):
                # Update existing classifier
                self.model.classifier = nn.Linear(
                    self.model.config.hidden_size, 
                    num_categories
                ).to(self.device)
            else:
                # Create new classification head
                self.classification_head = nn.Linear(
                    self.model.config.hidden_size, 
                    num_categories
                ).to(self.device)
            
            # Initialize weights
            if hasattr(self.model, 'classifier'):
                nn.init.xavier_uniform_(self.model.classifier.weight)
                nn.init.zeros_(self.model.classifier.bias)
            else:
                nn.init.xavier_uniform_(self.classification_head.weight)
                nn.init.zeros_(self.classification_head.bias)
            
            logger.info(f"Updated classification head for {num_categories} categories")
            
        except Exception as e:
            logger.error(f"Error updating classification head: {e}")
            raise RuntimeError(f"Classification head update failed: {e}")
    
    def preprocess_text(self, subject: str, body: str) -> str:
        """Preprocess email text for classification"""
        # Combine subject and body
        text = f"{subject} [SEP] {body}"
        
        # Clean and normalize text
        text = text.strip()
        if not text:
            text = "Empty email"
        
        return text
    
    def tokenize_batch(self, texts: List[str]) -> Dict[str, torch.Tensor]:
        """Tokenize batch of texts efficiently"""
        try:
            # Tokenize with padding and truncation
            encodings = self.tokenizer(
                texts,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt"
            )
            
            # Move to device
            encodings = {k: v.to(self.device) for k, v in encodings.items()}
            
            return encodings
            
        except Exception as e:
            logger.error(f"Error tokenizing batch: {e}")
            raise RuntimeError(f"Tokenization failed: {e}")
    
    def predict_single(self, subject: str, body: str) -> Dict[str, Any]:
        """Predict category for single email"""
        try:
            # Preprocess text
            text = self.preprocess_text(subject, body)
            
            # Check cache
            cache_key = hash(text)
            if cache_key in self.prediction_cache:
                return self.prediction_cache[cache_key]
            
            # Tokenize
            encodings = self.tokenize_batch([text])
            
            # Get predictions
            with torch.no_grad():
                outputs = self.model(**encodings)
                logits = outputs.logits
                probabilities = torch.softmax(logits, dim=1)
            
            # Get results
            predicted_id = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0][predicted_id].item()
            
            # Get category name
            category_name = self.category_manager.get_category_by_id(predicted_id)
            if not category_name:
                category_name = "Other"
            
            # Create scores dictionary
            category_names = self.category_manager.get_category_names()
            scores = {}
            for i, name in enumerate(category_names):
                if i < probabilities.shape[1]:
                    scores[name] = probabilities[0][i].item()
            
            result = {
                "label": category_name,
                "confidence": round(confidence, 4),
                "scores": scores,
                "category_id": predicted_id
            }
            
            # Cache result
            if len(self.prediction_cache) < self.cache_size:
                self.prediction_cache[cache_key] = result
            
            return result
            
        except Exception as e:
            logger.error(f"Error in single prediction: {e}")
            return {
                "label": "Other",
                "confidence": 0.0,
                "scores": {},
                "error": str(e)
            }
    
    def predict_batch(self, emails: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Predict categories for batch of emails"""
        try:
            if not emails:
                return []
            
            # Preprocess texts
            texts = []
            for email in emails:
                subject = email.get('subject', '')
                body = email.get('body', '')
                text = self.preprocess_text(subject, body)
                texts.append(text)
            
            # Process in chunks for memory efficiency
            results = []
            for i in range(0, len(texts), self.batch_size):
                chunk_texts = texts[i:i + self.batch_size]
                chunk_emails = emails[i:i + self.batch_size]
                
                # Tokenize chunk
                encodings = self.tokenize_batch(chunk_texts)
                
                # Get predictions
                with torch.no_grad():
                    outputs = self.model(**encodings)
                    logits = outputs.logits
                    probabilities = torch.softmax(logits, dim=1)
                
                # Process results
                for j, email in enumerate(chunk_emails):
                    predicted_id = torch.argmax(probabilities[j], dim=0).item()
                    confidence = probabilities[j][predicted_id].item()
                    
                    # Get category name
                    category_name = self.category_manager.get_category_by_id(predicted_id)
                    if not category_name:
                        category_name = "Other"
                    
                    # Create scores dictionary
                    category_names = self.category_manager.get_category_names()
                    scores = {}
                    for k, name in enumerate(category_names):
                        if k < probabilities.shape[1]:
                            scores[name] = probabilities[j][k].item()
                    
                    result = {
                        "label": category_name,
                        "confidence": round(confidence, 4),
                        "scores": scores,
                        "category_id": predicted_id
                    }
                    
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch prediction: {e}")
            return [{"label": "Other", "confidence": 0.0, "scores": {}, "error": str(e)} for _ in emails]
    
    def add_category(self, name: str, description: str = "", keywords: List[str] = None, color: str = "#6B7280") -> bool:
        """Add new category and update model"""
        try:
            # Add category
            success = self.category_manager.add_category(name, description, keywords, color)
            if not success:
                return False
            
            # Update classification head
            self._update_classification_head()
            
            # Clear cache
            self.prediction_cache.clear()
            
            logger.info(f"Added category '{name}' and updated model")
            return True
            
        except Exception as e:
            logger.error(f"Error adding category: {e}")
            return False
    
    def remove_category(self, name: str) -> bool:
        """Remove category and update model"""
        try:
            # Remove category
            success = self.category_manager.remove_category(name)
            if not success:
                return False
            
            # Update classification head
            self._update_classification_head()
            
            # Clear cache
            self.prediction_cache.clear()
            
            logger.info(f"Removed category '{name}' and updated model")
            return True
            
        except Exception as e:
            logger.error(f"Error removing category: {e}")
            return False
    
    def get_categories(self) -> Dict[str, Any]:
        """Get all categories"""
        return self.category_manager.get_categories()
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_name": self.model_name,
            "device": str(self.device),
            "max_length": self.max_length,
            "batch_size": self.batch_size,
            "categories": self.category_manager.get_categories(),
            "num_categories": len(self.category_manager.get_categories()),
            "cache_size": len(self.prediction_cache),
            "status": "ready" if self.model is not None else "not_loaded"
        }
    
    def clear_cache(self):
        """Clear prediction cache"""
        self.prediction_cache.clear()
        logger.info("Prediction cache cleared")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return {
            "cache_size": len(self.prediction_cache),
            "max_cache_size": self.cache_size,
            "batch_size": self.batch_size,
            "max_batch_size": self.max_batch_size,
            "device": str(self.device),
            "categories_count": len(self.category_manager.get_categories())
        }
