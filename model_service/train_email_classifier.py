"""
Main Training Script for DistilBERT Email Classifier
Uses the DistilBERTTrainer with optimized configuration
"""

import os
import sys
import json
import argparse
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from distilbert_trainer import DistilBERTTrainer


def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description="Train DistilBERT for email classification")
    parser.add_argument("--data_file", type=str, 
                       default="model_service/email_training_dataset.jsonl",
                       help="Path to training dataset JSONL file")
    parser.add_argument("--output_dir", type=str, 
                       default="model_service/distilbert_email_model",
                       help="Output directory for trained model")
    parser.add_argument("--num_epochs", type=int, default=4,
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
    
    print("="*70)
    print(" "*20 + "DISTILBERT EMAIL CLASSIFIER TRAINING")
    print("="*70)
    print(f"\nConfiguration:")
    print(f"  Dataset: {args.data_file}")
    print(f"  Output Directory: {args.output_dir}")
    print(f"  Epochs: {args.num_epochs}")
    print(f"  Batch Size: {args.batch_size}")
    print(f"  Learning Rate: {args.learning_rate}")
    print(f"  Max Length: {args.max_length}")
    print(f"  Validation Split: {args.validation_split}")
    
    # Check if dataset exists
    if not os.path.exists(args.data_file):
        print(f"\n❌ Error: Dataset file not found: {args.data_file}")
        print("   Please run prepare_distilbert_dataset.py first.")
        return
    
    try:
        # Initialize trainer
        print("\n" + "-"*70)
        print("INITIALIZING TRAINER")
        print("-"*70)
        
        trainer = DistilBERTTrainer(
            output_dir=args.output_dir,
            max_length=args.max_length
        )
        
        # Load and preprocess dataset
        print("\n" + "-"*70)
        print("LOADING AND PREPROCESSING DATASET")
        print("-"*70)
        
        texts, labels, label_mapping = trainer.load_and_preprocess_dataset(args.data_file)
        
        if len(texts) == 0:
            print("\n❌ Error: No valid training examples found in dataset!")
            return
        
        print(f"\n✓ Dataset loaded successfully")
        print(f"  Total examples: {len(texts)}")
        print(f"  Number of categories: {len(label_mapping)}")
        print(f"  Categories: {', '.join(sorted(label_mapping.keys()))}")
        
        # Initialize model
        print("\n" + "-"*70)
        print("INITIALIZING MODEL")
        print("-"*70)
        
        trainer.initialize_model(len(label_mapping))
        print(f"✓ Model initialized with {len(label_mapping)} output classes")
        
        # Train model
        print("\n" + "-"*70)
        print("TRAINING MODEL")
        print("-"*70)
        print("\nThis may take a while depending on your hardware...")
        print("Training progress will be displayed below:\n")
        
        start_time = datetime.now()
        
        results = trainer.train_model(
            texts=texts,
            labels=labels,
            validation_split=args.validation_split,
            train_batch_size=args.batch_size,
            num_epochs=args.num_epochs,
            learning_rate=args.learning_rate
        )
        
        end_time = datetime.now()
        training_duration = (end_time - start_time).total_seconds()
        
        # Display results
        print("\n" + "="*70)
        print(" "*25 + "TRAINING COMPLETE!")
        print("="*70)
        
        print(f"\n📊 Training Results:")
        print(f"  Training Duration: {training_duration/60:.1f} minutes")
        print(f"  Final Training Loss: {results['training_loss']:.4f}")
        
        eval_results = results['eval_results']
        print(f"\n📈 Validation Metrics:")
        print(f"  Accuracy:  {eval_results['eval_accuracy']:.4f}")
        print(f"  Precision: {eval_results['eval_precision']:.4f}")
        print(f"  Recall:    {eval_results['eval_recall']:.4f}")
        print(f"  F1 Score:  {eval_results['eval_f1']:.4f}")
        
        print(f"\n💾 Model Saved:")
        print(f"  Location: {args.output_dir}")
        print(f"  Files:")
        print(f"    - pytorch_model.bin (model weights)")
        print(f"    - config.json (model configuration)")
        print(f"    - vocab.txt (tokenizer vocabulary)")
        print(f"    - label_mappings.json (category mappings)")
        print(f"    - training_results.json (detailed results)")
        
        # Save detailed results
        results_file = os.path.join(args.output_dir, "training_results.json")
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"\n✓ Detailed results saved to: {results_file}")
        
        # Print category mapping
        print(f"\n🏷️  Category Mappings:")
        for label, idx in sorted(results['label_mappings']['label2id'].items(), 
                                key=lambda x: x[1]):
            print(f"  {idx}: {label}")
        
        print("\n" + "="*70)
        print("Next steps:")
        print("  1. Review training_results.json for detailed metrics")
        print("  2. Run evaluate_model.py for comprehensive evaluation")
        print("  3. Load the model into the service:")
        print(f"     POST /model/load with {{'model_path': '{args.output_dir}'}}")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Training failed with error:")
        print(f"   {str(e)}")
        import traceback
        print("\nFull traceback:")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

