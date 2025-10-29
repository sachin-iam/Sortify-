"""
Dataset Preparation for DistilBERT Training
Creates balanced JSONL training dataset with data augmentation
"""

import os
import json
import random
from collections import defaultdict, Counter
from typing import Dict, List, Any
import re

class DatasetPreparator:
    """Prepare balanced training dataset for DistilBERT"""
    
    def __init__(self, 
                 extracted_emails_file: str = 'extracted_emails.json',
                 patterns_file: str = 'category_patterns_report.json'):
        
        # Load extracted emails
        with open(extracted_emails_file, 'r', encoding='utf-8') as f:
            self.emails = json.load(f)
        
        print(f"Loaded {len(self.emails)} emails")
        
        # Load patterns if available
        self.patterns = {}
        if os.path.exists(patterns_file):
            with open(patterns_file, 'r', encoding='utf-8') as f:
                pattern_data = json.load(f)
                self.patterns = pattern_data.get('detailed_patterns', {})
            print(f"Loaded patterns for {len(self.patterns)} categories")
        
        # Group emails by category
        self.emails_by_category = defaultdict(list)
        for email in self.emails:
            category = email.get('category', 'Other')
            if category and category != 'All':  # Exclude 'All' meta-category
                self.emails_by_category[category].append(email)
    
    def format_email_text(self, email: Dict[str, Any]) -> str:
        """Format email for training"""
        subject = email.get('subject', '').strip()
        body = email.get('body', '').strip()
        
        # Combine subject and body
        if subject and body:
            text = f"Subject: {subject}\n\n{body}"
        elif subject:
            text = f"Subject: {subject}"
        elif body:
            text = body
        else:
            text = ""
        
        # Limit length to avoid extremely long texts
        if len(text) > 2000:
            text = text[:2000]
        
        return text
    
    def create_synthetic_example(self, category: str, patterns: Dict[str, Any]) -> str:
        """Create synthetic training example based on patterns"""
        
        # Get patterns for this category
        sender_patterns = patterns.get('sender_patterns', {})
        subject_patterns = patterns.get('subject_patterns', {})
        body_patterns = patterns.get('body_patterns', {})
        
        # Generate subject
        subject_keywords = list(subject_patterns.get('top_keywords', {}).keys())
        if subject_keywords:
            # Pick 2-4 keywords
            num_keywords = random.randint(2, min(4, len(subject_keywords)))
            selected_keywords = random.sample(subject_keywords, num_keywords)
            subject = " ".join(selected_keywords).title()
        else:
            subject = f"{category} related email"
        
        # Generate body
        body_keywords = list(body_patterns.get('top_keywords', {}).keys())
        body_phrases = list(body_patterns.get('top_phrases', {}).keys())
        
        body_parts = []
        if body_phrases:
            # Pick 3-5 phrases
            num_phrases = random.randint(3, min(5, len(body_phrases)))
            selected_phrases = random.sample(body_phrases, num_phrases)
            body_parts.extend(selected_phrases)
        
        if body_keywords and len(body_parts) < 5:
            # Add some keywords
            num_keywords = random.randint(5, min(10, len(body_keywords)))
            selected_keywords = random.sample(body_keywords, num_keywords)
            body_parts.extend(selected_keywords)
        
        body = ". ".join(body_parts) if body_parts else f"This is a {category} email."
        
        return f"Subject: {subject}\n\n{body}"
    
    def augment_category(self, category: str, target_count: int = 150) -> List[Dict[str, str]]:
        """Augment category with synthetic examples if needed"""
        emails = self.emails_by_category[category]
        examples = []
        
        # Add all real emails
        for email in emails:
            text = self.format_email_text(email)
            if text:
                examples.append({
                    'text': text,
                    'label': category,
                    'source': 'real'
                })
        
        # Check if augmentation is needed
        if len(examples) < target_count and category in self.patterns:
            print(f"  Augmenting {category}: {len(examples)} → {target_count} samples")
            
            # Calculate how many synthetic examples to create
            num_synthetic = target_count - len(examples)
            
            # Create synthetic examples
            for _ in range(num_synthetic):
                synthetic_text = self.create_synthetic_example(
                    category, 
                    self.patterns[category]
                )
                examples.append({
                    'text': synthetic_text,
                    'label': category,
                    'source': 'synthetic'
                })
        
        return examples
    
    def balance_dataset(self, min_samples_per_category: int = 100, 
                       max_samples_per_category: int = 200) -> List[Dict[str, str]]:
        """Create balanced dataset across all categories"""
        print("\n" + "="*60)
        print("BALANCING DATASET")
        print("="*60)
        
        balanced_dataset = []
        
        # Analyze current distribution
        print("\nCurrent distribution:")
        for category, emails in self.emails_by_category.items():
            print(f"  {category:20s}: {len(emails):4d} samples")
        
        # Process each category
        print(f"\nBalancing to {min_samples_per_category}-{max_samples_per_category} samples per category...")
        
        for category in self.emails_by_category.keys():
            current_count = len(self.emails_by_category[category])
            
            if current_count < min_samples_per_category:
                # Augment
                target = min_samples_per_category
                examples = self.augment_category(category, target)
            elif current_count > max_samples_per_category:
                # Sample down
                print(f"  Sampling down {category}: {current_count} → {max_samples_per_category}")
                sampled_emails = random.sample(
                    self.emails_by_category[category], 
                    max_samples_per_category
                )
                examples = [
                    {
                        'text': self.format_email_text(email),
                        'label': category,
                        'source': 'real'
                    }
                    for email in sampled_emails
                    if self.format_email_text(email)
                ]
            else:
                # Use all
                examples = [
                    {
                        'text': self.format_email_text(email),
                        'label': category,
                        'source': 'real'
                    }
                    for email in self.emails_by_category[category]
                    if self.format_email_text(email)
                ]
            
            balanced_dataset.extend(examples)
        
        # Shuffle dataset
        random.shuffle(balanced_dataset)
        
        print(f"\n✓ Balanced dataset created: {len(balanced_dataset)} samples")
        
        # Print final distribution
        category_counts = Counter(ex['label'] for ex in balanced_dataset)
        print("\nFinal distribution:")
        for category, count in sorted(category_counts.items()):
            real_count = sum(1 for ex in balanced_dataset 
                           if ex['label'] == category and ex['source'] == 'real')
            synthetic_count = count - real_count
            print(f"  {category:20s}: {count:4d} (real: {real_count}, synthetic: {synthetic_count})")
        
        return balanced_dataset
    
    def split_dataset(self, dataset: List[Dict[str, str]], 
                     train_ratio: float = 0.8) -> tuple:
        """Split dataset into train and validation sets"""
        print(f"\nSplitting dataset ({train_ratio:.0%} train, {1-train_ratio:.0%} validation)...")
        
        # Stratified split by category
        train_data = []
        val_data = []
        
        # Group by category
        by_category = defaultdict(list)
        for example in dataset:
            by_category[example['label']].append(example)
        
        # Split each category
        for category, examples in by_category.items():
            split_idx = int(len(examples) * train_ratio)
            train_data.extend(examples[:split_idx])
            val_data.extend(examples[split_idx:])
        
        # Shuffle
        random.shuffle(train_data)
        random.shuffle(val_data)
        
        print(f"  Training set: {len(train_data)} samples")
        print(f"  Validation set: {len(val_data)} samples")
        
        return train_data, val_data
    
    def export_jsonl(self, data: List[Dict[str, str]], output_file: str):
        """Export data to JSONL format"""
        with open(output_file, 'w', encoding='utf-8') as f:
            for example in data:
                # Only export text and label for training
                training_example = {
                    'text': example['text'],
                    'label': example['label']
                }
                f.write(json.dumps(training_example, ensure_ascii=False) + '\n')
        
        print(f"✓ Exported to {output_file}")
    
    def export_dataset(self, 
                      output_file: str = 'email_training_dataset.jsonl',
                      min_samples: int = 100,
                      max_samples: int = 200,
                      train_ratio: float = 0.8):
        """Create and export complete training dataset"""
        
        # Balance dataset
        balanced_dataset = self.balance_dataset(min_samples, max_samples)
        
        # Split into train and validation
        train_data, val_data = self.split_dataset(balanced_dataset, train_ratio)
        
        # Export
        print("\nExporting datasets...")
        
        # Export combined dataset
        self.export_jsonl(balanced_dataset, output_file)
        
        # Export train and val separately
        train_file = output_file.replace('.jsonl', '_train.jsonl')
        val_file = output_file.replace('.jsonl', '_val.jsonl')
        
        self.export_jsonl(train_data, train_file)
        self.export_jsonl(val_data, val_file)
        
        # Create metadata
        metadata = {
            'total_samples': len(balanced_dataset),
            'train_samples': len(train_data),
            'val_samples': len(val_data),
            'train_ratio': train_ratio,
            'categories': list(set(ex['label'] for ex in balanced_dataset)),
            'category_distribution': dict(Counter(ex['label'] for ex in balanced_dataset)),
            'augmentation_stats': {
                'real_samples': sum(1 for ex in balanced_dataset if ex.get('source') == 'real'),
                'synthetic_samples': sum(1 for ex in balanced_dataset if ex.get('source') == 'synthetic')
            }
        }
        
        metadata_file = output_file.replace('.jsonl', '_metadata.json')
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✓ Metadata saved to {metadata_file}")
        
        return metadata


