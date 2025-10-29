"""
Backup Current Email Classifications
Creates a backup of all email classifications before reclassification
"""

import os
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

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

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/sortify')


class ClassificationBackup:
    """Backup email classifications"""
    
    def __init__(self, mongodb_uri: str = MONGODB_URI):
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database()
        self.emails_collection = self.db['emails']
        
    def create_backup(self, output_file: str = None) -> Dict[str, Any]:
        """Create backup of current classifications"""
        
        if output_file is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f'classification_backup_{timestamp}.json'
        
        print("="*70)
        print("CREATING CLASSIFICATION BACKUP")
        print("="*70)
        print(f"\nOutput file: {output_file}")
        
        # Extract current classifications
        print("\nExtracting email classifications from MongoDB...")
        
        emails = list(self.emails_collection.find(
            {'isDeleted': {'$ne': True}},
            {
                '_id': 1,
                'subject': 1,
                'category': 1,
                'classification': 1,
                'from': 1,
                'date': 1
            }
        ))
        
        print(f"✓ Found {len(emails)} emails")
        
        # Prepare backup data
        backup_data = {
            'backup_date': datetime.now().isoformat(),
            'total_emails': len(emails),
            'emails': []
        }
        
        # Analyze current distribution
        category_counts = {}
        
        for email in emails:
            # Get current category
            category = None
            if 'classification' in email and 'label' in email['classification']:
                category = email['classification']['label']
            elif 'category' in email:
                category = email['category']
            else:
                category = 'Unknown'
            
            # Count
            category_counts[category] = category_counts.get(category, 0) + 1
            
            # Add to backup
            backup_data['emails'].append({
                'email_id': str(email['_id']),
                'subject': email.get('subject', ''),
                'category': email.get('category'),
                'classification': email.get('classification'),
                'from': email.get('from', ''),
                'date': str(email.get('date', ''))
            })
        
        # Add statistics
        backup_data['category_distribution'] = category_counts
        
        # Save backup
        print(f"\nSaving backup to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Backup saved successfully")
        
        # Display statistics
        print("\n" + "="*70)
        print("BACKUP STATISTICS")
        print("="*70)
        print(f"\nTotal emails backed up: {len(emails)}")
        print(f"\nCategory Distribution:")
        for category, count in sorted(category_counts.items(), 
                                     key=lambda x: x[1], 
                                     reverse=True):
            percentage = (count / len(emails)) * 100
            print(f"  {category:20s}: {count:5d} ({percentage:5.1f}%)")
        
        print(f"\n✓ Backup complete: {output_file}")
        
        return backup_data
    
    def verify_backup(self, backup_file: str) -> bool:
        """Verify backup file integrity"""
        print(f"\nVerifying backup: {backup_file}")
        
        try:
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            
            # Check required fields
            required_fields = ['backup_date', 'total_emails', 'emails', 'category_distribution']
            for field in required_fields:
                if field not in backup_data:
                    print(f"✗ Missing field: {field}")
                    return False
            
            # Verify counts match
            if len(backup_data['emails']) != backup_data['total_emails']:
                print(f"✗ Email count mismatch")
                return False
            
            print(f"✓ Backup verified successfully")
            print(f"  - Total emails: {backup_data['total_emails']}")
            print(f"  - Categories: {len(backup_data['category_distribution'])}")
            
            return True
            
        except Exception as e:
            print(f"✗ Verification failed: {e}")
            return False
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()


def main():
    """Main backup function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Backup email classifications")
    parser.add_argument("--output", type=str, default=None,
                       help="Output backup file path")
    parser.add_argument("--verify", type=str, default=None,
                       help="Verify existing backup file")
    
    args = parser.parse_args()
    
    backup = ClassificationBackup()
    
    try:
        if args.verify:
            # Verify existing backup
            backup.verify_backup(args.verify)
        else:
            # Create new backup
            backup.create_backup(args.output)
            
            # Auto-verify
            if args.output:
                backup.verify_backup(args.output)
            else:
                # Find the latest backup
                import glob
                backups = glob.glob('classification_backup_*.json')
                if backups:
                    latest = max(backups, key=os.path.getctime)
                    backup.verify_backup(latest)
    
    finally:
        backup.close()


if __name__ == "__main__":
    main()

