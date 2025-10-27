"""
DistilBERT Training Script for Email Classification
Integrates with the existing model service architecture
"""

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from transformers import (
    DistilBertTokenizerFast, 
    DistilBertForSequenceClassification,
    TrainingArguments, 
    Trainer,
    AutoConfig
)
from datasets import load_dataset, Dataset as HFDataset
import numpy as np
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import logging
import json
import os
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import argparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailDataset(Dataset):
    """PyTorch Dataset for email classification"""
    
    def __init__(self, texts: List[str], labels: List[int], tokenizer, max_length: int = 256):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]
        
        # Tokenize
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

class DistilBERTTrainer:
    """Enhanced DistilBERT trainer with integration to existing architecture"""
    
    def __init__(
        self,
        model_name: str = "distilbert-base-uncased",
        max_length: int = 256,
        num_labels: Optional[int] = None,
        output_dir: str = "distilbert_models"
    ):
        self.model_name = model_name
        self.max_length = max_length
        self.num_labels = num_labels
        self.output_dir = output_dir
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Initialize components
        self.tokenizer = None
        self.model = None
        self.label2id = {}
        self.id2label = {}
        
    def load_and_preprocess_dataset(self, data_file: str) -> Tuple[List[str], List[int], Dict[str, int]]:
        """
        Load dataset from JSONL file and preprocess it
        
        Args:
            data_file: Path to JSONL file
            
        Returns:
            Tuple of (texts, labels, label_mapping)
        """
        logger.info(f"Loading dataset from {data_file}")
        
        # Check if file exists
        if not os.path.exists(data_file):
            raise FileNotFoundError(f"Dataset file {data_file} not found")
        
        # Load dataset using datasets library
        dataset = load_dataset("json", data_files=data_file)["train"]
        
        texts = []
        labels = []
        
        # Extract labels first to create mapping
        unique_labels = set()
        for example in dataset:
            if 'trueLabel' in example:
                unique_labels.add(example['trueLabel'])
            elif 'label' in example:
                unique_labels.add(example['label'])
        
        # Create label mapping
        self.label2id = {label: idx for idx, label in enumerate(sorted(unique_labels))}
        self.id2label = {idx: label for label, idx in self.label2id.items()}
        
        logger.info(f"Found {len(unique_labels)} unique labels: {list(unique_labels)}")
        
        # Process examples
        for example in dataset:
            # Combine text fields
            text_parts = []
            if 'header_subject' in example:
                text_parts.append(example['header_subject'])
            if 'body_text' in example:
                text_parts.append(example['body_text'])
            if 'analysis_reasoning' in example:
                text_parts.append(example['analysis_reasoning'])
            
            if not text_parts:
                logger.warning(f"Example missing text fields: {example.keys()}")
                continue
                
            text = " ".join(text_parts)
            
            # Get label
            label = None
            if 'trueLabel' in example:
                label = example['trueLabel']
            elif 'label' in example:
                label = example['label']
                
            if label is None or label not in self.label2id:
                logger.warning(f"Invalid label in example: {label}")
                continue
            
            texts.append(text)
            labels.append(self.label2id[label])
        
        logger.info(f"Loaded {len(texts)} training examples")
        logger.info(f"Label distribution: {dict(zip(*np.unique(labels, return_counts=True)))}")
        
        return texts, labels, self.label2id
    
    def initialize_model(self, num_labels: Optional[int] = None):
        """Initialize DistilBERT model and tokenizer"""
        if num_labels is None:
            num_labels = len(self.label2id)
        
        logger.info(f"Initializing model with {num_labels} labels")
        
        # Initialize tokenizer
        self.tokenizer = DistilBertTokenizerFast.from_pretrained(self.model_name)
        
        # Load model configuration
        config = AutoConfig.from_pretrained(
            self.model_name,
            num_labels=num_labels,
            id2label=self.id2label,
            label2id=self.label2id
        )
        
        # Initialize model
        self.model = DistilBertForSequenceClassification.from_pretrained(
            self.model_name,
            config=config
        )
        
        logger.info("Model initialized successfully")
    
    def compute_metrics(self, eval_pred):
        """Compute evaluation metrics"""
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=1)
        
        accuracy = accuracy_score(labels, predictions)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels, predictions, average='weighted'
        )
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1
        }
    
    def train_model(
        self,
        texts: List[str],
        labels: List[int],
        validation_split: float = 0.2,
        train_batch_size: int = 16,
        eval_batch_size: int = 32,
        num_epochs: int = 3,
        learning_rate: float = 2e-5,
        warmup_steps: int = 500
    ) -> Dict[str, Any]:
        """
        Train the DistilBERT model
        
        Args:
            texts: List of training texts
            labels: List of corresponding labels
            validation_split: Fraction of data to use for validation
            train_batch_size: Training batch size
            eval_batch_size: Evaluation batch size
            num_epochs: Number of training epochs
            learning_rate: Learning rate
            warmup_steps: Number of warmup steps
            
        Returns:
            Training results and metrics
        """
        logger.info(f"Starting training with {len(texts)} examples")
        
        # Split data
        split_idx = int(len(texts) * (1 - validation_split))
        train_texts = texts[:split_idx]
        train_labels = labels[:split_idx]
        val_texts = texts[split_idx:]
        val_labels = labels[split_idx:]
        
        logger.info(f"Training set: {len(train_texts)}, Validation set: {len(val_texts)}")
        
        # Create datasets
        train_dataset = EmailDataset(train_texts, train_labels, self.tokenizer, self.max_length)
        val_dataset = EmailDataset(val_texts, val_labels, self.tokenizer, self.max_length)
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir=self.output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=train_batch_size,
            per_device_eval_batch_size=eval_batch_size,
            warmup_steps=warmup_steps,
            weight_decay=0.01,
            learning_rate=learning_rate,
            logging_dir=f"{self.output_dir}/logs",
            logging_steps=100,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            save_total_limit=3,
            load_best_model_at_end=True,
            metric_for_best_model="f1",
            greater_is_better=True,
            report_to=None,  # Disable wandb/tensorboard
            seed=42,
        )
        
        # Initialize trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            compute_metrics=self.compute_metrics,
        )
        
        # Train the model
        logger.info("Starting training...")
        train_result = trainer.train()
        
        # Evaluate
        eval_result = trainer.evaluate()
        
        # Save the model
        trainer.save_model()
        self.tokenizer.save_pretrained(self.output_dir)
        
        # Save label mappings
        with open(os.path.join(self.output_dir, "label_mappings.json"), "w") as f:
            json.dump({
                "label2id": self.label2id,
                "id2label": self.id2label
            }, f, indent=2)
        
        # Prepare results
        results = {
            "training_loss": train_result.training_loss,
            "eval_results": eval_result,
            "model_path": self.output_dir,
            "label_mappings": {
                "label2id": self.label2id,
                "id2label": self.id2label
            },
            "training_config": {
                "model_name": self.model_name,
                "max_length": self.max_length,
                "num_epochs": num_epochs,
                "learning_rate": learning_rate,
                "batch_size": train_batch_size,
                "validation_split": validation_split,
                "num_labels": len(self.label2id)
            },
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Training completed successfully!")
        logger.info(f"Final evaluation metrics: {eval_result}")
        
        return results
    
    def load_trained_model(self, model_path: str):
        """Load a trained model and tokenizer"""
        logger.info(f"Loading trained model from {model_path}")
        
        # Load tokenizer
        self.tokenizer = DistilBertTokenizerFast.from_pretrained(model_path)
        
        # Load model
        self.model = DistilBertForSequenceClassification.from_pretrained(model_path)
        
        # Load label mappings
        mappings_file = os.path.join(model_path, "label_mappings.json")
        if os.path.exists(mappings_file):
            with open(mappings_file, "r") as f:
                mappings = json.load(f)
                self.label2id = mappings["label2id"]
                self.id2label = {int(k): v for k, v in mappings["id2label"].items()}
        
        self.model.eval()
        logger.info("Model loaded successfully")

def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description="Train DistilBERT for email classification")
    parser.add_argument("--data_file", type=str, default="train_dataset.jsonl", 
                       help="Path to training dataset JSONL file")
    parser.add_argument("--output_dir", type=str, default="distilbert_models",
                       help="Output directory for trained model")
    parser.add_argument("--num_epochs", type=int, default=3,
                       help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16,
                       help="Training batch size")
    parser.add_argument("--learning_rate", type=float, default=2e-5,
                       help="Learning rate")
    parser.add_argument("--max_length", type=int, default=256,
                       help="Maximum token sequence length")
    parser.add_argument("--validation_split", type=float, default=0.2,
                       help="Validation split ratio")
    
    args = parser.parse_args()
    
    # Initialize trainer
    trainer = DistilBERTTrainer(
        output_dir=args.output_dir,
        max_length=args.max_length
    )
    
    try:
        # Load and preprocess dataset
        texts, labels, label_mapping = trainer.load_and_preprocess_dataset(args.data_file)
        
        if len(texts) == 0:
            logger.error("No valid training examples found!")
            return
        
        # Initialize model
        trainer.initialize_model(len(label_mapping))
        
        # Train model
        results = trainer.train_model(
            texts=texts,
            labels=labels,
            validation_split=args.validation_split,
            train_batch_size=args.batch_size,
            num_epochs=args.num_epochs,
            learning_rate=args.learning_rate
        )
        
        # Save results
        results_file = os.path.join(args.output_dir, "training_results.json")
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Training completed! Results saved to {results_file}")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise

if __name__ == "__main__":
    main()
