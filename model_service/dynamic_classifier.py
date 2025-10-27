"""
Dynamic Email Classifier with Real-time Category Management
Supports adding/removing categories without model retraining
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    AutoConfig
)
import logging
import json
import asyncio
from datetime import datetime
import threading
from collections import defaultdict
import pickle
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DynamicCategoryManager:
    """Manages dynamic categories with real-time updates"""
    
    def __init__(self, categories_file: str = "categories.json"):
        self.categories_file = categories_file
        self.categories = {}
        self.category_embeddings = {}
        self.category_metadata = {}
        self.lock = threading.RLock()
        self.load_categories()
    
    def load_categories(self):
        """Load categories from file"""
        try:
            if os.path.exists(self.categories_file):
                with open(self.categories_file, 'r') as f:
                    data = json.load(f)
                    self.categories = data.get('categories', {})
                    self.category_embeddings = data.get('embeddings', {})
                    self.category_metadata = data.get('metadata', {})
                logger.info(f"Loaded {len(self.categories)} categories")
            else:
                self._initialize_default_categories()
        except Exception as e:
            logger.error(f"Error loading categories: {e}")
            self._initialize_default_categories()
    
    def _initialize_default_categories(self):
        """Initialize with only Other as default category"""
        default_categories = {
            "Other": {
                "id": 0,
                "description": "Miscellaneous content",
                "keywords": ["other", "misc", "general"],
                "color": "#6B7280",
                "created_at": datetime.now().isoformat()
            }
        }
        
        self.categories = default_categories
        self._save_categories()
    
    def add_category(self, name: str, description: str = "", keywords: List[str] = None, color: str = "#6B7280", classification_strategy: Dict[str, Any] = None) -> bool:
        """Add a new category dynamically"""
        with self.lock:
            if name in self.categories:
                logger.warning(f"Category '{name}' already exists")
                return False
            
            # Get next available ID
            max_id = max([cat['id'] for cat in self.categories.values()]) if self.categories else -1
            new_id = max_id + 1
            
            category_data = {
                "id": new_id,
                "description": description,
                "keywords": keywords or [],
                "color": color,
                "created_at": datetime.now().isoformat()
            }
            
            # Add classification strategy if provided, otherwise generate default
            if classification_strategy:
                category_data["classification_strategy"] = classification_strategy
                logger.info(f"Added custom classification strategy for category '{name}'")
            else:
                # Generate basic classification strategy
                category_data["classification_strategy"] = {
                    "headerAnalysis": {
                        "senderDomains": [],
                        "senderPatterns": [],
                        "subjectPatterns": keywords or []
                    },
                    "bodyAnalysis": {
                        "keywords": keywords or [],
                        "phrases": [],
                        "tfidfScores": {}
                    },
                    "metadataAnalysis": {
                        "timePatterns": {"hourDistribution": {}, "dayDistribution": {}, "peakHours": []},
                        "lengthPatterns": {"distribution": {}, "averageLength": 0},
                        "attachmentPatterns": {"mimeTypes": {}, "commonTypes": []}
                    },
                    "confidenceThreshold": 0.7
                }
                logger.info(f"Generated default classification strategy for category '{name}'")
            
            self.categories[name] = category_data
            
            self._save_categories()
            logger.info(f"Added new category: {name} (ID: {new_id})")
            return True
    
    def remove_category(self, name: str) -> bool:
        """Remove a category"""
        with self.lock:
            if name not in self.categories:
                logger.warning(f"Category '{name}' not found")
                return False
            
            # Don't allow removing default categories
            default_categories = ["Academic", "Promotions", "Placement", "Spam", "Other"]
            if name in default_categories:
                logger.warning(f"Cannot remove default category: {name}")
                return False
            
            del self.categories[name]
            if name in self.category_embeddings:
                del self.category_embeddings[name]
            if name in self.category_metadata:
                del self.category_metadata[name]
            
            self._save_categories()
            logger.info(f"Removed category: {name}")
            return True
    
    def update_category(self, name: str, **kwargs) -> bool:
        """Update category metadata"""
        with self.lock:
            if name not in self.categories:
                logger.warning(f"Category '{name}' not found")
                return False
            
            for key, value in kwargs.items():
                if key in self.categories[name]:
                    self.categories[name][key] = value
            
            self.categories[name]['updated_at'] = datetime.now().isoformat()
            self._save_categories()
            logger.info(f"Updated category: {name}")
            return True
    
    def get_categories(self) -> Dict[str, Any]:
        """Get all categories"""
        with self.lock:
            return self.categories.copy()
    
    def get_all_categories(self) -> Dict[str, Any]:
        """Get all categories (alias for get_categories)"""
        return self.get_categories()
    
    def get_category_names(self) -> List[str]:
        """Get list of category names"""
        with self.lock:
            return list(self.categories.keys())
    
    def get_category_by_id(self, category_id: int) -> Optional[str]:
        """Get category name by ID"""
        with self.lock:
            for name, data in self.categories.items():
                if data['id'] == category_id:
                    return name
            return None
    
    def get_category_id_by_name(self, category_name: str) -> Optional[int]:
        """Get category ID by name"""
        with self.lock:
            if category_name in self.categories:
                return self.categories[category_name]['id']
            return None
    
    def _save_categories(self):
        """Save categories to file"""
        try:
            data = {
                'categories': self.categories,
                'embeddings': self.category_embeddings,
                'metadata': self.category_metadata,
                'last_updated': datetime.now().isoformat()
            }
            with open(self.categories_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving categories: {e}")

class DynamicEmailClassifier:
    """High-performance dynamic email classifier"""
    
    def __init__(self, model_name: str = "distilbert-base-uncased", max_length: int = 512):
        self.model_name = model_name
        self.max_length = max_length
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize components
        self.category_manager = DynamicCategoryManager()
        self.tokenizer = None
        self.model = None
        self.classification_head = None
        
        # Performance optimization
        self.batch_size = 32
        self.max_batch_size = 1000
        self.cache_size = 10000
        self.prediction_cache = {}
        
        # Initialize model
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the DistilBERT model with dynamic classification head"""
        try:
            logger.info(f"Initializing model: {self.model_name}")
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            # Load base model with correct number of labels
            num_categories = len(self.category_manager.get_categories())
            config = AutoConfig.from_pretrained(
                self.model_name,
                num_labels=num_categories,
                problem_type="single_label_classification"
            )
            
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                config=config
            )
            
            # Move to device
            self.model.to(self.device)
            self.model.eval()
            
            logger.info("Model initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            raise RuntimeError(f"Model initialization failed: {e}")

    def load_model_from_path(self, model_path: str) -> bool:
        """Load a fine-tuned model and tokenizer from a directory.

        The directory is expected to be a standard transformers save folder
        produced by `Trainer.save_model()` and `tokenizer.save_pretrained()`.

        Returns True if loaded successfully, False otherwise.
        """
        try:
            if not os.path.exists(model_path):
                logger.error(f"Model path does not exist: {model_path}")
                return False

            logger.info(f"Loading fine-tuned model from: {model_path}")

            # Load tokenizer and model
            self.tokenizer = AutoTokenizer.from_pretrained(model_path)

            config = AutoConfig.from_pretrained(model_path)
            # Ensure the number of labels aligns to current categories count
            num_categories = len(self.category_manager.get_categories())
            if getattr(config, "num_labels", None) and config.num_labels != num_categories:
                logger.warning(
                    f"Loaded model num_labels ({config.num_labels}) does not match current categories ({num_categories})."
                )

            self.model = AutoModelForSequenceClassification.from_pretrained(model_path, config=config)
            self.model.to(self.device)
            self.model.eval()

            # Capture label mappings if present on config
            self.id2label = getattr(config, 'id2label', None)
            self.label2id = getattr(config, 'label2id', None)

            # If trainer saved label_mappings.json, read it for robustness
            try:
                mappings_path = os.path.join(model_path, 'label_mappings.json')
                if os.path.exists(mappings_path):
                    with open(mappings_path, 'r') as f:
                        mappings = json.load(f)
                        self.label2id = mappings.get('label2id', self.label2id)
                        self.id2label = mappings.get('id2label', self.id2label)
            except Exception as e:
                logger.warning(f"Could not read label_mappings.json: {e}")

            # Build mapping from model label names -> current category IDs
            self.model_label_to_category_id = {}
            if self.id2label:
                # id2label keys may be str indices; normalize
                for k, v in list(self.id2label.items()):
                    try:
                        idx = int(k)
                        label_name = v
                    except Exception:
                        idx = k
                        label_name = v
                    cat_id = self.category_manager.get_category_id_by_name(label_name) or self.category_manager.get_category_id_by_name('Other') or 0
                    self.model_label_to_category_id[idx] = cat_id
            else:
                # Fallback: assume same ordering
                logger.warning("id2label not found; assuming model label indices align with category IDs")
                self.model_label_to_category_id = {i: i for i in range(num_categories)}

            # Clear prediction cache after model swap
            self.prediction_cache.clear()

            logger.info("Fine-tuned model loaded successfully and ready for predictions")
            return True
        except Exception as e:
            logger.error(f"Failed to load model from path '{model_path}': {e}")
            return False
    
    def _update_classification_head(self):
        """Update classification head for current categories"""
        try:
            num_categories = len(self.category_manager.get_categories())
            
            # Update the model's classification head
            if hasattr(self.model, 'classifier'):
                # Update existing classifier
                self.model.classifier = nn.Linear(
                    self.model.config.hidden_size, 
                    num_categories
                ).to(self.device)
            else:
                # Create new classification head
                self.classification_head = nn.Linear(
                    self.model.config.hidden_size, 
                    num_categories
                ).to(self.device)
            
            # Initialize weights
            if hasattr(self.model, 'classifier'):
                nn.init.xavier_uniform_(self.model.classifier.weight)
                nn.init.zeros_(self.model.classifier.bias)
            else:
                nn.init.xavier_uniform_(self.classification_head.weight)
                nn.init.zeros_(self.classification_head.bias)
            
            logger.info(f"Updated classification head for {num_categories} categories")
            
        except Exception as e:
            logger.error(f"Error updating classification head: {e}")
            raise RuntimeError(f"Classification head update failed: {e}")
    
    def preprocess_text(self, subject: str, body: str) -> str:
        """Preprocess email text for classification"""
        # Combine subject and body
        text = f"{subject} [SEP] {body}"
        
        # Clean and normalize text
        text = text.strip()
        if not text:
            text = "Empty email"
        
        return text
    
    def tokenize_batch(self, texts: List[str]) -> Dict[str, torch.Tensor]:
        """Tokenize batch of texts efficiently"""
        try:
            # Tokenize with padding and truncation
            encodings = self.tokenizer(
                texts,
                truncation=True,
                padding=True,
                max_length=self.max_length,
                return_tensors="pt"
            )
            
            # Move to device
            encodings = {k: v.to(self.device) for k, v in encodings.items()}
            
            return encodings
            
        except Exception as e:
            logger.error(f"Error tokenizing batch: {e}")
            raise RuntimeError(f"Tokenization failed: {e}")
    
    def _apply_comprehensive_analysis(self, subject: str, body: str, scores: Dict[str, float], 
                                    ml_category: str, ml_confidence: float, ml_category_id: int) -> tuple:
        """
        Apply comprehensive multi-layered analysis including:
        1. Header Analysis (sender domains, patterns, subject patterns)
        2. Body Analysis (keywords, phrases, TF-IDF)
        3. Metadata Analysis (time patterns, length patterns, attachment patterns)
        4. Tags Analysis (extracted tags and entities)
        """
        try:
            import re
            from collections import Counter
            
            # Extract metadata from email content
            full_text = f"{subject} {body}".lower()
            
            # Initialize analysis results
            best_category = ml_category
            best_confidence = ml_confidence
            best_category_id = ml_category_id
            
            # Analyze all categories with classification strategies
            for category_name, category_data in self.category_manager.categories.items():
                if category_name == "Other":
                    continue
                    
                classification_strategy = category_data.get("classification_strategy")
                if not classification_strategy:
                    continue
                    
                analysis_score = 0.0
                max_possible_score = 0.0
                
                # 1. Header Analysis
                header_analysis = classification_strategy.get("headerAnalysis", {})
                if header_analysis:
                    header_score, header_max = self._analyze_header(subject, body, header_analysis)
                    analysis_score += header_score
                    max_possible_score += header_max
                
                # 2. Body Analysis
                body_analysis = classification_strategy.get("bodyAnalysis", {})
                if body_analysis:
                    body_score, body_max = self._analyze_body(subject, body, body_analysis)
                    analysis_score += body_score
                    max_possible_score += body_max
                
                # 3. Metadata Analysis
                metadata_analysis = classification_strategy.get("metadataAnalysis", {})
                if metadata_analysis:
                    metadata_score, metadata_max = self._analyze_metadata(subject, body, metadata_analysis)
                    analysis_score += metadata_score
                    max_possible_score += metadata_max
                
                # 4. Tags Analysis
                tags_analysis = classification_strategy.get("tagsAnalysis", {})
                if tags_analysis:
                    tags_score, tags_max = self._analyze_tags(subject, body, tags_analysis)
                    analysis_score += tags_score
                    max_possible_score += tags_max
                
                # 5. Calculate final confidence with strategy-based boost
                if max_possible_score > 0:
                    strategy_confidence = analysis_score / max_possible_score
                    
                    # Get confidence threshold (default 0.7 if not specified)
                    threshold = classification_strategy.get("confidenceThreshold", 0.7)
                    
                    # If strategy-based analysis is strong enough, boost this category
                    if strategy_confidence >= threshold * 0.8:  # 80% of threshold
                        # Combine ML prediction with strategy analysis
                        ml_base_score = scores.get(category_name, 0.0)
                        combined_confidence = (ml_base_score * 0.3) + (strategy_confidence * 0.7)
                        
                        if combined_confidence > best_confidence:
                            best_category = category_name
                            best_confidence = min(0.95, combined_confidence)  # Cap at 0.95
                            best_category_id = category_data["id"]
                            
                            logger.info(f"Enhanced classification for '{category_name}': "
                                      f"ML={ml_base_score:.3f}, Strategy={strategy_confidence:.3f}, "
                                      f"Final={best_confidence:.3f}")
            
            return best_category, best_confidence, best_category_id
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {e}")
            return ml_category, ml_confidence, ml_category_id
    
    def _analyze_header(self, subject: str, body: str, header_analysis: Dict) -> tuple:
        """Analyze header-based patterns including sender domains and subject patterns"""
        try:
            score = 0.0
            max_score = 0.0
            
            full_text = f"{subject} {body}".lower()
            
            # Check sender domain patterns
            sender_domains = header_analysis.get("senderDomains", [])
            if sender_domains:
                max_score += len(sender_domains) * 0.1
                for domain in sender_domains:
                    if domain.lower() in full_text or f"@{domain.lower()}" in full_text:
                        score += 0.1
            
            # Check sender patterns (regex patterns)
            sender_patterns = header_analysis.get("senderPatterns", [])
            if sender_patterns:
                max_score += len(sender_patterns) * 0.15
                for pattern in sender_patterns:
                    if re.search(pattern.lower(), full_text):
                        score += 0.15
            
            # Check subject patterns
            subject_patterns = header_analysis.get("subjectPatterns", [])
            if subject_patterns:
                max_score += len(subject_patterns) * 0.2
                subject_lower = subject.lower()
                for pattern in subject_patterns:
                    if pattern.lower() in subject_lower:
                        score += 0.2
                        
            return score, max_score
            
        except Exception as e:
            logger.error(f"Error in header analysis: {e}")
            return 0.0, 1.0
    
    def _analyze_body(self, subject: str, body: str, body_analysis: Dict) -> tuple:
        """Analyze body content including keywords and TF-IDF scores"""
        try:
            score = 0.0
            max_score = 0.0
            
            full_text = f"{subject} {body}".lower()
            
            # Check keywords
            keywords = body_analysis.get("keywords", [])
            if keywords:
                max_score += len(keywords) * 0.1
                for keyword in keywords:
                    if keyword.lower() in full_text:
                        score += 0.1
            
            # Check phrases (more complex patterns)
            phrases = body_analysis.get("phrases", [])
            if phrases:
                max_score += len(phrases) * 0.15
                for phrase in phrases:
                    if phrase.lower() in full_text:
                        score += 0.15
            
            # Apply TF-IDF scores if available
            tfidf_scores = body_analysis.get("tfidfScores", {})
            if tfidf_scores:
                max_score += 1.0  # Normalize TF-IDF contribution
                tfidf_contribution = 0.0
                for term, tfidf_score in tfidf_scores.items():
                    if term.lower() in full_text:
                        tfidf_contribution += min(tfidf_score, 1.0)
                
                if tfidf_contribution > 0:
                    score += min(tfidf_contribution, 1.0)
            
            return score, max_score
            
        except Exception as e:
            logger.error(f"Error in body analysis: {e}")
            return 0.0, 1.0
    
    def _analyze_metadata(self, subject: str, body: str, metadata_analysis: Dict) -> tuple:
        """Analyze metadata patterns including time, length, and attachment patterns"""
        try:
            score = 0.0
            max_score = 1.0
            
            full_text = f"{subject} {body}"
            
            # Length patterns
            length_patterns = metadata_analysis.get("lengthPatterns", {})
            if length_patterns:
                text_length = len(full_text)
                min_length = length_patterns.get("minLength", 0)
                max_length = length_patterns.get("maxLength", float('inf'))
                
                if min_length <= text_length <= max_length:
                    score += 0.3
            
            # Time patterns (could analyze for time-sensitive keywords)
            time_patterns = metadata_analysis.get("timePatterns", {})
            if time_patterns:
                time_keywords = time_patterns.get("keywords", [])
                for keyword in time_keywords:
                    if keyword.lower() in full_text.lower():
                        score += 0.1
            
            # Attachment patterns
            attachment_patterns = metadata_analysis.get("attachmentPatterns", {})
            if attachment_patterns:
                attachment_keywords = attachment_patterns.get("keywords", [])
                for keyword in attachment_keywords:
                    if keyword.lower() in full_text.lower():
                        score += 0.1
            
            return score, max_score
            
        except Exception as e:
            logger.error(f"Error in metadata analysis: {e}")
            return 0.0, 1.0
    
    def _analyze_tags(self, subject: str, body: str, tags_analysis: Dict) -> tuple:
        """Analyze tags and entity patterns in email content"""
        try:
            score = 0.0
            max_score = 0.0
            
            full_text = f"{subject} {body}".lower()
            
            # Check common tags
            common_tags = tags_analysis.get("commonTags", [])
            if common_tags:
                max_score += len(common_tags) * 0.1
                for tag in common_tags:
                    if tag.lower() in full_text:
                        score += 0.1
            
            # Check label patterns
            label_patterns = tags_analysis.get("labelPatterns", [])
            if label_patterns:
                max_score += len(label_patterns) * 0.15
                for label in label_patterns:
                    if label.lower() in full_text:
                        score += 0.15
            
            # Check entity patterns (emails, URLs)
            entity_patterns = tags_analysis.get("entityPatterns", {})
            if entity_patterns:
                entity_emails = entity_patterns.get("emails", [])
                entity_urls = entity_patterns.get("urls", [])
                entity_keywords = entity_patterns.get("keywords", [])
                
                max_score += (len(entity_emails) * 0.2 + len(entity_urls) * 0.15 + len(entity_keywords) * 0.1)
                
                # Check for specific emails
                for email_addr in entity_emails:
                    if email_addr.lower() in full_text:
                        score += 0.2
                
                # Check for specific URLs
                for url in entity_urls:
                    if url.lower() in full_text:
                        score += 0.15
                
                # Check for entity keywords
                for keyword in entity_keywords:
                    if keyword.lower() in full_text:
                        score += 0.1
            
            # Apply confidence thresholds from tags analysis
            confidence_thresholds = tags_analysis.get("confidenceThresholds", {})
            if confidence_thresholds and max_score > 0:
                # Boost score if we're above the tag match threshold
                tag_threshold = confidence_thresholds.get("tagMatch", 0.85)
                if score / max_score >= tag_threshold * 0.8:  # 80% of threshold
                    score = min(max_score, score * 1.2)  # 20% boost
            
            return score, max_score
            
        except Exception as e:
            logger.error(f"Error in tags analysis: {e}")
            return 0.0, 1.0
    
    def predict_single(self, subject: str, body: str) -> Dict[str, Any]:
        """Predict category for single email"""
        try:
            # Preprocess text
            text = self.preprocess_text(subject, body)
            
            # Check cache
            cache_key = hash(text)
            if cache_key in self.prediction_cache:
                return self.prediction_cache[cache_key]
            
            # Tokenize
            encodings = self.tokenize_batch([text])
            
            # Get predictions
            with torch.no_grad():
                outputs = self.model(**encodings)
                logits = outputs.logits
                probabilities = torch.softmax(logits, dim=1)
            
            # Map model label indices -> current category IDs/names
            category_names = self.category_manager.get_category_names()
            mapped_scores = {name: 0.0 for name in category_names}
            id_map = getattr(self, 'model_label_to_category_id', None)
            for i in range(probabilities.shape[1]):
                mapped_cat_id = id_map.get(i, i) if id_map else i
                mapped_name = self.category_manager.get_category_by_id(mapped_cat_id) or 'Other'
                score_val = probabilities[0][i].item()
                # If multiple model labels map to same category, take max
                mapped_scores[mapped_name] = max(mapped_scores.get(mapped_name, 0.0), score_val)

            # Choose best category by mapped score
            category_name, confidence = max(mapped_scores.items(), key=lambda x: x[1])
            predicted_id = self.category_manager.get_category_id_by_name(category_name) or 0
            if not category_name:
                category_name = "Other"
            
            # Create scores dictionary based on mapped_scores
            scores = mapped_scores
            
            # Apply comprehensive multi-layered analysis for all categories
            final_category_name, final_confidence, final_category_id = self._apply_comprehensive_analysis(
                subject, body, scores, category_name, confidence, predicted_id
            )
            
            category_name = final_category_name
            confidence = final_confidence
            predicted_id = final_category_id
            
            result = {
                "label": category_name,
                "confidence": round(confidence, 4),
                "scores": scores,
                "category_id": predicted_id
            }
            
            # Cache result
            if len(self.prediction_cache) < self.cache_size:
                self.prediction_cache[cache_key] = result
            
            return result
            
        except Exception as e:
            logger.error(f"Error in single prediction: {e}")
            return {
                "label": "Other",
                "confidence": 0.0,
                "scores": {},
                "error": str(e)
            }
    
    def predict_batch(self, emails: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Predict categories for batch of emails"""
        try:
            if not emails:
                return []
            
            # Preprocess texts
            texts = []
            for email in emails:
                subject = email.get('subject', '')
                body = email.get('body', '')
                text = self.preprocess_text(subject, body)
                texts.append(text)
            
            # Process in chunks for memory efficiency
            results = []
            for i in range(0, len(texts), self.batch_size):
                chunk_texts = texts[i:i + self.batch_size]
                chunk_emails = emails[i:i + self.batch_size]
                
                # Tokenize chunk
                encodings = self.tokenize_batch(chunk_texts)
                
                # Get predictions
                with torch.no_grad():
                    outputs = self.model(**encodings)
                    logits = outputs.logits
                    probabilities = torch.softmax(logits, dim=1)
                
                # Process results
                for j, email in enumerate(chunk_emails):
                    predicted_id = torch.argmax(probabilities[j], dim=0).item()
                    confidence = probabilities[j][predicted_id].item()
                    
                    # Get category name
                    category_name = self.category_manager.get_category_by_id(predicted_id)
                    if not category_name:
                        category_name = "Other"
                    
                    # Create scores dictionary
                    category_names = self.category_manager.get_category_names()
                    scores = {}
                    for k, name in enumerate(category_names):
                        if k < probabilities.shape[1]:
                            scores[name] = probabilities[j][k].item()
                    
                    result = {
                        "label": category_name,
                        "confidence": round(confidence, 4),
                        "scores": scores,
                        "category_id": predicted_id
                    }
                    
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch prediction: {e}")
            return [{"label": "Other", "confidence": 0.0, "scores": {}, "error": str(e)} for _ in emails]
    
    def add_category(self, name: str, description: str = "", keywords: List[str] = None, color: str = "#6B7280", classification_strategy: Dict[str, Any] = None) -> bool:
        """Add new category and update model"""
        try:
            # Add category with classification strategy
            success = self.category_manager.add_category(name, description, keywords, color, classification_strategy)
            if not success:
                return False
            
            # Update classification head
            self._update_classification_head()
            
            # Clear cache
            self.prediction_cache.clear()
            
            logger.info(f"Added category '{name}' and updated model")
            return True
            
        except Exception as e:
            logger.error(f"Error adding category: {e}")
            return False
    
    def remove_category(self, name: str) -> bool:
        """Remove category and update model"""
        try:
            # Remove category
            success = self.category_manager.remove_category(name)
            if not success:
                return False
            
            # Update classification head
            self._update_classification_head()
            
            # Clear cache
            self.prediction_cache.clear()
            
            logger.info(f"Removed category '{name}' and updated model")
            return True
            
        except Exception as e:
            logger.error(f"Error removing category: {e}")
            return False
    
    def get_categories(self) -> Dict[str, Any]:
        """Get all categories"""
        return self.category_manager.get_categories()
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_name": self.model_name,
            "device": str(self.device),
            "max_length": self.max_length,
            "batch_size": self.batch_size,
            "categories": self.category_manager.get_categories(),
            "num_categories": len(self.category_manager.get_categories()),
            "cache_size": len(self.prediction_cache),
            "status": "ready" if self.model is not None else "not_loaded"
        }
    
    def clear_cache(self):
        """Clear prediction cache"""
        self.prediction_cache.clear()
        logger.info("Prediction cache cleared")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return {
            "cache_size": len(self.prediction_cache),
            "max_cache_size": self.cache_size,
            "batch_size": self.batch_size,
            "max_batch_size": self.max_batch_size,
            "device": str(self.device),
            "categories_count": len(self.category_manager.get_categories())
        }
    
    def extract_category_features(self, category_name: str, category_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract detailed features for a category including:
        - Semantic embeddings from keywords and description
        - Header analysis patterns
        - Body content patterns
        - Metadata patterns
        """
        try:
            logger.info(f"Extracting features for category: {category_name}")
            
            # Combine description and keywords for embedding
            text_content = f"{category_data.get('description', '')} {' '.join(category_data.get('keywords', []))}"
            
            # Generate embedding using the model
            inputs = self.tokenizer(
                text_content,
                max_length=128,
                padding=True,
                truncation=True,
                return_tensors="pt"
            )
            
            with torch.no_grad():
                outputs = self.model(**inputs, output_hidden_states=True)
                # Use [CLS] token embedding as category representation
                embedding = outputs.hidden_states[-1][:, 0, :].cpu().numpy()
            
            # Extract classification strategy features
            classification_strategy = category_data.get('classification_strategy', {})
            
            features = {
                'embedding': embedding.tolist(),
                'keywords': category_data.get('keywords', []),
                'header_patterns': classification_strategy.get('headerAnalysis', {}),
                'body_patterns': classification_strategy.get('bodyAnalysis', {}),
                'metadata_patterns': classification_strategy.get('metadataAnalysis', {}),
                'extracted_at': datetime.now().isoformat()
            }
            
            # Update category manager with features
            self.category_manager.category_metadata[category_name] = features
            
            logger.info(f"Features extracted for {category_name}")
            return features
            
        except Exception as e:
            logger.error(f"Feature extraction error for {category_name}: {e}")
            return {}