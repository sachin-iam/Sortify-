#!/usr/bin/env python3
"""
Enhanced Feature Extraction for Email Classification
Extracts comprehensive features including sender, subject, body, and metadata
"""

import os
import sys
import json
import re
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import pandas as pd
from collections import Counter

# Load configuration
def load_config():
    """Load MongoDB configuration"""
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/sortify')
    return {'mongo_uri': mongo_uri}

def connect_to_mongodb(mongo_uri):
    """Connect to MongoDB"""
    try:
        client = MongoClient(mongo_uri)
        db = client.get_database()
        print(f"✅ Connected to MongoDB: {db.name}")
        return client, db
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")
        sys.exit(1)

def extract_sender_domain(from_email):
    """Extract domain from sender email"""
    if not from_email:
        return ''
    
    # Extract email from "Name <email@domain.com>" format
    email_match = re.search(r'<(.+?)>', from_email)
    email = email_match.group(1) if email_match else from_email
    
    # Extract domain
    domain_match = re.search(r'@(.+)$', email)
    return domain_match.group(1).strip() if domain_match else ''

def extract_sender_name(from_email):
    """Extract sender name from email"""
    if not from_email:
        return ''
    
    # Extract name from "Name <email@domain.com>" format
    name_match = re.search(r'^([^<]+)<', from_email)
    if name_match:
        return name_match.group(1).strip()
    
    # If no angle brackets, return part before @
    before_at = from_email.split('@')[0]
    return before_at.strip()

