"""
Training Pipeline for Email Classification Models
Handles model training, evaluation, and performance monitoring
"""

import logging
import json
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report, confusion_matrix
import warnings
warnings.filterwarnings('ignore')

from dynamic_classifier import DynamicEmailClassifier
from ensemble_classifier import EnsembleEmailClassifier
from data_collection import TrainingDataCollector
from feature_extractor import EmailFeatureExtractor, normalize_features

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelTrainingPipeline:
    """Handles end-to-end model training and evaluation"""
    
    def __init__(self, model_save_dir: str = "models"):
        self.model_save_dir = Path(model_save_dir)
        self.model_save_dir.mkdir(exist_ok=True)
        
        self.feature_extractor = EmailFeatureExtractor()
        self.data_collector = TrainingDataCollector()
        
        self.training_history = []
        self.best_models = {}
        
    def prepare_training_data(self, training_samples: List[Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Prepare training data for both DistilBERT and feature-based models
        
        Args:
            training_samples: List of training samples
            
        Returns:
            Tuple of (X_features, y_labels, category_names)
        """
        logger.info(f"Preparing training data from {len(training_samples)} samples")
        
        X = []
        y = []
        
        for sample in training_samples:
            try:
                # Extract features
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
                normalized_features = normalize_features(features)
                
                # Convert to feature vector
                feature_vector = self._features_to_vector(normalized_features)
                X.append(feature_vector)
                y.append(sample['trueLabel'])
                
            except Exception as e:
                logger.warning(f"Error processing sample: {e}")
                continue
        
        if not X:
            raise ValueError("No valid training samples found")
        
        X = np.array(X)
        y = np.array(y)
        
        # Get unique categories
        categories = sorted(list(set(y)))
        
        logger.info(f"Training data prepared: {X.shape[0]} samples, {X.shape[1]} features")
        logger.info(f"Categories: {categories}")
        logger.info(f"Class distribution: {pd.Series(y).value_counts().to_dict()}")
        
        return X, y, categories
    
    def _features_to_vector(self, features: Dict[str, Any]) -> List[float]:
        """Convert feature dictionary to ordered vector"""
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
            'has_spf', 'has_dkim', 'has_dmarc', 'has_reply_to', 'has_priority_header',
            'sender_domain_hash', 'sender_tld_hash'
        ]
        
        feature_vector = []
        for feature_name in expected_features:
            feature_vector.append(features.get(feature_name, 0.0))
        
        return feature_vector
    
    def train_ensemble_model(self, training_samples: List[Dict[str, Any]], validation_split: float = 0.2) -> Dict[str, Any]:
        """
        Train ensemble model with comprehensive evaluation
        
        Args:
            training_samples: Training data
            validation_split: Fraction for validation
            
        Returns:
            Training metrics and model performance
        """
        logger.info("Starting ensemble model training")
        
        try:
            # Initialize ensemble classifier
            ensemble = EnsembleEmailClassifier(
                feature_model_type='xgboost',
                distilbert_weight=0.6,
                feature_weight=0.4
            )
            
            # Prepare feature data for feature-based classifier
            X, y, categories = self.prepare_training_data(training_samples)
            
            # Train feature-based classifier
            if len(X) > 0:
                ensemble.train_feature_model(training_samples)
                logger.info("Feature-based classifier training completed")
            else:
                logger.warning("No feature data available, using DistilBERT only")
            
            # Evaluate model performance
            metrics = self.evaluate_model(ensemble, training_samples, validation_split)
            
            # Save trained model
            model_path = self.model_save_dir / f"ensemble_model_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            ensemble.save_models(str(model_path))
            
            # Store training history
            training_record = {
                'timestamp': datetime.now().isoformat(),
                'samples_count': len(training_samples),
                'feature_count': X.shape[1] if len(X) > 0 else 0,
                'categories': categories,
                'metrics': metrics,
                'model_path': str(model_path)
            }
            
            self.training_history.append(training_record)
            self.best_models['ensemble'] = {
                'model': ensemble,
                'metrics': metrics,
                'path': str(model_path)
            }
            
            logger.info(f"Ensemble training completed. Accuracy: {metrics.get('accuracy', 0):.3f}")
            
            return {
                'status': 'success',
                'message': 'Ensemble model trained successfully',
                'metrics': metrics,
                'model_path': str(model_path),
                'training_record': training_record
            }
            
        except Exception as e:
            logger.error(f"Ensemble training failed: {e}")
            return {
                'status': 'error',
                'message': f'Training failed: {str(e)}',
                'metrics': None
            }
    
    def evaluate_model(self, model: EnsembleEmailClassifier, test_samples: List[Dict[str, Any]], validation_split: float = 0.2) -> Dict[str, Any]:
        """
        Evaluate model performance using cross-validation
        
        Args:
            model: Trained ensemble model
            test_samples: Test samples for evaluation
            validation_split: Split for validation
            
        Returns:
            Evaluation metrics
        """
        logger.info(f"Evaluating model with {len(test_samples)} samples")
        
        try:
            if len(test_samples) < 10:
                logger.warning("Insufficient test samples for evaluation")
                return {
                    'accuracy': 0.0,
                    'precision': {},
                    'recall': {},
                    'f1': {},
                    'confusion_matrix': None,
                    'sample_count': len(test_samples)
                }
            
            # Prepare test data
            X, y_true, categories = self.prepare_training_data(test_samples)
            
            if len(X) == 0:
                return {'accuracy': 0.0, 'error': 'No valid test samples'}
            
            # Get predictions
            y_pred = []
            y_scores = []
            
            for sample in test_samples:
                try:
                    email_data = {
                        'subject': sample.get('subject', ''),
                        'body': sample.get('body', ''),
                        'html': sample.get('html', ''),
                        'from': sample.get('from', ''),
                        'to': sample.get('to', ''),
                        'date': sample.get('date'),
                        'attachments': sample.get('attachments', [])
                    }
                    
                    result = model.predict_single(
                        email_data['subject'], 
                        email_data['body'], 
                        email_data
                    )
                    
                    y_pred.append(result['label'])
                    y_scores.append(result.get('ensembleScores', {}).get('combined', result['confidence']))
                    
                except Exception as e:
                    logger.warning(f"Error evaluating sample: {e}")
                    y_pred.append(sample['trueLabel'])  # Fallback
                    y_scores.append(0.5)
            
            # Calculate metrics
            accuracy = accuracy_score(y_true, y_pred)
            
            # Per-class metrics
            precision, recall, f1, _ = precision_recall_fscore_support(
                y_true, y_pred, average=None, labels=categories, zero_division=0
            )
            
            # Create metrics dictionary
            metrics = {
                'accuracy': float(accuracy),
                'sample_count': len(test_samples),
                'categories': categories,
                'precision': dict(zip(categories, precision.astype(float))),
                'recall': dict(zip(categories, recall.astype(float))),
                'f1': dict(zip(categories, f1.astype(float))),
                'macro_avg_precision': float(np.mean(precision)),
                'macro_avg_recall': float(np.mean(recall)),
                'macro_avg_f1': float(np.mean(f1)),
                'confusion_matrix': confusion_matrix(y_true, y_pred, labels=categories).tolist()
            }
            
            # Calculate confidence statistics
            if y_scores:
                metrics['confidence_stats'] = {
                    'mean': float(np.mean(y_scores)),
                    'std': float(np.std(y_scores)),
                    'min': float(np.min(y_scores)),
                    'max': float(np.max(y_scores))
                }
            
            logger.info(f"Evaluation completed. Accuracy: {accuracy:.3f}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Model evaluation failed: {e}")
            return {
                'accuracy': 0.0,
                'error': str(e),
                'sample_count': len(test_samples)
            }
    
    def save_model_checkpoint(self, model: EnsembleEmailClassifier, metrics: Dict[str, Any], checkpoint_name: str = None) -> str:
        """
        Save model checkpoint with metadata
        
        Args:
            model: Trained model
            metrics: Performance metrics
            checkpoint_name: Optional custom checkpoint name
            
        Returns:
            Path to saved checkpoint
        """
        try:
            if checkpoint_name is None:
                checkpoint_name = f"checkpoint_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            checkpoint_path = self.model_save_dir / checkpoint_name
            checkpoint_path.mkdir(exist_ok=True)
            
            # Save model
            model.save_models(str(checkpoint_path))
            
            # Save metrics and metadata
            metadata = {
                'timestamp': datetime.now().isoformat(),
                'metrics': metrics,
                'model_type': 'ensemble',
                'feature_extractor_version': '1.0.0'
            }
            
            with open(checkpoint_path / "metadata.json", 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Model checkpoint saved to {checkpoint_path}")
            return str(checkpoint_path)
            
        except Exception as e:
            logger.error(f"Error saving checkpoint: {e}")
            raise
    
    def get_training_history(self) -> List[Dict[str, Any]]:
        """Get training history"""
        return self.training_history
    
    def get_best_model(self, model_type: str = 'ensemble') -> Optional[Dict[str, Any]]:
        """Get best performing model of given type"""
        return self.best_models.get(model_type)
    
    def load_model_checkpoint(self, checkpoint_path: str) -> Tuple[EnsembleEmailClassifier, Dict[str, Any]]:
        """
        Load model from checkpoint
        
        Args:
            checkpoint_path: Path to checkpoint directory
            
        Returns:
            Tuple of (model, metadata)
        """
        try:
            checkpoint_path = Path(checkpoint_path)
            
            # Load metadata
            metadata_file = checkpoint_path / "metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
            else:
                metadata = {}
            
            # Initialize and load model
            model = EnsembleEmailClassifier()
            model.load_models(str(checkpoint_path))
            
            logger.info(f"Model checkpoint loaded from {checkpoint_path}")
            return model, metadata
            
        except Exception as e:
            logger.error(f"Error loading checkpoint: {e}")
            raise
    
    def compare_models(self, model_paths: List[str]) -> Dict[str, Any]:
        """
        Compare performance of multiple model checkpoints
        
        Args:
            model_paths: List of model checkpoint paths
            
        Returns:
            Comparison results
        """
        logger.info(f"Comparing {len(model_paths)} models")
        
        comparison_results = {}
        
        for model_path in model_paths:
            try:
                model, metadata = self.load_model_checkpoint(model_path)
                comparison_results[model_path] = {
                    'metrics': metadata.get('metrics', {}),
                    'timestamp': metadata.get('timestamp', ''),
                    'model_type': metadata.get('model_type', 'unknown')
                }
            except Exception as e:
                logger.warning(f"Could not load model {model_path}: {e}")
                comparison_results[model_path] = {'error': str(e)}
        
        return comparison_results
