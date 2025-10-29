"""
Reclassify All Emails Using Trained DistilBERT Model
Processes all existing emails and updates classifications based on new 9-category system
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter
import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
    import requests
    from tqdm import tqdm
except ImportError:
    print("Installing required packages...")
    os.system("pip install pymongo python-dotenv requests tqdm")
    from pymongo import MongoClient
    from dotenv import load_dotenv
    import requests
    from tqdm import tqdm

# Load environment variables
load_dotenv()

# Configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/sortify')
MODEL_SERVICE_URL = os.getenv('MODEL_SERVICE_URL', 'http://localhost:8000')


class EmailReclassifier:
    """Reclassify all emails using DistilBERT model"""
    
    def __init__(self,
                 mongodb_uri: str = MONGODB_URI,
                 model_service_url: str = MODEL_SERVICE_URL,
                 batch_size: int = 100,
                 confidence_threshold: float = 0.0,
                 dry_run: bool = False,
                 use_direct_model: bool = False,
                 model_path: str = None):
        
        self.mongodb_uri = mongodb_uri
        self.model_service_url = model_service_url
        self.batch_size = batch_size
        self.confidence_threshold = confidence_threshold
        self.dry_run = dry_run
        self.use_direct_model = use_direct_model
        self.model_path = model_path
        
        # Statistics
        self.stats = {
            'total_processed': 0,
            'total_updated': 0,
            'total_skipped': 0,
            'total_errors': 0,
            'category_changes': defaultdict(lambda: defaultdict(int)),
            'confidence_scores': [],
            'low_confidence_emails': [],
            'errors': []
        }
        
        # Connect to MongoDB
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database()
        self.emails_collection = self.db['emails']
        
        # Load model if using direct mode
        if use_direct_model:
            self._load_direct_model()
    
    def _load_direct_model(self):
        """Load DistilBERT model directly"""
        print("\nLoading DistilBERT model directly...")
        
        try:
            from dynamic_classifier import DynamicEmailClassifier
            
            self.classifier = DynamicEmailClassifier()
            
            if self.model_path and os.path.exists(self.model_path):
                print(f"Loading fine-tuned model from: {self.model_path}")
                success = self.classifier.load_model_from_path(self.model_path)
                if not success:
                    print("⚠ Failed to load custom model, using base model")
            else:
                print("Using base DistilBERT model")
            
            print("✓ Model loaded successfully")
            
        except Exception as e:
            print(f"✗ Failed to load model: {e}")
            print("  Falling back to API mode")
            self.use_direct_model = False
    
    def classify_via_api(self, subject: str, body: str) -> Dict[str, Any]:
        """Classify email using model service API"""
        try:
            response = requests.post(
                f"{self.model_service_url}/predict",
                json={'subject': subject, 'body': body},
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'error': f"API returned status {response.status_code}"}
                
        except Exception as e:
            return {'error': str(e)}
    
    def classify_direct(self, subject: str, body: str) -> Dict[str, Any]:
        """Classify email using direct model"""
        try:
            return self.classifier.predict_single(subject, body)
        except Exception as e:
            return {'error': str(e)}
    
    def classify_email(self, subject: str, body: str) -> Dict[str, Any]:
        """Classify email (auto-select method)"""
        if self.use_direct_model:
            return self.classify_direct(subject, body)
        else:
            return self.classify_via_api(subject, body)
    
    def get_emails(self, category_filter: Optional[str] = None, limit: Optional[int] = None):
        """Get emails to reclassify"""
        query = {'isDeleted': {'$ne': True}}
        
        if category_filter:
            query['$or'] = [
                {'category': category_filter},
                {'classification.label': category_filter}
            ]
        
        cursor = self.emails_collection.find(query)
        
        if limit:
            cursor = cursor.limit(limit)
        
        return list(cursor)
    
    def process_batch(self, emails: List[Dict]) -> List[Dict]:
        """Process a batch of emails"""
        results = []
        
        for email in emails:
            # Extract email content
            subject = email.get('subject', '')
            body = email.get('text') or email.get('body', '')
            
            # Get current category
            current_category = (
                email.get('classification', {}).get('label') or 
                email.get('category', 'Other')
            )
            
            # Classify
            prediction = self.classify_email(subject, body)
            
            # Check for errors
            if 'error' in prediction:
                self.stats['total_errors'] += 1
                self.stats['errors'].append({
                    'email_id': str(email['_id']),
                    'error': prediction['error']
                })
                results.append({
                    'email_id': email['_id'],
                    'status': 'error',
                    'error': prediction['error']
                })
                continue
            
            # Get predicted category and confidence
            new_category = prediction.get('label', 'Other')
            confidence = prediction.get('confidence', 0.0)
            
            # Track statistics
            self.stats['total_processed'] += 1
            self.stats['confidence_scores'].append(confidence)
            self.stats['category_changes'][current_category][new_category] += 1
            
            # Check if update is needed
            should_update = (
                new_category != current_category and 
                confidence >= self.confidence_threshold
            )
            
            if should_update:
                self.stats['total_updated'] += 1
            else:
                self.stats['total_skipped'] += 1
            
            # Flag low confidence
            if confidence < 0.7:
                self.stats['low_confidence_emails'].append({
                    'email_id': str(email['_id']),
                    'subject': subject[:50],
                    'current': current_category,
                    'predicted': new_category,
                    'confidence': confidence
                })
            
            results.append({
                'email_id': email['_id'],
                'current_category': current_category,
                'new_category': new_category,
                'confidence': confidence,
                'should_update': should_update,
                'prediction': prediction
            })
        
        return results
    
    def update_database(self, results: List[Dict]):
        """Update database with new classifications"""
        if self.dry_run:
            return
        
        bulk_operations = []
        
        for result in results:
            if result.get('should_update'):
                email_id = result['email_id']
                new_category = result['new_category']
                confidence = result['confidence']
                prediction = result['prediction']
                
                # Prepare update
                update = {
                    '$set': {
                        'category': new_category,
                        'classification': {
                            'label': new_category,
                            'confidence': confidence,
                            'phase': 2,
                            'classifiedAt': datetime.now(),
                            'modelVersion': '4.0.0-distilbert',
                            'model': 'distilbert-reclassification',
                            'reason': 'Deep reclassification with DistilBERT',
                            'scores': prediction.get('scores', {})
                        },
                        'previousCategory': result['current_category'],
                        'refinementStatus': 'refined',
                        'refinedAt': datetime.now(),
                        'refinementConfidence': confidence,
                        'analysisDepth': 'comprehensive'
                    }
                }
                
                bulk_operations.append({
                    'filter': {'_id': email_id},
                    'update': update
                })
        
        # Execute bulk update
        if bulk_operations:
            try:
                from pymongo import UpdateOne
                operations = [
                    UpdateOne(op['filter'], op['update'])
                    for op in bulk_operations
                ]
                result = self.emails_collection.bulk_write(operations, ordered=False)
                print(f"  ✓ Updated {result.modified_count} emails")
            except Exception as e:
                print(f"  ✗ Bulk update error: {e}")
                self.stats['total_errors'] += 1
    
    def reclassify_all(self, category_filter: Optional[str] = None, sample_size: Optional[int] = None):
        """Reclassify all emails"""
        
        print("\n" + "="*70)
        print("EMAIL RECLASSIFICATION")
        print("="*70)
        
        # Print configuration
        print(f"\nConfiguration:")
        print(f"  Mode: {'DRY RUN (no changes)' if self.dry_run else 'LIVE UPDATE'}")
        print(f"  Batch Size: {self.batch_size}")
        print(f"  Confidence Threshold: {self.confidence_threshold}")
        print(f"  Classification Method: {'Direct Model' if self.use_direct_model else 'API'}")
        if category_filter:
            print(f"  Category Filter: {category_filter}")
        if sample_size:
            print(f"  Sample Size: {sample_size}")
        
        # Get emails
        print(f"\nFetching emails from MongoDB...")
        emails = self.get_emails(category_filter, sample_size)
        total_emails = len(emails)
        
        if total_emails == 0:
            print("✗ No emails found to reclassify")
            return
        
        print(f"✓ Found {total_emails} emails to process")
        
        # Process in batches
        print(f"\nProcessing emails in batches of {self.batch_size}...")
        
        start_time = time.time()
        
        with tqdm(total=total_emails, desc="Reclassifying", unit="email") as pbar:
            for i in range(0, total_emails, self.batch_size):
                batch = emails[i:i + self.batch_size]
                
                # Process batch
                results = self.process_batch(batch)
                
                # Update database
                self.update_database(results)
                
                # Update progress
                pbar.update(len(batch))
        
        elapsed_time = time.time() - start_time
        
        # Generate report
        self.generate_report(elapsed_time)
    
    def generate_report(self, elapsed_time: float):
        """Generate comprehensive reclassification report"""
        
        print("\n" + "="*70)
        print("RECLASSIFICATION COMPLETE")
        print("="*70)
        
        # Summary statistics
        print(f"\n📊 Summary:")
        print(f"  Total Processed: {self.stats['total_processed']}")
        print(f"  Total Updated: {self.stats['total_updated']}")
        print(f"  Total Skipped: {self.stats['total_skipped']}")
        print(f"  Total Errors: {self.stats['total_errors']}")
        print(f"  Processing Time: {elapsed_time/60:.1f} minutes")
        print(f"  Speed: {self.stats['total_processed']/elapsed_time:.1f} emails/second")
        
        # Confidence statistics
        if self.stats['confidence_scores']:
            avg_confidence = sum(self.stats['confidence_scores']) / len(self.stats['confidence_scores'])
            min_confidence = min(self.stats['confidence_scores'])
            max_confidence = max(self.stats['confidence_scores'])
            
            print(f"\n🎯 Confidence Statistics:")
            print(f"  Average: {avg_confidence:.4f}")
            print(f"  Min: {min_confidence:.4f}")
            print(f"  Max: {max_confidence:.4f}")
            print(f"  Low Confidence (<0.7): {len(self.stats['low_confidence_emails'])}")
        
        # Category changes
        print(f"\n🔄 Category Changes:")
        for old_cat, new_cats in sorted(self.stats['category_changes'].items()):
            total_in_category = sum(new_cats.values())
            print(f"\n  From '{old_cat}' ({total_in_category} emails):")
            for new_cat, count in sorted(new_cats.items(), key=lambda x: x[1], reverse=True):
                if old_cat != new_cat:
                    percentage = (count / total_in_category) * 100
                    print(f"    → {new_cat}: {count} ({percentage:.1f}%)")
        
        # Low confidence emails
        if self.stats['low_confidence_emails']:
            print(f"\n⚠ Low Confidence Emails (showing top 10):")
            for item in self.stats['low_confidence_emails'][:10]:
                print(f"  - {item['subject']}")
                print(f"    {item['current']} → {item['predicted']} (confidence: {item['confidence']:.4f})")
        
        # Errors
        if self.stats['errors']:
            print(f"\n❌ Errors ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:5]:
                print(f"  - Email ID: {error['email_id']}")
                print(f"    Error: {error['error']}")
        
        # Save detailed report
        report_file = f"reclassification_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report_data = {
            'timestamp': datetime.now().isoformat(),
            'configuration': {
                'dry_run': self.dry_run,
                'batch_size': self.batch_size,
                'confidence_threshold': self.confidence_threshold,
                'use_direct_model': self.use_direct_model
            },
            'statistics': {
                'total_processed': self.stats['total_processed'],
                'total_updated': self.stats['total_updated'],
                'total_skipped': self.stats['total_skipped'],
                'total_errors': self.stats['total_errors'],
                'elapsed_time_seconds': elapsed_time,
                'processing_speed': self.stats['total_processed']/elapsed_time if elapsed_time > 0 else 0
            },
            'confidence': {
                'average': sum(self.stats['confidence_scores']) / len(self.stats['confidence_scores']) if self.stats['confidence_scores'] else 0,
                'min': min(self.stats['confidence_scores']) if self.stats['confidence_scores'] else 0,
                'max': max(self.stats['confidence_scores']) if self.stats['confidence_scores'] else 0,
                'distribution': dict(Counter([round(c, 1) for c in self.stats['confidence_scores']]))
            },
            'category_changes': {
                old: dict(new) for old, new in self.stats['category_changes'].items()
            },
            'low_confidence_emails': self.stats['low_confidence_emails'],
            'errors': self.stats['errors']
        }
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Detailed report saved: {report_file}")
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()


def main():
    """Main reclassification function"""
    parser = argparse.ArgumentParser(description="Reclassify all emails with DistilBERT")
    parser.add_argument("--batch-size", type=int, default=100,
                       help="Number of emails per batch")
    parser.add_argument("--min-confidence", type=float, default=0.0,
                       help="Minimum confidence to update classification")
    parser.add_argument("--dry-run", action="store_true",
                       help="Preview changes without updating database")
    parser.add_argument("--category", type=str, default=None,
                       help="Only reclassify emails in specific category")
    parser.add_argument("--sample", type=int, default=None,
                       help="Process only N emails (for testing)")
    parser.add_argument("--use-direct-model", action="store_true",
                       help="Load model directly instead of using API")
    parser.add_argument("--model-path", type=str, default="distilbert_email_model",
                       help="Path to trained model (for direct mode)")
    parser.add_argument("--api-url", type=str, default=MODEL_SERVICE_URL,
                       help="Model service API URL")
    
    args = parser.parse_args()
    
    # Initialize reclassifier
    reclassifier = EmailReclassifier(
        batch_size=args.batch_size,
        confidence_threshold=args.min_confidence,
        dry_run=args.dry_run,
        use_direct_model=args.use_direct_model,
        model_path=args.model_path,
        model_service_url=args.api_url
    )
    
    try:
        # Run reclassification
        reclassifier.reclassify_all(
            category_filter=args.category,
            sample_size=args.sample
        )
        
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        reclassifier.close()


if __name__ == "__main__":
    main()

