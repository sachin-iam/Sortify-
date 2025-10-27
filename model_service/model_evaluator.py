"""
Model Evaluation and Performance Monitoring
Tracks accuracy metrics, confidence distribution, and feature importance
"""

import logging
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, 
    classification_report, confusion_matrix, roc_auc_score
)
from sklearn.preprocessing import LabelBinarizer

from ensemble_classifier import EnsembleEmailClassifier
from data_collection import TrainingDataCollector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelEvaluator:
    """Comprehensive model evaluation and performance monitoring"""
    
    def __init__(self, results_dir: str = "evaluation_results"):
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(exist_ok=True)
        
        self.evaluation_history = []
        self.performance_trends = {}
        
    def evaluate_model_comprehensive(
        self, 
        model: EnsembleEmailClassifier, 
        test_samples: List[Dict[str, Any]],
        evaluation_name: str = None
    ) -> Dict[str, Any]:
        """
        Comprehensive model evaluation with multiple metrics
        
        Args:
            model: Trained ensemble model
            test_samples: Test data
            evaluation_name: Name for this evaluation run
            
        Returns:
            Complete evaluation results
        """
        logger.info(f"Starting comprehensive evaluation with {len(test_samples)} samples")
        
        if not evaluation_name:
            evaluation_name = f"evaluation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # Get predictions
            predictions = []
            true_labels = []
            confidences = []
            feature_contributions = []
            
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
                    
                    predictions.append(result['label'])
                    true_labels.append(sample['trueLabel'])
                    confidences.append(result['confidence'])
                    feature_contributions.append(result.get('featureContributions', {}))
                    
                except Exception as e:
                    logger.warning(f"Error evaluating sample: {e}")
                    predictions.append('Other')
                    true_labels.append(sample.get('trueLabel', 'Other'))
                    confidences.append(0.5)
                    feature_contributions.append({})
            
            # Calculate comprehensive metrics
            evaluation_results = self._calculate_metrics(
                true_labels, predictions, confidences, 
                test_samples, feature_contributions
            )
            
            # Add metadata
            evaluation_results.update({
                'evaluation_name': evaluation_name,
                'timestamp': datetime.now().isoformat(),
                'sample_count': len(test_samples),
                'model_type': 'ensemble'
            })
            
            # Store results
            self._store_evaluation_results(evaluation_results, evaluation_name)
            self.evaluation_history.append(evaluation_results)
            
            logger.info(f"Evaluation completed. Overall accuracy: {evaluation_results['accuracy']:.3f}")
            
            return evaluation_results
            
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'sample_count': len(test_samples)
            }
    
    def _calculate_metrics(
        self, 
        true_labels: List[str], 
        predictions: List[str], 
        confidences: List[float],
        test_samples: List[Dict[str, Any]],
        feature_contributions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate comprehensive evaluation metrics"""
        
        # Basic classification metrics
        accuracy = accuracy_score(true_labels, predictions)
        
        # Get unique labels
        unique_labels = sorted(list(set(true_labels + predictions)))
        
        # Per-class metrics
        precision, recall, f1, support = precision_recall_fscore_support(
            true_labels, predictions, labels=unique_labels, average=None, zero_division=0
        )
        
        # Macro averages
        macro_precision = np.mean(precision)
        macro_recall = np.mean(recall)
        macro_f1 = np.mean(f1)
        
        # Weighted averages
        weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(
            true_labels, predictions, labels=unique_labels, average='weighted', zero_division=0
        )
        
        # Confidence analysis
        confidence_stats = self._analyze_confidence_distribution(confidences)
        
        # Feature importance analysis
        feature_importance = self._analyze_feature_importance(feature_contributions, test_samples)
        
        # Error analysis
        error_analysis = self._analyze_errors(true_labels, predictions, confidences)
        
        # Category-specific metrics
        category_metrics = {}
        for i, label in enumerate(unique_labels):
            category_metrics[label] = {
                'precision': float(precision[i]) if i < len(precision) else 0.0,
                'recall': float(recall[i]) if i < len(recall) else 0.0,
                'f1_score': float(f1[i]) if i < len(f1) else 0.0,
                'support': int(support[i]) if i < len(support) else 0
            }
        
        return {
            'accuracy': float(accuracy),
            'macro_avg': {
                'precision': float(macro_precision),
                'recall': float(macro_recall),
                'f1_score': float(macro_f1)
            },
            'weighted_avg': {
                'precision': float(weighted_precision),
                'recall': float(weighted_recall),
                'f1_score': float(weighted_f1)
            },
            'per_class_metrics': category_metrics,
            'confusion_matrix': confusion_matrix(true_labels, predictions, labels=unique_labels).tolist(),
            'confidence_analysis': confidence_stats,
            'feature_importance': feature_importance,
            'error_analysis': error_analysis,
            'labels': unique_labels
        }
    
    def _analyze_confidence_distribution(self, confidences: List[float]) -> Dict[str, Any]:
        """Analyze confidence score distribution"""
        if not confidences:
            return {}
        
        confidences = [c for c in confidences if c is not None]
        
        return {
            'mean': float(np.mean(confidences)),
            'std': float(np.std(confidences)),
            'min': float(np.min(confidences)),
            'max': float(np.max(confidences)),
            'median': float(np.median(confidences)),
            'low_confidence_count': sum(1 for c in confidences if c < 0.5),
            'high_confidence_count': sum(1 for c in confidences if c > 0.8),
            'confidence_ranges': {
                'very_low_0_0.3': sum(1 for c in confidences if 0.0 <= c < 0.3),
                'low_0.3_0.5': sum(1 for c in confidences if 0.3 <= c < 0.5),
                'medium_0.5_0.7': sum(1 for c in confidences if 0.5 <= c < 0.7),
                'high_0.7_0.9': sum(1 for c in confidences if 0.7 <= c < 0.9),
                'very_high_0.9_1.0': sum(1 for c in confidences if 0.9 <= c <= 1.0)
            }
        }
    
    def _analyze_feature_importance(
        self, 
        feature_contributions: List[Dict[str, Any]], 
        test_samples: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze feature contribution patterns"""
        
        # Aggregate feature contributions
        contribution_scores = {}
        total_samples = len(feature_contributions)
        
        for contributions in feature_contributions:
            for feature, score in contributions.items():
                if isinstance(score, (int, float)):
                    if feature not in contribution_scores:
                        contribution_scores[feature] = []
                    contribution_scores[feature].append(score)
        
        # Calculate average importance per feature
        feature_importance = {}
        for feature, scores in contribution_scores.items():
            if scores:
                feature_importance[feature] = {
                    'mean_contribution': float(np.mean(scores)),
                    'std_contribution': float(np.std(scores)),
                    'count': len(scores),
                    'max_contribution': float(np.max(scores))
                }
        
        # Sort by mean contribution
        sorted_features = sorted(
            feature_importance.items(), 
            key=lambda x: x[1]['mean_contribution'], 
            reverse=True
        )
        
        return {
            'top_features': dict(sorted_features[:10]),  # Top 10 features
            'all_features': feature_importance,
            'total_features_analyzed': len(feature_importance)
        }
    
    def _analyze_errors(
        self, 
        true_labels: List[str], 
        predictions: List[str], 
        confidences: List[float]
    ) -> Dict[str, Any]:
        """Analyze prediction errors and patterns"""
        
        errors = []
        correct_predictions = []
        
        for i, (true, pred, conf) in enumerate(zip(true_labels, predictions, confidences)):
            if true != pred:
                errors.append({
                    'true_label': true,
                    'predicted_label': pred,
                    'confidence': conf,
                    'sample_index': i
                })
            else:
                correct_predictions.append({
                    'label': true,
                    'confidence': conf,
                    'sample_index': i
                })
        
        # Analyze error patterns
        error_patterns = {}
        for error in errors:
            pattern_key = f"{error['true_label']}_to_{error['predicted_label']}"
            if pattern_key not in error_patterns:
                error_patterns[pattern_key] = {
                    'count': 0,
                    'avg_confidence': [],
                    'examples': []
                }
            error_patterns[pattern_key]['count'] += 1
            error_patterns[pattern_key]['avg_confidence'].append(error['confidence'])
            
            # Keep examples for detailed analysis
            if len(error_patterns[pattern_key]['examples']) < 5:
                error_patterns[pattern_key]['examples'].append({
                    'sample_index': error['sample_index'],
                    'confidence': error['confidence']
                })
        
        # Calculate average confidence for each error pattern
        for pattern, data in error_patterns.items():
            if data['avg_confidence']:
                data['avg_confidence'] = float(np.mean(data['avg_confidence']))
            else:
                data['avg_confidence'] = 0.0
        
        return {
            'total_errors': len(errors),
            'error_rate': len(errors) / len(true_labels) if true_labels else 0.0,
            'error_patterns': error_patterns,
            'high_confidence_errors': [
                e for e in errors if e['confidence'] > 0.8
            ],
            'low_confidence_correct': [
                c for c in correct_predictions if c['confidence'] < 0.3
            ]
        }
    
    def _store_evaluation_results(self, results: Dict[str, Any], evaluation_name: str):
        """Store evaluation results to file"""
        try:
            results_file = self.results_dir / f"{evaluation_name}_results.json"
            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            logger.info(f"Evaluation results stored to {results_file}")
        except Exception as e:
            logger.error(f"Failed to store evaluation results: {e}")
    
    def generate_performance_report(self, evaluation_name: str = None) -> Dict[str, Any]:
        """
        Generate comprehensive performance report
        
        Args:
            evaluation_name: Specific evaluation to report on, or latest if None
            
        Returns:
            Performance report
        """
        if evaluation_name:
            # Find specific evaluation
            target_eval = None
            for eval_result in self.evaluation_history:
                if eval_result.get('evaluation_name') == evaluation_name:
                    target_eval = eval_result
                    break
            
            if not target_eval:
                return {'error': f'Evaluation {evaluation_name} not found'}
        else:
            # Use latest evaluation
            if not self.evaluation_history:
                return {'error': 'No evaluation history available'}
            target_eval = self.evaluation_history[-1]
        
        # Generate report
        report = {
            'report_generated_at': datetime.now().isoformat(),
            'evaluation_info': {
                'name': target_eval.get('evaluation_name', 'unknown'),
                'timestamp': target_eval.get('timestamp', 'unknown'),
                'sample_count': target_eval.get('sample_count', 0)
            },
            'overall_performance': {
                'accuracy': target_eval.get('accuracy', 0.0),
                'macro_f1': target_eval.get('macro_avg', {}).get('f1_score', 0.0),
                'weighted_f1': target_eval.get('weighted_avg', {}).get('f1_score', 0.0)
            },
            'category_performance': target_eval.get('per_class_metrics', {}),
            'confidence_analysis': target_eval.get('confidence_analysis', {}),
            'feature_importance': target_eval.get('feature_importance', {}),
            'error_analysis': target_eval.get('error_analysis', {})
        }
        
        # Add performance trends if multiple evaluations available
        if len(self.evaluation_history) > 1:
            report['performance_trends'] = self._calculate_performance_trends()
        
        return report
    
    def _calculate_performance_trends(self) -> Dict[str, Any]:
        """Calculate performance trends across evaluations"""
        if len(self.evaluation_history) < 2:
            return {}
        
        # Extract accuracy trends
        accuracies = [eval_result.get('accuracy', 0.0) for eval_result in self.evaluation_history]
        timestamps = [eval_result.get('timestamp', '') for eval_result in self.evaluation_history]
        
        return {
            'accuracy_trend': {
                'values': accuracies,
                'timestamps': timestamps,
                'improvement': accuracies[-1] - accuracies[0] if len(accuracies) >= 2 else 0.0,
                'latest_vs_previous': accuracies[-1] - accuracies[-2] if len(accuracies) >= 2 else 0.0
            },
            'evaluation_count': len(self.evaluation_history)
        }
    
    def get_evaluation_history(self) -> List[Dict[str, Any]]:
        """Get all evaluation results"""
        return self.evaluation_history
    
    def compare_evaluations(self, eval_names: List[str]) -> Dict[str, Any]:
        """
        Compare multiple evaluation results
        
        Args:
            eval_names: List of evaluation names to compare
            
        Returns:
            Comparison results
        """
        evaluations_to_compare = []
        
        for name in eval_names:
            for eval_result in self.evaluation_history:
                if eval_result.get('evaluation_name') == name:
                    evaluations_to_compare.append(eval_result)
                    break
        
        if len(evaluations_to_compare) < 2:
            return {'error': 'Need at least 2 evaluations to compare'}
        
        comparison = {
            'evaluations_compared': [e.get('evaluation_name') for e in evaluations_to_compare],
            'accuracy_comparison': {
                eval_result.get('evaluation_name', 'unknown'): eval_result.get('accuracy', 0.0)
                for eval_result in evaluations_to_compare
            },
            'best_accuracy': max(evaluations_to_compare, key=lambda x: x.get('accuracy', 0.0)),
            'improvement_analysis': {}
        }
        
        # Analyze improvements
        if len(evaluations_to_compare) >= 2:
            latest = evaluations_to_compare[-1]
            previous = evaluations_to_compare[-2]
            
            comparison['improvement_analysis'] = {
                'latest_vs_previous': {
                    'accuracy_change': latest.get('accuracy', 0.0) - previous.get('accuracy', 0.0),
                    'improvement_percentage': (
                        (latest.get('accuracy', 0.0) - previous.get('accuracy', 0.0)) / 
                        max(previous.get('accuracy', 0.001), 0.001) * 100
                    )
                }
            }
        
        return comparison
