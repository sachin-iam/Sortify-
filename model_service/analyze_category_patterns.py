"""
Deep Category Pattern Analysis
Analyzes extracted emails to identify patterns, keywords, and characteristics for each category
"""

import os
import json
import re
from collections import defaultdict, Counter
from typing import Dict, List, Any
import math

class CategoryPatternAnalyzer:
    """Analyze patterns for each email category"""
    
    def __init__(self, extracted_emails_file: str = 'extracted_emails.json'):
        with open(extracted_emails_file, 'r', encoding='utf-8') as f:
            self.emails = json.load(f)
        
        print(f"Loaded {len(self.emails)} emails for analysis")
        
        # Group emails by category
        self.emails_by_category = defaultdict(list)
        for email in self.emails:
            category = email.get('category', 'Other')
            self.emails_by_category[category].append(email)
    
    def calculate_tfidf(self, category: str, top_n: int = 50) -> Dict[str, float]:
        """Calculate TF-IDF scores for category-specific terms"""
        category_emails = self.emails_by_category[category]
        
        if not category_emails:
            return {}
        
        # Document frequency across all categories
        df = Counter()
        total_docs = len(self.emails)
        
        # Term frequency in this category
        tf_category = Counter()
        
        for email in self.emails:
            text = f"{email.get('subject', '')} {email.get('body', '')}"
            words = set(re.findall(r'\b\w+\b', text.lower()))
            for word in words:
                df[word] += 1
        
        for email in category_emails:
            text = f"{email.get('subject', '')} {email.get('body', '')}"
            words = re.findall(r'\b\w+\b', text.lower())
            for word in words:
                if len(word) > 3:  # Skip short words
                    tf_category[word] += 1
        
        # Calculate TF-IDF
        tfidf_scores = {}
        for term, tf in tf_category.items():
            if df[term] > 0:
                idf = math.log(total_docs / df[term])
                tfidf_scores[term] = tf * idf
        
        # Return top N
        return dict(sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)[:top_n])
    
    def extract_sender_patterns(self, category: str) -> Dict[str, Any]:
        """Extract sender domain and email patterns for a category"""
        emails = self.emails_by_category[category]
        
        domains = Counter()
        senders = Counter()
        
        for email in emails:
            sender = email.get('from', '')
            if not sender:
                continue
            
            # Extract domain
            domain_match = re.search(r'@([\w\.-]+)', sender)
            if domain_match:
                domains[domain_match.group(1)] += 1
            
            senders[sender] += 1
        
        return {
            'top_domains': dict(domains.most_common(10)),
            'top_senders': dict(senders.most_common(10)),
            'unique_domains': len(domains),
            'unique_senders': len(senders)
        }
    
    def extract_subject_patterns(self, category: str) -> Dict[str, Any]:
        """Extract subject line patterns and keywords"""
        emails = self.emails_by_category[category]
        
        subjects = []
        keywords = Counter()
        patterns = []
        
        for email in emails:
            subject = email.get('subject', '')
            if not subject:
                continue
            
            subjects.append(subject)
            
            # Extract keywords
            words = re.findall(r'\b\w+\b', subject.lower())
            for word in words:
                if len(word) > 3:
                    keywords[word] += 1
            
            # Extract patterns (e.g., "Re:", "Fwd:", dates, etc.)
            if 're:' in subject.lower():
                patterns.append('reply')
            if 'fwd:' in subject.lower():
                patterns.append('forward')
            if re.search(r'\d{4}', subject):
                patterns.append('contains_year')
            if re.search(r'\d{1,2}:\d{2}', subject):
                patterns.append('contains_time')
        
        pattern_counts = Counter(patterns)
        
        return {
            'top_keywords': dict(keywords.most_common(20)),
            'common_patterns': dict(pattern_counts),
            'total_subjects': len(subjects),
            'avg_subject_length': sum(len(s) for s in subjects) / len(subjects) if subjects else 0
        }
    
    def extract_body_patterns(self, category: str) -> Dict[str, Any]:
        """Extract body content patterns"""
        emails = self.emails_by_category[category]
        
        body_lengths = []
        keywords = Counter()
        phrases = []
        
        for email in emails:
            body = email.get('body', '')
            if not body:
                continue
            
            body_lengths.append(len(body))
            
            # Extract keywords
            words = re.findall(r'\b\w+\b', body.lower())
            for word in words:
                if len(word) > 4:  # Longer words for body
                    keywords[word] += 1
            
            # Extract common phrases (2-3 word combinations)
            for i in range(len(words) - 1):
                phrase = f"{words[i]} {words[i+1]}"
                if len(phrase) > 10:
                    phrases.append(phrase)
        
        phrase_counts = Counter(phrases)
        
        return {
            'top_keywords': dict(keywords.most_common(30)),
            'top_phrases': dict(phrase_counts.most_common(20)),
            'avg_body_length': sum(body_lengths) / len(body_lengths) if body_lengths else 0,
            'min_length': min(body_lengths) if body_lengths else 0,
            'max_length': max(body_lengths) if body_lengths else 0
        }
    
    def extract_temporal_patterns(self, category: str) -> Dict[str, Any]:
        """Extract temporal patterns"""
        emails = self.emails_by_category[category]
        
        hours = Counter()
        days = Counter()
        
        for email in emails:
            date_str = email.get('date', '')
            if not date_str:
                continue
            
            try:
                from datetime import datetime
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                hours[date.hour] += 1
                days[date.weekday()] += 1
            except:
                pass
        
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        return {
            'hour_distribution': dict(hours),
            'day_distribution': dict(days),
            'peak_hours': [h for h, _ in hours.most_common(3)],
            'peak_days': [day_names[d] for d, _ in days.most_common(3)]
        }
    
    def analyze_category(self, category: str) -> Dict[str, Any]:
        """Perform comprehensive analysis for a single category"""
        print(f"\nAnalyzing category: {category}")
        
        emails = self.emails_by_category[category]
        
        if not emails:
            print(f"  ⚠ No emails found for category: {category}")
            return {}
        
        print(f"  Processing {len(emails)} emails...")
        
        analysis = {
            'sample_count': len(emails),
            'tfidf_keywords': self.calculate_tfidf(category),
            'sender_patterns': self.extract_sender_patterns(category),
            'subject_patterns': self.extract_subject_patterns(category),
            'body_patterns': self.extract_body_patterns(category),
            'temporal_patterns': self.extract_temporal_patterns(category)
        }
        
        print(f"  ✓ Analysis complete")
        
        return analysis
    
    def analyze_all_categories(self) -> Dict[str, Any]:
        """Analyze all categories"""
        print("\n" + "="*60)
        print("DEEP CATEGORY PATTERN ANALYSIS")
        print("="*60)
        
        all_patterns = {}
        
        for category in self.emails_by_category.keys():
            all_patterns[category] = self.analyze_category(category)
        
        return all_patterns
    
    def generate_category_definitions(self, patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Generate category definitions based on patterns"""
        print("\nGenerating category definitions...")
        
        category_definitions = {}
        
        # Predefined colors for categories
        colors = {
            'Placement': '#3B82F6',  # Blue
            'NPTEL': '#8B5CF6',      # Purple
            'HOD': '#EF4444',        # Red
            'E-Zone': '#10B981',     # Green
            'Promotions': '#F59E0B', # Amber
            'Whats happening': '#EC4899',  # Pink
            'Assistant': '#6366F1',  # Indigo
            'Other': '#6B7280',      # Gray
            'All': '#000000'         # Black
        }
        
        for idx, (category, pattern) in enumerate(patterns.items()):
            if not pattern:
                continue
            
            # Extract top keywords for description
            tfidf_keywords = list(pattern.get('tfidf_keywords', {}).keys())[:10]
            subject_keywords = list(pattern.get('subject_patterns', {}).get('top_keywords', {}).keys())[:10]
            
            # Combine and deduplicate keywords
            all_keywords = list(set(tfidf_keywords + subject_keywords))[:15]
            
            # Generate description
            description = f"Auto-generated category for {category} emails"
            
            category_definitions[category] = {
                'id': idx,
                'description': description,
                'keywords': all_keywords,
                'color': colors.get(category, '#6B7280'),
                'classification_strategy': {
                    'headerAnalysis': {
                        'senderDomains': list(pattern.get('sender_patterns', {}).get('top_domains', {}).keys())[:5],
                        'subjectKeywords': list(pattern.get('subject_patterns', {}).get('top_keywords', {}).keys())[:10]
                    },
                    'bodyAnalysis': {
                        'keywords': list(pattern.get('body_patterns', {}).get('top_keywords', {}).keys())[:20],
                        'phrases': list(pattern.get('body_patterns', {}).get('top_phrases', {}).keys())[:10]
                    },
                    'metadataAnalysis': {
                        'peakHours': pattern.get('temporal_patterns', {}).get('peak_hours', []),
                        'peakDays': pattern.get('temporal_patterns', {}).get('peak_days', [])
                    }
                }
            }
        
        print(f"✓ Generated definitions for {len(category_definitions)} categories")
        
        return category_definitions
    
    def export_analysis(self, output_file: str = 'category_patterns_report.json'):
        """Export comprehensive analysis"""
        patterns = self.analyze_all_categories()
        category_definitions = self.generate_category_definitions(patterns)
        
        report = {
            'analysis_date': __import__('datetime').datetime.now().isoformat(),
            'total_emails_analyzed': len(self.emails),
            'categories_analyzed': len(patterns),
            'detailed_patterns': patterns,
            'category_definitions': category_definitions,
            'summary': {
                category: {
                    'sample_count': pattern.get('sample_count', 0),
                    'top_3_keywords': list(pattern.get('tfidf_keywords', {}).keys())[:3],
                    'top_sender_domain': list(pattern.get('sender_patterns', {}).get('top_domains', {}).keys())[0] 
                                         if pattern.get('sender_patterns', {}).get('top_domains') else None
                }
                for category, pattern in patterns.items()
            }
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Analysis report exported to {output_file}")
        
        return report


def main():
    """Main analysis function"""
    print("="*60)
    print("CATEGORY PATTERN ANALYSIS")
    print("="*60)
    
    try:
        # Check if extracted emails exist
        if not os.path.exists('model_service/extracted_emails.json'):
            print("\n❌ Error: extracted_emails.json not found!")
            print("   Please run extract_training_data.py first.")
            return
        
        # Initialize analyzer
        analyzer = CategoryPatternAnalyzer('model_service/extracted_emails.json')
        
        # Perform analysis
        report = analyzer.export_analysis('model_service/category_patterns_report.json')
        
        print("\n" + "="*60)
        print("ANALYSIS COMPLETE!")
        print("="*60)
        print(f"✓ Categories analyzed: {report['categories_analyzed']}")
        print(f"✓ Total emails: {report['total_emails_analyzed']}")
        print(f"✓ Report saved: model_service/category_patterns_report.json")
        
        print("\nCategory Summary:")
        for category, summary in report['summary'].items():
            print(f"  {category:20s}: {summary['sample_count']:4d} emails")
        
        print("\nNext step:")
        print("  Run prepare_distilbert_dataset.py to create training dataset")
        
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

