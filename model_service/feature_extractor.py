"""
Enhanced Feature Extractor for Email Classification
Extracts comprehensive features from email content, metadata, and structure
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urlparse
from email.utils import parseaddr, parsedate
from datetime import datetime
import html
import logging
from bs4 import BeautifulSoup
import tldextract

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailFeatureExtractor:
    """Extract comprehensive features from email content and metadata"""
    
    def __init__(self):
        # Common spam/malicious file extensions
        self.suspicious_extensions = ['.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.zip', '.rar']
        
        # Business/promotional keywords
        self.business_keywords = [
            'invoice', 'payment', 'receipt', 'order', 'purchase', 'billing',
            'subscription', 'unsubscribe', 'promo', 'sale', 'discount', 'offer'
        ]
        
        # Academic keywords
        self.academic_keywords = [
            'assignment', 'homework', 'course', 'lecture', 'university', 'college',
            'research', 'paper', 'thesis', 'exam', 'grade', 'professor'
        ]
        
        # Job-related keywords
        self.job_keywords = [
            'job', 'career', 'hiring', 'position', 'interview', 'resume',
            'application', 'candidate', 'employment', 'salary'
        ]
        
        # Urgency indicators
        self.urgency_patterns = [
            r'\b(urgent|asap|immediate|emergency|critical)\b',
            r'\b(deadline|expires?|limited time)\b',
            r'!{2,}',  # Multiple exclamation marks
            r'\bact now\b'
        ]
    
    def extract_features(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract all features from email data
        
        Args:
            email_data: Dictionary containing email fields like subject, body, html, 
                       from, to, date, attachments, etc.
        
        Returns:
            Dictionary of extracted features
        """
        features = {}
        
        try:
            # Extract content features
            features.update(self._extract_content_features(
                email_data.get('subject', ''),
                email_data.get('body', ''),
                email_data.get('html', ''),
                email_data.get('snippet', '')
            ))
            
            # Extract metadata features
            features.update(self._extract_metadata_features(
                email_data.get('from', ''),
                email_data.get('to', ''),
                email_data.get('date'),
                email_data.get('headers', {})
            ))
            
            # Extract attachment features
            features.update(self._extract_attachment_features(
                email_data.get('attachments', [])
            ))
            
            # Extract structural features
            features.update(self._extract_structural_features(
                email_data.get('subject', ''),
                email_data.get('body', ''),
                email_data.get('html', '')
            ))
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return self._get_default_features()
    
    def _extract_content_features(self, subject: str, body: str, html: str, snippet: str) -> Dict[str, Any]:
        """Extract content-based features"""
        features = {}
        
        # Subject analysis
        subject_lower = subject.lower().strip()
        features['subject_length'] = len(subject)
        features['subject_word_count'] = len(subject.split())
        features['subject_has_urgency'] = self._has_urgency_patterns(subject)
        features['subject_caps_ratio'] = self._calculate_caps_ratio(subject)
        
        # Body content analysis
        full_text = f"{subject} {body} {snippet}".strip()
        features['total_text_length'] = len(full_text)
        features['total_word_count'] = len(full_text.split())
        features['body_length'] = len(body)
        features['body_word_count'] = len(body.split())
        
        # HTML analysis
        if html:
            features['has_html'] = 1
            features['html_length'] = len(html)
            
            # Extract text from HTML and calculate ratio
            try:
                soup = BeautifulSoup(html, 'html.parser')
                html_text = soup.get_text()
                html_text_length = len(html_text)
                features['html_to_text_ratio'] = html_text_length / max(len(html), 1)
                features['html_image_count'] = len(soup.find_all('img'))
                
                # Check for hidden text (small font, color matching background)
                hidden_elements = soup.find_all(['span', 'div'], style=re.compile(r'font-size:\s*1?px|color:\s*#[fF]{6}'))
                features['has_hidden_text'] = len(hidden_elements) > 0
            except Exception as e:
                logger.warning(f"Error parsing HTML: {e}")
                features['html_to_text_ratio'] = 0
                features['html_image_count'] = 0
                features['has_hidden_text'] = 0
        else:
            features['has_html'] = 0
            features['html_length'] = 0
            features['html_to_text_ratio'] = 0
            features['html_image_count'] = 0
            features['has_hidden_text'] = 0
        
        # Keyword analysis
        full_text_lower = full_text.lower()
        features['business_keyword_count'] = sum(1 for keyword in self.business_keywords if keyword in full_text_lower)
        features['academic_keyword_count'] = sum(1 for keyword in self.academic_keywords if keyword in full_text_lower)
        features['job_keyword_count'] = sum(1 for keyword in self.job_keywords if keyword in full_text_lower)
        
        # Link extraction from HTML
        if html:
            features.update(self._extract_link_features(html))
        else:
            # Extract URLs from plain text
            url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
            urls = re.findall(url_pattern, full_text, re.IGNORECASE)
            features.update(self._analyze_extracted_urls(urls))
        
        return features
    
    def _extract_metadata_features(self, from_addr: str, to_addr: str, date: Any, headers: Dict) -> Dict[str, Any]:
        """Extract sender and metadata features"""
        features = {}
        
        try:
            # Parse sender information
            sender_name, sender_email = parseaddr(from_addr)
            features['sender_name_length'] = len(sender_name)
            features['sender_email_length'] = len(sender_email)
            
            if sender_email and '@' in sender_email:
                domain = sender_email.split('@')[1].lower()
                features['sender_domain'] = domain
                
                # Domain analysis
                domain_parts = domain.split('.')
                features['domain_levels'] = len(domain_parts)
                features['is_common_domain'] = self._is_common_domain(domain)
                
                # Extract top-level domain
                extracted = tldextract.extract(sender_email)
                features['sender_tld'] = extracted.suffix.lower() if extracted.suffix else 'unknown'
            else:
                features['sender_domain'] = 'unknown'
                features['domain_levels'] = 0
                features['is_common_domain'] = 0
                features['sender_tld'] = 'unknown'
            
            # Recipient analysis
            if to_addr:
                # Count recipients (rough estimation)
                recipient_count = len([email.strip() for email in to_addr.split(',') if '@' in email])
                features['recipient_count'] = min(recipient_count, 10)  # Cap at 10
            else:
                features['recipient_count'] = 0
            
            # Date/time analysis
            if date:
                try:
                    if isinstance(date, str):
                        parsed_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
                    elif hasattr(date, 'timestamp'):
                        parsed_date = date
                    else:
                        parsed_date = datetime.now()
                    
                    features['hour_of_day'] = parsed_date.hour
                    features['day_of_week'] = parsed_date.weekday()
                    features['is_business_hour'] = 1 if 9 <= parsed_date.hour <= 17 else 0
                    features['is_weekend'] = 1 if parsed_date.weekday() >= 5 else 0
                except Exception as e:
                    logger.warning(f"Error parsing date: {e}")
                    features['hour_of_day'] = 12  # Default to noon
                    features['day_of_week'] = 0
                    features['is_business_hour'] = 1
                    features['is_weekend'] = 0
            else:
                features['hour_of_day'] = 12
                features['day_of_week'] = 0
                features['is_business_hour'] = 1
                features['is_weekend'] = 0
            
            # Header analysis
            features.update(self._analyze_headers(headers))
            
        except Exception as e:
            logger.warning(f"Error extracting metadata features: {e}")
            features.update(self._get_default_metadata_features())
        
        return features
    
    def _extract_attachment_features(self, attachments: List[Dict]) -> Dict[str, Any]:
        """Extract attachment-related features"""
        features = {}
        
        try:
            features['attachment_count'] = len(attachments)
            features['has_attachments'] = 1 if attachments else 0
            
            if attachments:
                total_size = sum(att.get('size', 0) for att in attachments)
                features['total_attachment_size'] = total_size
                features['avg_attachment_size'] = total_size / len(attachments)
                
                # Analyze file extensions
                extensions = []
                for att in attachments:
                    filename = att.get('filename', '')
                    if filename and '.' in filename:
                        ext = filename.split('.')[-1].lower()
                        extensions.append(f'.{ext}')
                
                features['unique_extension_count'] = len(set(extensions))
                features['suspicious_extension_count'] = sum(1 for ext in extensions if ext in self.suspicious_extensions)
                
                # Most common extension types
                features['has_pdf_attachment'] = 1 if '.pdf' in extensions else 0
                features['has_image_attachment'] = 1 if any(ext in extensions for ext in ['.jpg', '.jpeg', '.png', '.gif']) else 0
                features['has_document_attachment'] = 1 if any(ext in extensions for ext in ['.doc', '.docx', '.txt', '.rtf']) else 0
            else:
                features['total_attachment_size'] = 0
                features['avg_attachment_size'] = 0
                features['unique_extension_count'] = 0
                features['suspicious_extension_count'] = 0
                features['has_pdf_attachment'] = 0
                features['has_image_attachment'] = 0
                features['has_document_attachment'] = 0
        
        except Exception as e:
            logger.warning(f"Error extracting attachment features: {e}")
            features.update(self._get_default_attachment_features())
        
        return features
    
    def _extract_structural_features(self, subject: str, body: str, html: str) -> Dict[str, Any]:
        """Extract structural and formatting features"""
        features = {}
        
        try:
            # Text structure analysis
            features['subject_exclamation_count'] = subject.count('!')
            features['subject_question_count'] = subject.count('?')
            features['subject_number_count'] = len(re.findall(r'\d+', subject))
            
            # Body structure
            features['body_paragraph_count'] = len([p for p in body.split('\n\n') if p.strip()])
            features['avg_paragraph_length'] = len(body) / max(features['body_paragraph_count'], 1)
            
            # Formatting indicators
            features['body_bold_count'] = body.count('**') + body.count('__')
            features['body_italic_count'] = body.count('*') + body.count('_')
            
            if html:
                try:
                    soup = BeautifulSoup(html, 'html.parser')
                    features['html_table_count'] = len(soup.find_all('table'))
                    features['html_list_count'] = len(soup.find_all(['ul', 'ol']))
                    features['html_form_count'] = len(soup.find_all('form'))
                except:
                    features['html_table_count'] = 0
                    features['html_list_count'] = 0
                    features['html_form_count'] = 0
            else:
                features['html_table_count'] = 0
                features['html_list_count'] = 0
                features['html_form_count'] = 0
        
        except Exception as e:
            logger.warning(f"Error extracting structural features: {e}")
            features.update(self._get_default_structural_features())
        
        return features
    
    def _extract_link_features(self, html: str) -> Dict[str, Any]:
        """Extract link-related features from HTML"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            links = soup.find_all('a', href=True)
            
            urls = []
            for link in links:
                href = link.get('href')
                if href:
                    urls.append(href)
            
            return self._analyze_extracted_urls(urls)
        except Exception as e:
            logger.warning(f"Error extracting links: {e}")
            return self._get_default_link_features()
    
    def _analyze_extracted_urls(self, urls: List[str]) -> Dict[str, Any]:
        """Analyze extracted URLs"""
        features = {}
        
        try:
            features['link_count'] = len(urls)
            features['has_links'] = 1 if urls else 0
            
            if urls:
                external_count = 0
                shortened_count = 0
                domains = set()
                
                for url in urls:
                    try:
                        parsed = urlparse(url)
                        domain = parsed.netloc.lower()
                        
                        if domain:
                            domains.add(domain)
                            
                            # Check if external link (not relative)
                            if url.startswith('http'):
                                external_count += 1
                                
                            # Check for URL shorteners
                            if any(shortener in domain for shortener in ['bit.ly', 'tinyurl', 'goo.gl', 't.co']):
                                shortened_count += 1
                    
                    except Exception:
                        continue
                
                features['external_link_count'] = external_count
                features['unique_domain_count'] = len(domains)
                features['short_url_count'] = shortened_count
            else:
                features['external_link_count'] = 0
                features['unique_domain_count'] = 0
                features['short_url_count'] = 0
        
        except Exception as e:
            logger.warning(f"Error analyzing URLs: {e}")
            features.update(self._get_default_link_features())
        
        return features
    
    def _analyze_headers(self, headers: Dict) -> Dict[str, Any]:
        """Analyze email headers for authentication and other features"""
        features = {}
        
        try:
            # Authentication headers
            features['has_spf'] = 1 if any('spf' in h.lower() for h in headers.values()) else 0
            features['has_dkim'] = 1 if any('dkim' in h.lower() for h in headers.values()) else 0
            features['has_dmarc'] = 1 if any('dmarc' in h.lower() for h in headers.values()) else 0
            
            # Reply-to header check
            features['has_reply_to'] = 1 if 'reply-to' in headers else 0
            
            # Priority/X-Priority headers
            priority_headers = ['x-priority', 'x-msmail-priority', 'priority']
            features['has_priority_header'] = 1 if any(h in headers for h in priority_headers) else 0
            
        except Exception as e:
            logger.warning(f"Error analyzing headers: {e}")
            features.update(self._get_default_header_features())
        
        return features
    
    def _has_urgency_patterns(self, text: str) -> int:
        """Check for urgency patterns in text"""
        text_lower = text.lower()
        for pattern in self.urgency_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return 1
        return 0
    
    def _calculate_caps_ratio(self, text: str) -> float:
        """Calculate ratio of capital letters"""
        if not text:
            return 0.0
        caps_count = sum(1 for c in text if c.isupper())
        return caps_count / len(text)
    
    def _is_common_domain(self, domain: str) -> int:
        """Check if domain is a common email provider"""
        common_domains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
            'aol.com', 'protonmail.com', 'fastmail.com'
        ]
        return 1 if domain.lower() in common_domains else 0
    
    def _get_default_features(self) -> Dict[str, Any]:
        """Return default feature values"""
        features = {}
        
        # Content features
        features.update({
            'subject_length': 0,
            'subject_word_count': 0,
            'subject_has_urgency': 0,
            'subject_caps_ratio': 0.0,
            'total_text_length': 0,
            'total_word_count': 0,
            'body_length': 0,
            'body_word_count': 0,
            'has_html': 0,
            'html_length': 0,
            'html_to_text_ratio': 0.0,
            'html_image_count': 0,
            'has_hidden_text': 0,
            'business_keyword_count': 0,
            'academic_keyword_count': 0,
            'job_keyword_count': 0,
            'link_count': 0,
            'has_links': 0,
            'external_link_count': 0,
            'unique_domain_count': 0,
            'short_url_count': 0
        })
        
        # Metadata features
        features.update(self._get_default_metadata_features())
        
        # Attachment features
        features.update(self._get_default_attachment_features())
        
        # Structural features
        features.update(self._get_default_structural_features())
        
        # Header features
        features.update(self._get_default_header_features())
        
        return features
    
    def _get_default_metadata_features(self) -> Dict[str, Any]:
        return {
            'sender_name_length': 0,
            'sender_email_length': 0,
            'sender_domain': 'unknown',
            'domain_levels': 0,
            'is_common_domain': 0,
            'sender_tld': 'unknown',
            'recipient_count': 0,
            'hour_of_day': 12,
            'day_of_week': 0,
            'is_business_hour': 1,
            'is_weekend': 0
        }
    
    def _get_default_attachment_features(self) -> Dict[str, Any]:
        return {
            'attachment_count': 0,
            'has_attachments': 0,
            'total_attachment_size': 0,
            'avg_attachment_size': 0,
            'unique_extension_count': 0,
            'suspicious_extension_count': 0,
            'has_pdf_attachment': 0,
            'has_image_attachment': 0,
            'has_document_attachment': 0
        }
    
    def _get_default_structural_features(self) -> Dict[str, Any]:
        return {
            'subject_exclamation_count': 0,
            'subject_question_count': 0,
            'subject_number_count': 0,
            'body_paragraph_count': 0,
            'avg_paragraph_length': 0,
            'body_bold_count': 0,
            'body_italic_count': 0,
            'html_table_count': 0,
            'html_list_count': 0,
            'html_form_count': 0
        }
    
    def _get_default_header_features(self) -> Dict[str, Any]:
        return {
            'has_spf': 0,
            'has_dkim': 0,
            'has_dmarc': 0,
            'has_reply_to': 0,
            'has_priority_header': 0
        }
    
    def _get_default_link_features(self) -> Dict[str, Any]:
        return {
            'link_count': 0,
            'has_links': 0,
            'external_link_count': 0,
            'unique_domain_count': 0,
            'short_url_count': 0
        }

def normalize_features(features: Dict[str, Any]) -> Dict[str, float]:
    """
    Normalize feature values to be suitable for ML models
    """
    normalized = {}
    
    # Numerical features that should be normalized
    numerical_features = [
        'subject_length', 'subject_word_count', 'total_text_length', 'total_word_count',
        'body_length', 'body_word_count', 'html_length', 'attachment_count',
        'total_attachment_size', 'avg_attachment_size', 'link_count', 'external_link_count'
    ]
    
    # Numerical features that are already ratios or counts
    ratio_features = [
        'subject_caps_ratio', 'html_to_text_ratio', 'avg_paragraph_length'
    ]
    
    # Count features that can stay as integers
    count_features = [
        'html_image_count', 'business_keyword_count', 'academic_keyword_count',
        'job_keyword_count', 'unique_extension_count', 'suspicious_extension_count',
        'unique_domain_count', 'short_url_count', 'recipient_count'
    ]
    
    for key, value in features.items():
        if key in numerical_features:
            # Normalize large numbers by taking log or capping
            if isinstance(value, (int, float)):
                if value > 1000:
                    normalized[key] = min(10.0, max(0.0, value / 1000.0))
                else:
                    normalized[key] = float(value)
            else:
                normalized[key] = 0.0
                
        elif key in ratio_features:
            normalized[key] = float(value) if isinstance(value, (int, float)) else 0.0
            
        elif key in count_features:
            normalized[key] = float(value) if isinstance(value, (int, float)) else 0.0
            
        elif isinstance(value, bool):
            normalized[key] = 1.0 if value else 0.0
            
        elif isinstance(value, (int, float)):
            normalized[key] = float(value)
            
        elif key in ['sender_domain', 'sender_tld']:
            # Handle categorical features with simple encoding
            if isinstance(value, str):
                # Simple hash-based encoding for domains
                normalized[f"{key}_hash"] = float(hash(value) % 1000) / 1000.0
            else:
                normalized[f"{key}_hash"] = 0.0
                
        else:
            # Convert other types to float or skip
            try:
                normalized[key] = float(value)
            except (ValueError, TypeError):
                continue
    
    return normalized
