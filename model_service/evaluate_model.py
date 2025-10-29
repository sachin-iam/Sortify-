"""
Model Evaluation Script
Comprehensive evaluation of trained DistilBERT model with per-category metrics
"""

import os
import sys
import json
import argparse
from collections import defaultdict, Counter
from typing import Dict, List, Any
import numpy as np

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from distilbert_trainer import DistilBERTTrainer
import torch


class ModelEvaluator:
    """Evaluate trained DistilBERT model"""
    
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.trainer = DistilBERTTrainer(output_dir=model_path)
        self.trainer.load_trained_model(model_path)
        
        print(f"✓ Model loaded from {model_path}")
    
    def predict_batch(self, texts: List[str]) -> tuple:
        """Predict labels for a batch of texts"""
        predictions = []
        confidences = []
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.trainer.model.to(device)
        self.trainer.model.eval()
        
        with torch.no_grad():
            for text in texts:
                # Tokenize
                inputs = self.trainer.tokenizer(
                    text,
                    truncation=True,
                    padding='max_length',
                    max_length=self.trainer.max_length,
                    return_tensors='pt'
                )
                
                # Move to device
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                # Predict
                outputs = self.trainer.model(**inputs)
                logits = outputs.logits
                
                # Get prediction and confidence
                probs = torch.softmax(logits, dim=-1)
                pred_id = torch.argmax(probs, dim=-1).item()
                confidence = probs[0][pred_id].item()
                
                predictions.append(pred_id)
                confidences.append(confidence)
        
        return predictions, confidences
    
    def calculate_metrics(self, y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
        """Calculate evaluation metrics"""
        from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
        
        accuracy = accuracy_score(y_true, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average='weighted', zero_division=0
        )
        
        # Per-class metrics
        precision_per_class, recall_per_class, f1_per_class, support = \
            precision_recall_fscore_support(y_true, y_pred, average=None, zero_division=0)
        
        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        
        return {
            'accuracy': accuracy,
            'precision_weighted': precision,
            'recall_weighted': recall,
            'f1_weighted': f1,
            'precision_per_class': precision_per_class.tolist(),
            'recall_per_class': recall_per_class.tolist(),
            'f1_per_class': f1_per_class.tolist(),
            'support_per_class': support.tolist(),
            'confusion_matrix': cm.tolist()
        }
    
    def evaluate_dataset(self, dataset_file: str) -> Dict[str, Any]:
        """Evaluate model on a dataset"""
        print(f"\nEvaluating on {dataset_file}...")
        
        # Load dataset
        from datasets import load_dataset
        dataset = load_dataset("json", data_files=dataset_file)["train"]
        
        texts = []
        true_labels = []
        
        for example in dataset:
            # Get text
            text_parts = []
            if 'text' in example:
                text = example['text']
            else:
                if 'header_subject' in example:
                    text_parts.append(example['header_subject'])
                if 'body_text' in example:
                    text_parts.append(example['body_text'])
                text = " ".join(text_parts)
            
            # Get label
            if 'label' in example:
                label_name = example['label']
            elif 'trueLabel' in example:
                label_name = example['trueLabel']
            else:
                continue
            
            if label_name not in self.trainer.label2id:
                continue
            
            texts.append(text)
            true_labels.append(self.trainer.label2id[label_name])
        
        print(f"  Loaded {len(texts)} examples")
        
        # Predict
        print(f"  Running predictions...")
        predictions, confidences = self.predict_batch(texts)
        
        # Calculate metrics
        print(f"  Calculating metrics...")
        metrics = self.calculate_metrics(true_labels, predictions)
        
        # Add confidence statistics
        metrics['avg_confidence'] = np.mean(confidences)
        metrics['confidence_std'] = np.std(confidences)
        metrics['confidence_min'] = np.min(confidences)
        metrics['confidence_max'] = np.max(confidences)
        
        return metrics, predictions, confidences, true_labels
    
    def generate_report(self, metrics: Dict[str, Any], 
                       predictions: List[int],
                       confidences: List[float],
                       true_labels: List[int],
                       output_file: str = 'evaluation_report.json'):
        """Generate comprehensive evaluation report"""
        
        print("\n" + "="*70)
        print(" "*25 + "EVALUATION RESULTS")
        print("="*70)
        
        # Overall metrics
        print(f"\n📊 Overall Metrics:")
        print(f"  Accuracy:  {metrics['accuracy']:.4f}")
        print(f"  Precision: {metrics['precision_weighted']:.4f}")
        print(f"  Recall:    {metrics['recall_weighted']:.4f}")
        print(f"  F1 Score:  {metrics['f1_weighted']:.4f}")
        
        # Confidence statistics
        print(f"\n🎯 Confidence Statistics:")
        print(f"  Average:   {metrics['avg_confidence']:.4f}")
        print(f"  Std Dev:   {metrics['confidence_std']:.4f}")
        print(f"  Min:       {metrics['confidence_min']:.4f}")
        print(f"  Max:       {metrics['confidence_max']:.4f}")
        
        # Per-category metrics
        print(f"\n📈 Per-Category Performance:")
        print(f"  {'Category':<20} {'Precision':<10} {'Recall':<10} {'F1':<10} {'Support':<10}")
        print(f"  {'-'*70}")
        
        per_category_metrics = []
        for idx, label in sorted(self.trainer.id2label.items()):
            precision = metrics['precision_per_class'][idx]
            recall = metrics['recall_per_class'][idx]
            f1 = metrics['f1_per_class'][idx]
            support = int(metrics['support_per_class'][idx])
            
            print(f"  {label:<20} {precision:<10.4f} {recall:<10.4f} {f1:<10.4f} {support:<10}")
            
            per_category_metrics.append({
                'category': label,
                'precision': precision,
                'recall': recall,
                'f1': f1,
                'support': support
            })
        
        # Confusion matrix analysis
        cm = np.array(metrics['confusion_matrix'])
        print(f"\n🔀 Confusion Matrix Analysis:")
        
        misclassifications = []
        for i, true_label in sorted(self.trainer.id2label.items()):
            for j, pred_label in sorted(self.trainer.id2label.items()):
                if i != j and cm[i][j] > 0:
                    misclassifications.append({
                        'true_label': true_label,
                        'predicted_label': pred_label,
                        'count': int(cm[i][j])
                    })
        
        # Sort by count
        misclassifications.sort(key=lambda x: x['count'], reverse=True)
        
        print(f"  Top misclassifications:")
        for misc in misclassifications[:10]:
            print(f"    {misc['true_label']:<15} → {misc['predicted_label']:<15}: {misc['count']} errors")
        
        # Compile full report
        report = {
            'evaluation_date': __import__('datetime').datetime.now().isoformat(),
            'model_path': self.model_path,
            'overall_metrics': {
                'accuracy': metrics['accuracy'],
                'precision': metrics['precision_weighted'],
                'recall': metrics['recall_weighted'],
                'f1': metrics['f1_weighted']
            },
            'confidence_statistics': {
                'average': metrics['avg_confidence'],
                'std_dev': metrics['confidence_std'],
                'min': metrics['confidence_min'],
                'max': metrics['confidence_max']
            },
            'per_category_metrics': per_category_metrics,
            'confusion_matrix': metrics['confusion_matrix'],
            'misclassifications': misclassifications,
            'label_mapping': {
                'id2label': self.trainer.id2label,
                'label2id': self.trainer.label2id
            }
        }
        
        # Save report
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n✓ Detailed report saved to: {output_file}")
        
        return report


def main():
    """Main evaluation function"""
    parser = argparse.ArgumentParser(description="Evaluate trained DistilBERT model")
    parser.add_argument("--model_path", type=str,
                       default="model_service/distilbert_email_model",
                       help="Path to trained model directory")
    parser.add_argument("--test_file", type=str,
                       default="model_service/email_training_dataset_val.jsonl",
                       help="Path to test/validation dataset")
    parser.add_argument("--output", type=str,
                       default="model_service/evaluation_report.json",
                       help="Output file for evaluation report")
    
    args = parser.parse_args()
    
    print("="*70)
    print(" "*20 + "DISTILBERT MODEL EVALUATION")
    print("="*70)
    print(f"\nConfiguration:")
    print(f"  Model: {args.model_path}")
    print(f"  Test Dataset: {args.test_file}")
    print(f"  Output Report: {args.output}")
    
    # Check if model exists
    if not os.path.exists(args.model_path):
        print(f"\n❌ Error: Model not found at {args.model_path}")
        print("   Please train the model first using train_email_classifier.py")
        return
    
    # Check if test file exists
    if not os.path.exists(args.test_file):
        print(f"\n❌ Error: Test dataset not found at {args.test_file}")
        print("   Please prepare the dataset first using prepare_distilbert_dataset.py")
        return
    
    try:
        # Initialize evaluator
        print("\n" + "-"*70)
        print("LOADING MODEL")
        print("-"*70)
        
        evaluator = ModelEvaluator(args.model_path)
        
        # Evaluate
        print("\n" + "-"*70)
        print("EVALUATING MODEL")
        print("-"*70)
        
        metrics, predictions, confidences, true_labels = evaluator.evaluate_dataset(
            args.test_file
        )
        
        # Generate report
        report = evaluator.generate_report(
            metrics,
            predictions,
            confidences,
            true_labels,
            args.output
        )
        
        print("\n" + "="*70)
        print(" "*25 + "EVALUATION COMPLETE!")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ Evaluation failed with error:")
        print(f"   {str(e)}")
        import traceback
        print("\nFull traceback:")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

