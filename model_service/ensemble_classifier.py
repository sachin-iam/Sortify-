"""
Ensemble Email Classifier
Combines DistilBERT text classification with feature-based ML for high accuracy
"""

import torch
import torch.nn as nn
import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import xgboost as xgb
import joblib
import os
import json
from datetime import datetime

from dynamic_classifier import DynamicEmailClassifier
from feature_extractor import EmailFeatureExtractor, normalize_features

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FeatureBasedClassifier:
    """Traditional ML classifier for metadata and structural features"""
    
    def __init__(self, model_type: str = 'xgboost'):
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_names = None
        self.is_trained = False
        
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the ML model"""
        if self.model_type == 'xgboost':
            self.model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'random_forest':
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'logistic_regression':
            self.model = LogisticRegression(
                random_state=42,
                max_iter=1000,
                n_jobs=-1
            )
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
    
    def prepare_features(self, features: Dict[str, Any]) -> np.ndarray:
        """Prepare and normalize features for ML model"""
        normalized_features = normalize_features(features)
        
        # Define expected feature order (these should match training features)
        expected_features = [
            'subject_length', 'subject_word_count', 'subject_has_urgency', 'subject_caps_ratio',
            'total_text_length', 'total_word_count', 'body_length', 'body_word_count',
            'has_html', 'html_length', 'html_to_text_ratio', 'html_image_count',
            'has_hidden_text', 'business_keyword_count', 'academic_keyword_count', 'job_keyword_count',
            'link_count', 'has_links', 'external_link_count', 'unique_domain_count', 'short_url_count',
            'sender_name_length', 'sender_email_length', 'domain_levels', 'is_common_domain',
            'recipient_count', 'hour_of_day', 'day_of_week', 'is_business_hour', 'is_weekend',
            'attachment_count', 'has_attachments', 'total_attachment_size', 'avg_attachment_size',
            'unique_extension_count', 'suspicious_extension_count', 'has_pdf_attachment',
            'has_image_attachment', 'has_document_attachment', 'subject_exclamation_count',
            'subject_question_count', 'subject_number_count', 'body_paragraph_count',
            'avg_paragraph_length', 'html_table_count', 'html_list_count', 'html_form_count',
            'has_spf', 'has_dkim', 'has_dmarc', 'has_reply_to', 'has_priority_header'
        ]
        
        # Add categorical feature hashes
        categorical_features = ['sender_domain_hash', 'sender_tld_hash']
        expected_features.extend(categorical_features)
        
        # Create feature vector
        feature_vector = []
        for feature_name in expected_features:
            if feature_name in normalized_features:
                feature_vector.append(normalized_features[feature_name])
            else:
                feature_vector.append(0.0)  # Default value for missing features
        
        return np.array(feature_vector).reshape(1, -1)
    
    def train(self, X: np.ndarray, y: np.ndarray):
        """Train the feature-based classifier"""
        try:
            logger.info(f"Training {self.model_type} with {len(X)} samples")
            
            # Fit scaler and transform features
            X_scaled = self.scaler.fit_transform(X)
            
            # Fit label encoder
            y_encoded = self.label_encoder.fit_transform(y)
            
            # Train model
            self.model.fit(X_scaled, y_encoded)
            self.feature_names = [f"feature_{i}" for i in range(X.shape[1])]
            self.is_trained = True
            
            logger.info(f"Feature-based classifier training completed")
            
        except Exception as e:
            logger.error(f"Error training feature-based classifier: {e}")
            raise
    
    def predict(self, features: Dict[str, Any]) -> Tuple[str, float, Dict[str, float]]:
        """Predict using feature-based model"""
        try:
            if not self.is_trained:
                return "Other", 0.0, {}
            
            # Prepare features
            X = self.prepare_features(features)
            X_scaled = self.scaler.transform(X)
            
            # Get predictions
            predictions = self.model.predict_proba(X_scaled)[0]
            predicted_class_idx = np.argmax(predictions)
            confidence = predictions[predicted_class_idx]
            
            # Decode label
            predicted_label = self.label_encoder.inverse_transform([predicted_class_idx])[0]
            
            # Create scores dictionary
            scores = {}
            for i, label in enumerate(self.label_encoder.classes_):
                scores[label] = float(predictions[i])
            
            return predicted_label, float(confidence), scores
            
        except Exception as e:
            logger.error(f"Error in feature-based prediction: {e}")
            return "Other", 0.0, {}

class ModelFusion:
    """Combine predictions from different models with weighted confidence"""
    
    def __init__(self, distilbert_weight: float = 0.6, feature_weight: float = 0.4):
        self.distilbert_weight = distilbert_weight
        self.feature_weight = feature_weight
        self.total_weight = distilbert_weight + feature_weight
        
        # Normalize weights
        self.distilbert_weight /= self.total_weight
        self.feature_weight /= self.total_weight
    
    def fuse_predictions(
        self, 
        distilbert_result: Dict[str, Any], 
        feature_result: Tuple[str, float, Dict[str, float]]
    ) -> Dict[str, Any]:
        """Combine predictions from both models"""
        try:
            feature_label, feature_confidence, feature_scores = feature_result
            
            # Get DistilBERT results
            distilbert_label = distilbert_result.get('label', 'Other')
            distilbert_confidence = distilbert_result.get('confidence', 0.0)
            distilbert_scores = distilbert_result.get('scores', {})
            
            # Get all unique labels from both models
            all_labels = set(distilbert_scores.keys()) | set(feature_scores.keys())
            
            # Weighted combination of scores
            combined_scores = {}
            for label in all_labels:
                distilbert_score = distilbert_scores.get(label, 0.0)
                feature_score = feature_scores.get(label, 0.0)
                
                combined_score = (
                    distilbert_score * self.distilbert_weight + 
                    feature_score * self.feature_weight
                )
                combined_scores[label] = combined_score
            
            # Find best label and confidence
            best_label = max(combined_scores.items(), key=lambda x: x[1])
            best_label_name = best_label[0]
            best_confidence = best_label[1]
            
            # Dynamic weighting based on individual model confidence
            if distilbert_confidence > 0.8 and feature_confidence < 0.6:
                # High DistilBERT confidence, low feature confidence - boost DistilBERT
                adjusted_confidence = min(0.95, distilbert_confidence * 0.8 + best_confidence * 0.2)
            elif feature_confidence > 0.8 and distilbert_confidence < 0.6:
                # High feature confidence, low DistilBERT confidence - boost feature model
                adjusted_confidence = min(0.95, feature_confidence * 0.8 + best_confidence * 0.2)
            else:
                # Balanced scenario - use combined confidence
                adjusted_confidence = best_confidence
            
            # Fallback logic for very low confidence
            if adjusted_confidence < 0.3:
                # If both models are uncertain, prefer DistilBERT with lower confidence
                fallback_confidence = max(distilbert_confidence, feature_confidence) * 0.7
                if distilbert_confidence >= feature_confidence:
                    best_label_name = distilbert_label
                    adjusted_confidence = fallback_confidence
                else:
                    best_label_name = feature_label
                    adjusted_confidence = fallback_confidence
            
            return {
                'label': best_label_name,
                'confidence': round(adjusted_confidence, 4),
                'scores': combined_scores,
                'ensembleScores': {
                    'distilbert': distilbert_confidence,
                    'featureBased': feature_confidence,
                    'combined': adjusted_confidence
                },
                'featureContributions': {
                    'distilbertWeight': self.distilbert_weight,
                    'featureWeight': self.feature_weight
                }
            }
            
        except Exception as e:
            logger.error(f"Error in model fusion: {e}")
            # Fallback to DistilBERT result
            return {
                'label': distilbert_result.get('label', 'Other'),
                'confidence': distilbert_result.get('confidence', 0.5),
                'scores': distilbert_result.get('scores', {}),
                'ensembleScores': {
                    'distilbert': distilbert_result.get('confidence', 0.5),
                    'featureBased': 0.0,
                    'combined': distilbert_result.get('confidence', 0.5)
                },
                'featureContributions': {
                    'distilbertWeight': 1.0,
                    'featureWeight': 0.0
                }
            }

class EnsembleEmailClassifier:
    """Main ensemble classifier combining DistilBERT and feature-based ML"""
    
    def __init__(
        self, 
        distilbert_model: Optional[DynamicEmailClassifier] = None,
        feature_model_type: str = 'xgboost',
        distilbert_weight: float = 0.6,
        feature_weight: float = 0.4
    ):
        self.distilbert_weight = distilbert_weight
        self.feature_weight = feature_weight
        
        # Initialize components
        self.distilbert_classifier = distilbert_model or DynamicEmailClassifier()
        self.feature_classifier = FeatureBasedClassifier(feature_model_type)
        self.feature_extractor = EmailFeatureExtractor()
        self.model_fusion = ModelFusion(distilbert_weight, feature_weight)
        
        # Performance tracking
        self.prediction_count = 0
        self.feature_extraction_time = 0.0
        self.prediction_time = 0.0
    
    def train_feature_model(self, training_data: List[Dict[str, Any]]):
        """Train the feature-based classifier"""
        try:
            logger.info(f"Training feature model with {len(training_data)} samples")
            
            X = []
            y = []
            
            for sample in training_data:
                # Extract features
                features = sample.get('features', {})
                if not features:
                    # Extract features from email data
                    email_data = {
                        'subject': sample.get('subject', ''),
                        'body': sample.get('body', ''),
                        'html': sample.get('html', ''),
                        'from': sample.get('from', ''),
                        'to': sample.get('to', ''),
                        'date': sample.get('date'),
                        'attachments': sample.get('attachments', [])
                    }
                    features = self.feature_extractor.extract_features(email_data)
                
                # Prepare feature vector
                feature_vector = self.feature_classifier.prepare_features(features)
                X.append(feature_vector.flatten())
                
                # Get label
                label = sample.get('trueLabel') or sample.get('label', 'Other')
                y.append(label)
            
            X = np.array(X)
            y = np.array(y)
            
            # Train the model
            self.feature_classifier.train(X, y)
            
            logger.info("Feature-based classifier training completed successfully")
            
        except Exception as e:
            logger.error(f"Error training feature-based classifier: {e}")
            raise
    
    def predict_single(self, subject: str, body: str, email_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Predict category for single email using ensemble approach"""
        try:
            start_time = datetime.now()
            
            # Extract features if not provided
            if email_data is None:
                email_data = {
                    'subject': subject,
                    'body': body,
                    'html': '',
                    'from': '',
                    'to': '',
                    'date': None,
                    'attachments': []
                }
            
            # Extract comprehensive features
            features = self.feature_extractor.extract_features(email_data)
            
            # Get DistilBERT prediction
            distilbert_result = self.distilbert_classifier.predict_single(subject, body)
            
            # Get feature-based prediction
            feature_result = self.feature_classifier.predict(features)
            
            # Fuse predictions
            ensemble_result = self.model_fusion.fuse_predictions(distilbert_result, feature_result)
            
            # Add feature extraction metadata
            ensemble_result['features'] = features
            ensemble_result['extractionTime'] = (datetime.now() - start_time).total_seconds()
            
            # Update performance stats
            self.prediction_count += 1
            self.prediction_time += ensemble_result['extractionTime']
            
            return ensemble_result
            
        except Exception as e:
            logger.error(f"Error in ensemble prediction: {e}")
            # Fallback to DistilBERT only
            return self.distilbert_classifier.predict_single(subject, body)
    
    def predict_batch(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Predict categories for batch of emails"""
        try:
            results = []
            
            for email in emails:
                subject = email.get('subject', '')
                body = email.get('body', '')
                
                # Extract additional email data for feature extraction
                email_data = {
                    'subject': subject,
                    'body': body,
                    'html': email.get('html', ''),
                    'from': email.get('from', ''),
                    'to': email.get('to', ''),
                    'date': email.get('date'),
                    'attachments': email.get('attachments', []),
                    'headers': email.get('headers', {})
                }
                
                result = self.predict_single(subject, body, email_data)
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch prediction: {e}")
            # Fallback to DistilBERT batch prediction
            return self.distilbert_classifier.predict_batch(emails)
    
    def get_categories(self) -> Dict[str, Any]:
        """Get all available categories"""
        return self.distilbert_classifier.get_categories()
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get comprehensive model information"""
        base_info = self.distilbert_classifier.get_model_info()
        
        ensemble_info = {
            **base_info,
            'ensemble_weights': {
                'distilbert': self.distilbert_weight,
                'feature_based': self.feature_weight
            },
            'feature_model_type': self.feature_classifier.model_type,
            'feature_model_trained': self.feature_classifier.is_trained,
            'prediction_count': self.prediction_count,
            'avg_prediction_time': (
                self.prediction_time / max(self.prediction_count, 1)
            )
        }
        
        return ensemble_info
    
    def save_models(self, save_dir: str = "models"):
        """Save both DistilBERT and feature-based models"""
        try:
            os.makedirs(save_dir, exist_ok=True)
            
            # Save feature-based model
            feature_model_path = os.path.join(save_dir, "feature_classifier.joblib")
            model_data = {
                'model': self.feature_classifier.model,
                'scaler': self.feature_classifier.scaler,
                'label_encoder': self.feature_classifier.label_encoder,
                'feature_names': self.feature_classifier.feature_names,
                'model_type': self.feature_classifier.model_type,
                'is_trained': self.feature_classifier.is_trained
            }
            joblib.dump(model_data, feature_model_path)
            
            # Save ensemble configuration
            config_path = os.path.join(save_dir, "ensemble_config.json")
            config = {
                'distilbert_weight': self.distilbert_weight,
                'feature_weight': self.feature_weight,
                'feature_model_type': self.feature_classifier.model_type,
                'save_timestamp': datetime.now().isoformat()
            }
            
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            logger.info(f"Models saved to {save_dir}")
            
        except Exception as e:
            logger.error(f"Error saving models: {e}")
            raise
    
    def load_models(self, save_dir: str = "models"):
        """Load saved feature-based model"""
        try:
            feature_model_path = os.path.join(save_dir, "feature_classifier.joblib")
            
            if os.path.exists(feature_model_path):
                model_data = joblib.load(feature_model_path)
                self.feature_classifier.model = model_data['model']
                self.feature_classifier.scaler = model_data['scaler']
                self.feature_classifier.label_encoder = model_data['label_encoder']
                self.feature_classifier.feature_names = model_data['feature_names']
                self.feature_classifier.is_trained = model_data['is_trained']
                
                logger.info("Feature-based model loaded successfully")
            
            # Load ensemble configuration
            config_path = os.path.join(save_dir, "ensemble_config.json")
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    config = json.load(f)
                
                self.distilbert_weight = config.get('distilbert_weight', 0.6)
                self.feature_weight = config.get('feature_weight', 0.4)
                self.model_fusion = ModelFusion(self.distilbert_weight, self.feature_weight)
                
                logger.info("Ensemble configuration loaded")
            
        except Exception as e:
            logger.warning(f"Error loading models: {e}")
            # Continue with default settings