def main():
    """Main dataset preparation function"""
    print("="*60)
    print("DISTILBERT DATASET PREPARATION")
    print("="*60)
    
    # Set random seed for reproducibility
    random.seed(42)
    
    try:
        # Check if required files exist
        if not os.path.exists('model_service/extracted_emails.json'):
            print("\n❌ Error: extracted_emails.json not found!")
            print("   Please run extract_training_data.py first.")
            return
        
        # Initialize preparator
        preparator = DatasetPreparator(
            'model_service/extracted_emails.json',
            'model_service/category_patterns_report.json'
        )
        
        # Create and export dataset
        metadata = preparator.export_dataset(
            output_file='model_service/email_training_dataset.jsonl',
            min_samples=100,
            max_samples=200,
            train_ratio=0.8
        )
        
        print("\n" + "="*60)
        print("DATASET PREPARATION COMPLETE!")
        print("="*60)
        print(f"✓ Total samples: {metadata['total_samples']}")
        print(f"✓ Training samples: {metadata['train_samples']}")
        print(f"✓ Validation samples: {metadata['val_samples']}")
        print(f"✓ Categories: {len(metadata['categories'])}")
        print(f"✓ Real samples: {metadata['augmentation_stats']['real_samples']}")
        print(f"✓ Synthetic samples: {metadata['augmentation_stats']['synthetic_samples']}")
        
        print("\nFiles created:")
        print("  - model_service/email_training_dataset.jsonl (full dataset)")
        print("  - model_service/email_training_dataset_train.jsonl (training set)")
        print("  - model_service/email_training_dataset_val.jsonl (validation set)")
        print("  - model_service/email_training_dataset_metadata.json")
        
        print("\nNext step:")
        print("  Run train_email_classifier.py to train the model")
        
    except Exception as e:
        print(f"\n❌ Error during dataset preparation: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

