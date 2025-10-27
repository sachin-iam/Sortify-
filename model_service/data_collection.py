"""
Data Collection Pipeline for Email Classification Training
Collects and prepares training data from existing classified emails
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import pandas as pd
from pathlib import Path

from feature_extractor import EmailFeatureExtractor, normalize_features

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrainingDataCollector:
    """Collect and prepare training data from existing classified emails"""
    
    def __init__(self):
        self.feature_extractor = EmailFeatureExtractor()
        self.collected_samples = []
    
    def collect_from_existing_data(
        self, 
        emails_data: List[Dict[str, Any]], 
        min_confidence: float = 0.6,
        max_samples_per_category: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Collect training samples from existing classified emails
        
        Args:
            emails_data: List of email dictionaries with classification info
            min_confidence: Minimum confidence threshold for including samples
            max_samples_per_category: Maximum samples per category
        
        Returns:
            List of training samples ready for model training
        """
        logger.info(f"Collecting training data from {len(emails_data)} emails")
        
        training_samples = []
        category_counts = {}
        
        for email in emails_data:
            try:
                # Extract email content and metadata
                email_data = {
                    'subject': email.get('subject', ''),
                    'body': email.get('body', '') or email.get('text', ''),
                    'html': email.get('html', ''),
                    'from': email.get('from', ''),
                    'to': email.get('to', ''),
                    'date': email.get('date'),
                    'attachments': email.get('attachments', [])
                }
                
                # Get classification info
                classification = email.get('classification', {})
                label = classification.get('label') or email.get('category', 'Other')
                confidence = classification.get('confidence', 0.5)
                
                # Skip low confidence samples unless manually labeled
                if confidence < min_confidence and not email.get('isValidated', False):
                    continue
                
                # Limit samples per category
                category_counts[label] = category_counts.get(label, 0) + 1
                if category_counts[label] > max_samples_per_category:
                    continue
                
                # Extract features
                features = self.feature_extractor.extract_features(email_data)
                
                # Create training sample
                training_sample = {
                    'subject': email_data['subject'],
                    'body': email_data['body'],
                    'html': email_data['html'],
                    'from': email_data['from'],
                    'to': email_data['to'],
                    'date': email_data['date'],
                    'features': features,
                    'trueLabel': label,
                    'predictedLabel': label,  # For training, use true label
                    'confidence': confidence,
                    'labeledBy': 'system' if not email.get('isValidated') else 'user',
                    'labeledAt': email.get('classifiedAt') or datetime.now().isoformat(),
                    'isValidated': email.get('isValidated', confidence >= 0.8),
                    'source': 'initial_training',
                    'metadata': {
                        'originalClassification': classification,
                        'extractedFeatures': features
                    }
                }
                
                training_samples.append(training_sample)
                
            except Exception as e:
                logger.warning(f"Error processing email {email.get('id', 'unknown')}: {e}")
                continue
        
        logger.info(f"Collected {len(training_samples)} training samples")
        logger.info(f"Category distribution: {category_counts}")
        
        return training_samples
    
    def prepare_feature_matrix(self, training_samples: List[Dict[str, Any]]) -> tuple:
        """
        Prepare feature matrix and labels for ML training
        
        Args:
            training_samples: List of training samples
            
        Returns:
            Tuple of (X, y) where X is feature matrix and y is labels
        """
        logger.info("Preparing feature matrix for training")
        
        X = []
        y = []
        sample_ids = []
        
        for i, sample in enumerate(training_samples):
            try:
                features = sample.get('features', {})
                normalized_features = normalize_features(features)
                
                # Convert to array in consistent order
                feature_vector = self._features_to_vector(normalized_features)
                X.append(feature_vector)
                y.append(sample['trueLabel'])
                sample_ids.append(i)
                
            except Exception as e:
                logger.warning(f"Error processing sample {i}: {e}")
                continue
        
        if not X:
            raise ValueError("No valid training samples found")
        
        logger.info(f"Prepared feature matrix: {len(X)} samples, {len(X[0])} features")
        logger.info(f"Label distribution: {pd.Series(y).value_counts().to_dict()}")
        
        return X, y
    
    def _features_to_vector(self, features: Dict[str, Any]) -> List[float]:
        """Convert feature dictionary to ordered vector"""
        # This should match the feature order in ensemble_classifier.py
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
    
    def export_training_data(
        self, 
        training_samples: List[Dict[str, Any]], 
        output_path: str = "training_data.json"
    ) -> str:
        """
        Export training data to JSON file
        
        Args:
            training_samples: List of training samples
            output_path: Output file path
            
        Returns:
            Path to exported file
        """
        try:
            # Prepare data for JSON serialization
            export_data = {
                'metadata': {
                    'exportedAt': datetime.now().isoformat(),
                    'totalSamples': len(training_samples),
                    'featureExtractorVersion': '1.0.0'
                },
                'categories': list(set(sample['trueLabel'] for sample in training_samples)),
                'samples': training_samples
            }
            
            # Write to file
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"Training data exported to {output_path}")
            return str(output_file)
            
        except Exception as e:
            logger.error(f"Error exporting training data: {e}")
            raise
    
    def import_training_data(self, input_path: str) -> List[Dict[str, Any]]:
        """
        Import training data from JSON file
        
        Args:
            input_path: Path to training data JSON file
            
        Returns:
            List of training samples
        """
        try:
            with open(input_path, 'r') as f:
                data = json.load(f)
            
            samples = data.get('samples', [])
            logger.info(f"Imported {len(samples)} training samples from {input_path}")
            
            return samples
            
        except Exception as e:
            logger.error(f"Error importing training data: {e}")
            raise
    
    def get_data_statistics(self, training_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get statistics about the training dataset
        
        Args:
            training_samples: List of training samples
            
        Returns:
            Dictionary with dataset statistics
        """
        if not training_samples:
            return {}
        
        # Category distribution
        categories = [sample['trueLabel'] for sample in training_samples]
        category_counts = pd.Series(categories).value_counts().to_dict()
        
        # Confidence distribution
        confidences = [sample.get('confidence', 0.0) for sample in training_samples]
        
        # Label source distribution
        labeled_by = [sample.get('labeledBy', 'unknown') for sample in training_samples]
        labeled_by_counts = pd.Series(labeled_by).value_counts().to_dict()
        
        # Feature statistics
        feature_counts = []
        for sample in training_samples:
            features = sample.get('features', {})
            feature_counts.append(len(features))
        
        return {
            'totalSamples': len(training_samples),
            'categories': category_counts,
            'labeledBy': labeled_by_counts,
            'confidenceStats': {
                'mean': float(pd.Series(confidences).mean()) if confidences else 0.0,
                'std': float(pd.Series(confidences).std()) if confidences else 0.0,
                'min': float(min(confidences)) if confidences else 0.0,
                'max': float(max(confidences)) if confidences else 0.0
            },
            'featureStats': {
                'meanFeatureCount': float(pd.Series(feature_counts).mean()) if feature_counts else 0.0,
                'minFeatures': min(feature_counts) if feature_counts else 0,
                'maxFeatures': max(feature_counts) if feature_counts else 0
            },
            'validatedSamples': sum(1 for sample in training_samples if sample.get('isValidated', False))
        }