def extract_professor_title(from_email):
    """Extract professor title if present"""
    if not from_email:
        return ''
    
    professor_patterns = [
        r'\(([^)]*(?:Assistant Professor|Associate Professor|Professor|Faculty|Dr\.).*?)\)',
        r'(Assistant Professor|Associate Professor|Professor|Dr\.)\s+',
        r'\b(Dr\.)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)'
    ]
    
    for pattern in professor_patterns:
        match = re.search(pattern, from_email, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    return ''

def extract_category_indicators(text):
    """Extract category-specific indicators from text"""
    indicators = {
        'has_placement': False,
        'has_nptel': False,
        'has_hod': False,
        'has_ezone': False,
        'has_promotions': False,
        'has_whats_happening': False,
        'has_professor': False
    }
    
    if not text:
        return indicators
    
    text_lower = text.lower()
    
    # Placement indicators
    if any(word in text_lower for word in ['placement', 'recruitment', 'interview', 'shortlisted', 'pre-placement']):
        indicators['has_placement'] = True
    
    # NPTEL indicators
    if any(word in text_lower for word in ['nptel', 'star badges', 'iit madras', 'scmpro']):
        indicators['has_nptel'] = True
    
    # HOD indicators
    if any(word in text_lower for word in ['hod', 'head of department', 'hod office', 'respected hod']):
        indicators['has_hod'] = True
    
    # E-Zone indicators
    if any(word in text_lower for word in ['e-zone', 'ezone', 'one time password', 'sharda e-zone']):
        indicators['has_ezone'] = True
    
    # Promotions indicators
    if any(word in text_lower for word in ["'promotions' via", 'shardacare', 'healthcity', 'free screening']):
        indicators['has_promotions'] = True
    
    # Whats happening indicators
    if any(word in text_lower for word in ["'what's happening' via", 'nss cell', 'my bharat portal']):
        indicators['has_whats_happening'] = True
    
    # Professor indicators
    if any(word in text_lower for word in ['assistant professor', 'associate professor', 'evaluation', 'project eval']):
        indicators['has_professor'] = True
    
    return indicators

def extract_email_features(email_doc):
    """Extract comprehensive features from an email document"""
    features = {}
    
    # Basic fields
    features['email_id'] = str(email_doc.get('_id', ''))
    features['user_id'] = str(email_doc.get('userId', ''))
    features['subject'] = email_doc.get('subject', '')
    features['snippet'] = email_doc.get('snippet', '')
    features['from_raw'] = email_doc.get('from', '')
    features['category'] = email_doc.get('category', 'Other')
    
    # Body content (use fullBody if available, otherwise snippet)
    features['body'] = email_doc.get('fullBody') or email_doc.get('text') or email_doc.get('snippet', '')
    
    # Sender features
    features['sender_domain'] = extract_sender_domain(features['from_raw'])
    features['sender_name'] = extract_sender_name(features['from_raw'])
    features['professor_title'] = extract_professor_title(features['from_raw'])
    
    # Category indicators
    combined_text = f"{features['subject']} {features['body']}"
    indicators = extract_category_indicators(combined_text)
    features.update(indicators)
    
    # Metadata features
    features['has_attachment'] = len(email_doc.get('attachments', [])) > 0
    features['attachment_count'] = len(email_doc.get('attachments', []))
    
    # Date features
    date = email_doc.get('date')
    if date:
        if isinstance(date, str):
            try:
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            except:
                date = None
        
        if date:
            features['hour_of_day'] = date.hour
            features['day_of_week'] = date.weekday()
        else:
            features['hour_of_day'] = -1
            features['day_of_week'] = -1
    else:
        features['hour_of_day'] = -1
        features['day_of_week'] = -1
    
    # Length features
    features['subject_length'] = len(features['subject'])
    features['body_length'] = len(features['body'])
    features['total_length'] = features['subject_length'] + features['body_length']
    
    return features

def main():
    """Main function"""
    print("═" * 50)
    print("  ENHANCED FEATURE EXTRACTION")
    print("═" * 50)
    print()
    
    # Load config
    config = load_config()
    
    # Connect to MongoDB
    client, db = connect_to_mongodb(config['mongo_uri'])
    
    try:
        # Get emails collection
        emails_collection = db['emails']
        
        # Count total emails
        total_emails = emails_collection.count_documents({'isDeleted': False})
        print(f"📊 Total emails found: {total_emails}")
        
        if total_emails == 0:
            print("⚠️  No emails found in database")
            return
        
        # Extract features from all emails
        print(f"\n📥 Extracting features from {total_emails} emails...")
        
        features_list = []
        batch_size = 100
        processed = 0
        
        cursor = emails_collection.find(
            {'isDeleted': False},
            batch_size=batch_size
        )
        
        for email_doc in cursor:
            features = extract_email_features(email_doc)
            features_list.append(features)
            
            processed += 1
            if processed % 100 == 0:
                progress = (processed / total_emails) * 100
                print(f"   Progress: {processed}/{total_emails} ({progress:.1f}%)")
        
        print(f"✅ Extracted features from {processed} emails\n")
        
        # Convert to DataFrame
        df = pd.DataFrame(features_list)
        
        # Save to CSV
        output_file = 'enhanced_features.csv'
        df.to_csv(output_file, index=False)
        print(f"✅ Saved features to {output_file}")
        
        # Print statistics
        print(f"\n📊 Feature Statistics:")
        print(f"   Total samples: {len(df)}")
        print(f"   Total features: {len(df.columns)}")
        print(f"\n   Category distribution:")
        category_counts = df['category'].value_counts()
        for category, count in category_counts.items():
            percentage = (count / len(df)) * 100
            print(f"     {category}: {count} ({percentage:.1f}%)")
        
        # Save category distribution
        category_stats = {
            'total_samples': len(df),
            'categories': category_counts.to_dict(),
            'features': list(df.columns)
        }
        
        with open('enhanced_features_stats.json', 'w') as f:
            json.dump(category_stats, f, indent=2)
        
        print(f"\n✅ Feature extraction complete!")
        print(f"   Output: {output_file}")
        print(f"   Stats: enhanced_features_stats.json\n")
        
    except Exception as e:
        print(f"\n❌ Error during feature extraction: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()

