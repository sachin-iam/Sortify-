"""
MongoDB Data Extraction Script for DistilBERT Training
Extracts emails from MongoDB and performs initial category distribution analysis
"""

import os
import sys
import json
from datetime import datetime
from collections import defaultdict, Counter
from typing import Dict, List, Any
import re

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
except ImportError:
    print("Installing required packages...")
    os.system("pip install pymongo python-dotenv")
    from pymongo import MongoClient
    from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/sortify')

class EmailDataExtractor:
    """Extract and analyze emails from MongoDB"""
    
    def __init__(self, mongodb_uri: str = MONGODB_URI):
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database()
        self.emails_collection = self.db['emails']
        
    def extract_emails(self, limit: int = None) -> List[Dict[str, Any]]:
        """Extract emails from MongoDB"""
        print(f"Extracting emails from MongoDB...")
        
        query = {'isDeleted': {'$ne': True}}
        
        if limit:
            cursor = self.emails_collection.find(query).limit(limit)
        else:
            cursor = self.emails_collection.find(query)
        
        emails = list(cursor)
        print(f"✓ Extracted {len(emails)} emails")
        
        return emails
    
    def analyze_category_distribution(self, emails: List[Dict]) -> Dict[str, int]:
        """Analyze distribution of emails across categories"""
        print("\nAnalyzing category distribution...")
        
        category_counts = defaultdict(int)
        
        for email in emails:
            # Try different fields for category
            category = None
            if 'classification' in email and 'label' in email['classification']:
                category = email['classification']['label']
            elif 'category' in email:
                category = email['category']
            else:
                category = 'Other'
            
            category_counts[category] += 1
        
        # Sort by count
        sorted_categories = dict(sorted(category_counts.items(), 
                                       key=lambda x: x[1], 
                                       reverse=True))
        
        print("\nCategory Distribution:")
        total = sum(sorted_categories.values())
        for category, count in sorted_categories.items():
            percentage = (count / total) * 100
            print(f"  {category:20s}: {count:5d} ({percentage:5.1f}%)")
        
        return sorted_categories
    
    def extract_sender_patterns(self, emails: List[Dict]) -> Dict[str, Any]:
        """Extract sender domain and email patterns"""
        print("\nAnalyzing sender patterns...")
        
        sender_domains = defaultdict(int)
        sender_emails = defaultdict(int)
        category_senders = defaultdict(lambda: defaultdict(int))
        
        for email in emails:
            # Get category
            category = email.get('classification', {}).get('label') or email.get('category', 'Other')
            
            # Extract sender
            sender = email.get('from', '')
            if not sender:
                continue
            
            # Extract domain
            domain_match = re.search(r'@([\w\.-]+)', sender)
            if domain_match:
                domain = domain_match.group(1)
                sender_domains[domain] += 1
                category_senders[category][domain] += 1
            
            # Count full sender
            sender_emails[sender] += 1
        
        # Get top senders per category
        top_senders_per_category = {}
        for category, senders in category_senders.items():
            top_senders_per_category[category] = dict(
                sorted(senders.items(), key=lambda x: x[1], reverse=True)[:10]
            )
        
        return {
            'top_domains': dict(sorted(sender_domains.items(), 
                                     key=lambda x: x[1], 
                                     reverse=True)[:20]),
            'top_senders': dict(sorted(sender_emails.items(), 
                                      key=lambda x: x[1], 
                                      reverse=True)[:20]),
            'category_senders': top_senders_per_category
        }
    
    def extract_subject_patterns(self, emails: List[Dict]) -> Dict[str, Any]:
        """Extract subject line patterns and keywords"""
        print("\nAnalyzing subject patterns...")
        
        category_subjects = defaultdict(list)
        category_keywords = defaultdict(Counter)
        
        for email in emails:
            category = email.get('classification', {}).get('label') or email.get('category', 'Other')
            subject = email.get('subject', '')
            
            if not subject:
                continue
            
            category_subjects[category].append(subject)
            
            # Extract keywords (simple word tokenization)
            words = re.findall(r'\b\w+\b', subject.lower())
            for word in words:
                if len(word) > 3:  # Skip short words
                    category_keywords[category][word] += 1
        
        # Get top keywords per category
        top_keywords_per_category = {}
        for category, keywords in category_keywords.items():
            top_keywords_per_category[category] = dict(keywords.most_common(20))
        
        return {
            'category_subject_counts': {cat: len(subjs) 
                                       for cat, subjs in category_subjects.items()},
            'top_keywords_per_category': top_keywords_per_category
        }
    
    def extract_temporal_patterns(self, emails: List[Dict]) -> Dict[str, Any]:
        """Extract temporal patterns (time of day, day of week)"""
        print("\nAnalyzing temporal patterns...")
        
        category_hours = defaultdict(Counter)
        category_days = defaultdict(Counter)
        
        for email in emails:
            category = email.get('classification', {}).get('label') or email.get('category', 'Other')
            
            if 'date' in email and email['date']:
                try:
                    date = email['date']
                    if isinstance(date, str):
                        date = datetime.fromisoformat(date.replace('Z', '+00:00'))
                    
                    hour = date.hour
                    day = date.weekday()  # 0=Monday, 6=Sunday
                    
                    category_hours[category][hour] += 1
                    category_days[category][day] += 1
                except Exception as e:
                    pass
        
        # Convert to regular dicts
        temporal_patterns = {
            'hour_distribution': {cat: dict(hours) 
                                 for cat, hours in category_hours.items()},
            'day_distribution': {cat: dict(days) 
                                for cat, days in category_days.items()}
        }
        
        return temporal_patterns
    
    def export_emails_for_training(self, emails: List[Dict], output_file: str = 'extracted_emails.json'):
        """Export emails in a format suitable for training"""
        print(f"\nExporting emails to {output_file}...")
        
        training_data = []
        
        for email in emails:
            category = email.get('classification', {}).get('label') or email.get('category', 'Other')
            
            # Skip if no category
            if not category:
                continue
            
            training_example = {
                'subject': email.get('subject', ''),
                'body': email.get('text') or email.get('body', ''),
                'from': email.get('from', ''),
                'category': category,
                'date': str(email.get('date', '')),
                'snippet': email.get('snippet', '')
            }
            
            training_data.append(training_example)
        
        # Save to JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(training_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Exported {len(training_data)} emails")
        return training_data
    
    def generate_analysis_report(self, emails: List[Dict], output_file: str = 'extraction_report.json'):
        """Generate comprehensive analysis report"""
        print("\n" + "="*60)
        print("GENERATING COMPREHENSIVE ANALYSIS REPORT")
        print("="*60)
        
        report = {
            'extraction_date': datetime.now().isoformat(),
            'total_emails': len(emails),
            'category_distribution': self.analyze_category_distribution(emails),
            'sender_patterns': self.extract_sender_patterns(emails),
            'subject_patterns': self.extract_subject_patterns(emails),
            'temporal_patterns': self.extract_temporal_patterns(emails)
        }
        
        # Add statistics
        report['statistics'] = {
            'emails_with_body': sum(1 for e in emails if e.get('text') or e.get('body')),
            'emails_with_subject': sum(1 for e in emails if e.get('subject')),
            'emails_with_attachments': sum(1 for e in emails if e.get('attachments')),
            'average_body_length': sum(len(e.get('text') or e.get('body', '')) for e in emails) / len(emails) if emails else 0
        }
        
        # Save report
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Analysis report saved to {output_file}")
        
        return report
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()


