"""
Email Security Pipeline - Multi-signal email classifier
Fuses DistilBERT text vectors with structured security features
"""

from .parsers import parse_email_from_bytes, ParsedEmail
from .features import build_feature_vector, FEATURE_COLUMNS
from .bert_model import DistilBERTEncoder
from .fusion_model import FusionClassifier

__version__ = "1.0.0"
__all__ = [
    "parse_email_from_bytes",
    "ParsedEmail", 
    "build_feature_vector",
    "FEATURE_COLUMNS",
    "DistilBERTEncoder",
    "FusionClassifier"
]

