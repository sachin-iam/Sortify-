"""
Rollback Reclassification
Restores email classifications from a backup file
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, List, Any

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
    from tqdm import tqdm
except ImportError:
    print("Installing required packages...")
    os.system("pip install pymongo python-dotenv tqdm")
    from pymongo import MongoClient
    from dotenv import load_dotenv
    from tqdm import tqdm

# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/sortify')


class ClassificationRollback:
    """Rollback email classifications to previous state"""
    
    def __init__(self, mongodb_uri: str = MONGODB_URI):
        self.client = MongoClient(mongodb_uri)
        self.db = self.client.get_database()
        self.emails_collection = self.db['emails']
        
        self.stats = {
            'total_restored': 0,
            'total_skipped': 0,
            'total_errors': 0,
            'errors': []
        }
    
    def load_backup(self, backup_file: str) -> Dict[str, Any]:
        """Load backup file"""
        print(f"Loading backup from: {backup_file}")
        
        if not os.path.exists(backup_file):
            raise FileNotFoundError(f"Backup file not found: {backup_file}")
        
        with open(backup_file, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        print(f"✓ Loaded backup with {backup_data['total_emails']} emails")
        print(f"  Backup date: {backup_data['backup_date']}")
        
        return backup_data
    
    def restore_from_backup(self, backup_file: str, dry_run: bool = False):
        """Restore classifications from backup"""
        
        print("\n" + "="*70)
        print("CLASSIFICATION ROLLBACK")
        print("="*70)
        print(f"\nMode: {'DRY RUN (preview only)' if dry_run else 'LIVE RESTORE'}")
        
        # Load backup
        backup_data = self.load_backup(backup_file)
        emails_to_restore = backup_data['emails']
        
        print(f"\nRestoring {len(emails_to_restore)} email classifications...")
        
        if dry_run:
            print("\n⚠ DRY RUN MODE - No changes will be made\n")
        
        # Process emails
        from pymongo import UpdateOne
        bulk_operations = []
        
        with tqdm(total=len(emails_to_restore), desc="Restoring", unit="email") as pbar:
            for email_backup in emails_to_restore:
                try:
                    email_id = email_backup['email_id']
                    
                    # Prepare restoration update
                    update = {
                        '$set': {}
                    }
                    
                    # Restore category if exists
                    if email_backup.get('category'):
                        update['$set']['category'] = email_backup['category']
                    
                    # Restore classification if exists
                    if email_backup.get('classification'):
                        update['$set']['classification'] = email_backup['classification']
                    
                    # Add rollback metadata
                    update['$set']['rollbackMetadata'] = {
                        'rolledBackAt': datetime.now(),
                        'backupFile': os.path.basename(backup_file),
                        'backupDate': backup_data['backup_date']
                    }
                    
                    if update['$set']:
                        # Convert string ID to ObjectId
                        from bson import ObjectId
                        obj_id = ObjectId(email_id)
                        
                        if not dry_run:
                            bulk_operations.append(
                                UpdateOne(
                                    {'_id': obj_id},
                                    update
                                )
                            )
                        
                        self.stats['total_restored'] += 1
                    else:
                        self.stats['total_skipped'] += 1
                    
                except Exception as e:
                    self.stats['total_errors'] += 1
                    self.stats['errors'].append({
                        'email_id': email_backup.get('email_id', 'unknown'),
                        'error': str(e)
                    })
                
                pbar.update(1)
        
        # Execute bulk restore
        if not dry_run and bulk_operations:
            print(f"\nExecuting bulk restore...")
            try:
                result = self.emails_collection.bulk_write(bulk_operations, ordered=False)
                print(f"✓ Restored {result.modified_count} emails")
            except Exception as e:
                print(f"✗ Bulk restore error: {e}")
                self.stats['total_errors'] += 1
        
        # Print results
        self.print_results(dry_run)
    
    def print_results(self, dry_run: bool):
        """Print rollback results"""
        
        print("\n" + "="*70)
        print("ROLLBACK COMPLETE" if not dry_run else "DRY RUN COMPLETE")
        print("="*70)
        
        print(f"\n📊 Summary:")
        print(f"  Total Restored: {self.stats['total_restored']}")
        print(f"  Total Skipped: {self.stats['total_skipped']}")
        print(f"  Total Errors: {self.stats['total_errors']}")
        
        if self.stats['errors']:
            print(f"\n❌ Errors ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:10]:
                print(f"  - Email ID: {error['email_id']}")
                print(f"    Error: {error['error']}")
        
        if dry_run:
            print(f"\n⚠ This was a DRY RUN - no changes were made")
            print(f"  Run without --dry-run to perform actual rollback")
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()


def main():
    """Main rollback function"""
    parser = argparse.ArgumentParser(description="Rollback email classifications from backup")
    parser.add_argument("backup_file", type=str,
                       help="Path to backup file")
    parser.add_argument("--dry-run", action="store_true",
                       help="Preview restore without making changes")
    
    args = parser.parse_args()
    
    # Confirm action
    if not args.dry_run:
        print("\n⚠ WARNING: This will restore email classifications from backup")
        print(f"   Backup file: {args.backup_file}")
        response = input("\nAre you sure you want to proceed? (yes/no): ")
        
        if response.lower() != 'yes':
            print("Rollback cancelled")
            return
    
    # Initialize rollback
    rollback = ClassificationRollback()
    
    try:
        rollback.restore_from_backup(args.backup_file, args.dry_run)
    except Exception as e:
        print(f"\n❌ Rollback failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        rollback.close()


if __name__ == "__main__":
    main()

