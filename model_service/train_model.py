"""
Model training module for email categorization
"""
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback
)
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import numpy as np
import logging
from typing import List, Dict, Any
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailDataset(Dataset):
    """Custom dataset for email classification"""
    
    def __init__(self, emails: List[Dict[str, str]], tokenizer, max_length: int = 512):
        self.emails = emails
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.categories = ["Academic", "Promotions", "Placement", "Spam", "Other"]
        self.label_to_id = {label: idx for idx, label in enumerate(self.categories)}
    
    def __len__(self):
        return len(self.emails)
    
    def __getitem__(self, idx):
        email = self.emails[idx]
        
        # Combine subject and body
        text = f"{email['subject']} [SEP] {email['body']}"
        
        # Tokenize
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        # Get label
        label = self.label_to_id.get(email['label'], 4)  # Default to "Other"
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

class ModelTrainer:
    """Trainer class for email categorization model"""
    
    def __init__(self, model_name: str = "distilbert-base-uncased"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.categories = ["Academic", "Promotions", "Placement", "Spam", "Other"]
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        logger.info(f"Initializing trainer with device: {self.device}")
    
    def _load_model_and_tokenizer(self):
        """Load model and tokenizer"""
        try:
            logger.info(f"Loading tokenizer: {self.model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            logger.info(f"Loading model: {self.model_name}")
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                num_labels=len(self.categories),
                problem_type="single_label_classification"
            )
            
            self.model.to(self.device)
            logger.info("Model and tokenizer loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise RuntimeError(f"Failed to load model: {e}")
    
    def _compute_metrics(self, eval_pred):
        """Compute metrics for evaluation"""
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=1)
        
        precision, recall, f1, _ = precision_recall_fscore_support(labels, predictions, average='weighted')
        accuracy = accuracy_score(labels, predictions)
        
        return {
            'accuracy': accuracy,
            'f1': f1,
            'precision': precision,
            'recall': recall
        }
    
    def train(self, training_data: List[Dict[str, str]], 
              epochs: int = 3, 
              learning_rate: float = 2e-5, 
              batch_size: int = 16) -> Dict[str, Any]:
        """
        Train the model
        
        Args:
            training_data: List of training emails with 'subject', 'body', 'label'
            epochs: Number of training epochs
            learning_rate: Learning rate for training
            batch_size: Batch size for training
            
        Returns:
            Dictionary with training results
        """
        try:
            logger.info(f"Starting training with {len(training_data)} samples")
            
            # Load model and tokenizer
            self._load_model_and_tokenizer()
            
            # Create dataset
            dataset = EmailDataset(training_data, self.tokenizer)
            
            # Split data (80% train, 20% validation)
            train_size = int(0.8 * len(dataset))
            val_size = len(dataset) - train_size
            train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
            
            # Training arguments
            training_args = TrainingArguments(
                output_dir='./model',
                num_train_epochs=epochs,
                per_device_train_batch_size=batch_size,
                per_device_eval_batch_size=batch_size,
                warmup_steps=500,
                weight_decay=0.01,
                logging_dir='./logs',
                logging_steps=10,
                evaluation_strategy="epoch",
                save_strategy="epoch",
                load_best_model_at_end=True,
                metric_for_best_model="f1",
                greater_is_better=True,
                learning_rate=learning_rate,
                save_total_limit=2,
                remove_unused_columns=False,
            )
            
            # Initialize trainer
            trainer = Trainer(
                model=self.model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=val_dataset,
                compute_metrics=self._compute_metrics,
                callbacks=[EarlyStoppingCallback(early_stopping_patience=2)]
            )
            
            # Train the model
            logger.info("Starting model training...")
            train_result = trainer.train()
            
            # Evaluate the model
            logger.info("Evaluating model...")
            eval_result = trainer.evaluate()
            
            # Save the model
            trainer.save_model()
            self.tokenizer.save_pretrained('./model')
            
            logger.info("Training completed successfully")
            
            return {
                "status": "success",
                "message": "Model trained successfully",
                "final_metrics": {
                    "accuracy": eval_result.get("eval_accuracy", 0.0),
                    "precision": eval_result.get("eval_precision", 0.0),
                    "recall": eval_result.get("eval_recall", 0.0),
                    "f1": eval_result.get("eval_f1", 0.0)
                },
                "training_loss": train_result.training_loss,
                "eval_loss": eval_result.get("eval_loss", 0.0)
            }
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {
                "status": "error",
                "message": f"Training failed: {str(e)}"
            }
    
    def load_trained_model(self, model_path: str = "./model"):
        """Load a trained model"""
        try:
            if os.path.exists(model_path):
                logger.info(f"Loading trained model from {model_path}")
                self.tokenizer = AutoTokenizer.from_pretrained(model_path)
                self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
                self.model.to(self.device)
                logger.info("Trained model loaded successfully")
                return True
            else:
                logger.warning(f"Model path {model_path} does not exist")
                return False
        except Exception as e:
            logger.error(f"Error loading trained model: {e}")
            return False