def main():
    """Main extraction function"""
    print("="*60)
    print("EMAIL DATA EXTRACTION FOR DISTILBERT TRAINING")
    print("="*60)
    
    # Initialize extractor
    extractor = EmailDataExtractor()
    
    try:
        # Extract emails
        emails = extractor.extract_emails()
        
        if len(emails) == 0:
            print("\n❌ No emails found in database!")
            print("   Please ensure your MongoDB is running and contains email data.")
            return
        
        # Export for training
        training_data = extractor.export_emails_for_training(
            emails, 
            'model_service/extracted_emails.json'
        )
        
        # Generate analysis report
        report = extractor.generate_analysis_report(
            emails,
            'model_service/extraction_report.json'
        )
        
        print("\n" + "="*60)
        print("EXTRACTION COMPLETE!")
        print("="*60)
        print(f"✓ Total emails extracted: {len(emails)}")
        print(f"✓ Training data exported: model_service/extracted_emails.json")
        print(f"✓ Analysis report: model_service/extraction_report.json")
        print(f"✓ Categories found: {len(report['category_distribution'])}")
        
        print("\nNext steps:")
        print("  1. Review extraction_report.json for insights")
        print("  2. Run analyze_category_patterns.py for deep analysis")
        print("  3. Run prepare_distilbert_dataset.py to create training dataset")
        
    except Exception as e:
        print(f"\n❌ Error during extraction: {e}")
        import traceback
        traceback.print_exc()
    finally:
        extractor.close()


if __name__ == "__main__":
    main()

