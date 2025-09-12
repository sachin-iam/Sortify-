"""
Inference module for email categorization using Hugging Face transformers
"""
import torch
import numpy as np
from typing import Dict, Any, List, Union
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailCategorizer:
    def __init__(self, model_name: str = "distilbert-base-uncased"):
        """
        Initialize the email categorizer with Hugging Face model
        
        Args:
            model_name: Hugging Face model name
        """
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.categories = [
            "Academic", "Promotions", "Placement", "Spam", "Other"
        ]
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")
        
        # Initialize model and tokenizer
        self._load_model()
    
    def _load_model(self):
        """
        Load the pre-trained model and tokenizer
        """
        try:
            logger.info(f"Loading tokenizer: {self.model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            logger.info(f"Loading model: {self.model_name}")
            # Load model with classification head for our 5 categories
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                num_labels=len(self.categories),
                problem_type="single_label_classification"
            )
            
            # Move model to device
            self.model.to(self.device)
            self.model.eval()
            
            logger.info("Model and tokenizer loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise RuntimeError(f"Failed to load model: {e}")
    
    def preprocess_text(self, subject: str, body: str) -> Dict[str, torch.Tensor]:
        """
        Preprocess email text for model input
        
        Args:
            subject: Email subject
            body: Email body
            
        Returns:
            Tokenized input tensors
        """
        try:
            # Combine subject and body with separator
            combined_text = f"{subject} [SEP] {body}"
            
            # Tokenize and prepare input
            inputs = self.tokenizer(
                combined_text,
                truncation=True,
                padding=True,
                max_length=512,
                return_tensors="pt"
            )
            
            # Move to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            return inputs
            
        except Exception as e:
            logger.error(f"Error preprocessing text: {e}")
            raise RuntimeError(f"Text preprocessing failed: {e}")
    
    def predict(self, subject: str, body: str) -> Dict[str, Any]:
        """
        Predict email category
        
        Args:
            subject: Email subject
            body: Email body
            
        Returns:
            Dictionary with label, confidence, and scores
        """
        try:
            # Preprocess input
            inputs = self.preprocess_text(subject, body)
            
            # Get model predictions
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                probabilities = torch.softmax(logits, dim=1)
            
            # Get predicted class and confidence
            predicted_class = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0][predicted_class].item()
            
            # Get all scores
            scores = probabilities[0].cpu().numpy().tolist()
            
            # Create category scores mapping
            category_scores = dict(zip(self.categories, scores))
            
            result = {
                "label": self.categories[predicted_class],
                "confidence": round(confidence, 4),
                "scores": category_scores
            }
            
            logger.info(f"Prediction: {result['label']} (confidence: {result['confidence']:.4f})")
            return result
            
        except Exception as e:
            logger.error(f"Error during prediction: {e}")
            return {
                "label": "Other",
                "confidence": 0.0,
                "scores": dict(zip(self.categories, [0.0] * len(self.categories))),
                "error": str(e)
            }
    
    def predict_batch(self, emails: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Predict categories for multiple emails
        
        Args:
            emails: List of email dictionaries with 'subject' and 'body' keys
            
        Returns:
            List of prediction results
        """
        try:
            results = []
            for email in emails:
                if 'subject' in email and 'body' in email:
                    result = self.predict(email['subject'], email['body'])
                    results.append(result)
                else:
                    results.append({
                        "label": "Other",
                        "confidence": 0.0,
                        "scores": dict(zip(self.categories, [0.0] * len(self.categories))),
                        "error": "Missing subject or body"
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error during batch prediction: {e}")
            return []
    
    def get_labels(self) -> List[str]:
        """
        Get list of available category labels
        
        Returns:
            List of category names
        """
        return self.categories.copy()
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information
        
        Returns:
            Dictionary with model details
        """
        return {
            "model_name": self.model_name,
            "categories": self.categories,
            "device": str(self.device),
            "num_labels": len(self.categories),
            "status": "ready" if self.model is not None else "not_loaded"
        }
