#!/usr/bin/env python3
"""
Simple script to train DistilBERT model with the provided dataset format
Usage: python train_with_dataset.py --data_file train_dataset.jsonl
"""

import argparse
import sys
import os
from distilbert_trainer import DistilBERTTrainer

def main():
    parser = argparse.ArgumentParser(description="Train DistilBERT with your dataset")
    parser.add_argument("--data_file", type=str, default="train_dataset.jsonl", 
                       help="Path to training dataset JSONL file")
    parser.add_argument("--output_dir", type=str, default="distilbert_models",
                       help="Output directory for trained model")
    parser.add_argument("--epochs", type=int, default=3,
                       help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16,
                       help="Training batch size")
    parser.add_argument("--learning_rate", type=float, default=2e-5,
                       help="Learning rate")
    parser.add_argument("--max_length", type=int, default=256,
                       help="Maximum token sequence length")
    
    args = parser.parse_args()
    
    # Check if dataset file exists
    if not os.path.exists(args.data_file):
        print(f"Error: Dataset file '{args.data_file}' not found!")
        print("Please make sure your train_dataset.jsonl file exists in the current directory.")
        sys.exit(1)
    
    print(f"Training DistilBERT model with:")
    print(f"  Dataset: {args.data_file}")
    print(f"  Output directory: {args.output_dir}")
    print(f"  Epochs: {args.epochs}")
    print(f"  Batch size: {args.batch_size}")
    print(f"  Learning rate: {args.learning_rate}")
    print(f"  Max length: {args.max_length}")
    print()
    
    try:
        # Initialize trainer
        trainer = DistilBERTTrainer(
            output_dir=args.output_dir,
            max_length=args.max_length
        )
        
        # Load and preprocess dataset
        print("Loading and preprocessing dataset...")
        texts, labels, label_mapping = trainer.load_and_preprocess_dataset(args.data_file)
        
        if len(texts) == 0:
            print("Error: No valid training examples found!")
            print("Please check your dataset format. Expected fields: header_subject, body_text, analysis_reasoning, trueLabel")
            sys.exit(1)
        
        print(f"Loaded {len(texts)} training examples with {len(label_mapping)} categories")
        
        # Initialize model
        print("Initializing DistilBERT model...")
        trainer.initialize_model(len(label_mapping))
        
        # Train model
        print("Starting training...")
        results = trainer.train_model(
            texts=texts,
            labels=labels,
            num_epochs=args.epochs,
            train_batch_size=args.batch_size,
            learning_rate=args.learning_rate
        )
        
        print("\nTraining completed successfully!")
        print(f"Model saved to: {results['model_path']}")
        print(f"Training loss: {results['training_loss']:.4f}")
        print("\nEvaluation Results:")
        eval_results = results['eval_results']
        print(f"  Accuracy: {eval_results['eval_accuracy']:.4f}")
        print(f"  Precision: {eval_results['eval_precision']:.4f}")
        print(f"  Recall: {eval_results['eval_recall']:.4f}")
        print(f"  F1 Score: {eval_results['eval_f1']:.4f}")
        
        print(f"\nLabel mappings saved to: {results['model_path']}/label_mappings.json")
        print("You can now use this trained model for email classification!")
        
    except Exception as e:
        print(f"Training failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
