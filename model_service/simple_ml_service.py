#!/usr/bin/env python3
"""
Simple ML Service for Sortify
This is a lightweight mock ML service that provides realistic email classification
without requiring heavy ML dependencies like transformers/torch.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import random
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Email classification rules based on content patterns
CLASSIFICATION_RULES = {
    'Academic': [
        r'lecture|seminar|course|assignment|exam|grade|professor|student|academic|university|college|study',
        r'research|thesis|dissertation|paper|journal|conference|workshop|training|education|learning',
        r'curriculum|syllabus|schedule|class|lab|laboratory|project|presentation|deadline|submission'
    ],
    'Placement': [
        r'placement|job|career|hiring|recruitment|interview|resume|cv|application|position|vacancy|opening',
        r'company|corporate|industry|internship|training|opportunity|career|professional|employment|work',
        r'google|microsoft|amazon|tcs|infosys|accenture|ibm|oracle|sap|adobe|netflix|meta|apple|tesla'
    ],
    'Promotions': [
        r'sale|offer|discount|deal|promotion|coupon|voucher|limited time|special|exclusive|save|save up to',
        r'buy now|order now|shop|store|retail|ecommerce|amazon|flipkart|myntra|zomato|swiggy|uber|ola',
        r'newsletter|update|news|announcement|launch|release|new product|feature|upgrade|subscription'
    ],
    'Spam': [
        r'free money|win|prize|lottery|congratulations|urgent|act now|click here|limited offer|guaranteed',
        r'viagra|casino|poker|loan|credit|debt|weight loss|diet|supplement|pharmacy|medicine|prescription',
        r'unsubscribe|opt out|remove|stop|block|spam|junk|unwanted|unsolicited|marketing|advertisement'
    ]
}

def classify_email(subject, body, snippet):
    """
    Classify email based on subject, body, and snippet content
    Returns category and confidence score
    """
    # Combine all text content
    text = f"{subject or ''} {body or ''} {snippet or ''}".lower()
    
    # Score each category
    scores = {}
    for category, patterns in CLASSIFICATION_RULES.items():
        score = 0
        for pattern in patterns:
            matches = len(re.findall(pattern, text))
            score += matches * 2  # Weight matches
    
        scores[category] = score
    
    # Find the category with highest score
    if not scores or max(scores.values()) == 0:
        # Default to 'Other' if no patterns match
        return 'Other', 0.15 + random.uniform(0, 0.1)  # Low confidence for Other
    
    best_category = max(scores, key=scores.get)
    max_score = scores[best_category]
    
    # Calculate confidence based on score strength
    if max_score >= 10:
        confidence = 0.85 + random.uniform(0, 0.1)  # High confidence
    elif max_score >= 5:
        confidence = 0.6 + random.uniform(0, 0.2)   # Medium confidence
    elif max_score >= 2:
        confidence = 0.3 + random.uniform(0, 0.2)   # Low confidence
    else:
        confidence = 0.15 + random.uniform(0, 0.1)  # Very low confidence
    
    return best_category, min(confidence, 0.95)  # Cap at 95%

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "service": "Simple ML Classifier"
    })

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        "message": "Sortify Simple ML Service is running",
        "version": "1.0.0",
        "status": "operational"
    })

@app.route('/status', methods=['GET'])
def status():
    """Service status"""
    return jsonify({
        "status": "ready",
        "message": "Simple ML service is operational",
        "model_info": {
            "type": "Rule-based classifier",
            "categories": ["Academic", "Placement", "Promotions", "Spam", "Other"],
            "confidence_range": "0.15-0.95"
        }
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict email category"""
    try:
        data = request.get_json()
        subject = data.get('subject', '')
        body = data.get('body', '')
        snippet = data.get('snippet', '')
        
        category, confidence = classify_email(subject, body, snippet)
        
        return jsonify({
            "label": category,
            "confidence": confidence,
            "scores": {
                category: confidence
            },
            "error": None
        })
    except Exception as e:
        return jsonify({
            "label": "Other",
            "confidence": 0.1,
            "scores": {"Other": 0.1},
            "error": str(e)
        }), 500

@app.route('/categorize', methods=['POST'])
def categorize():
    """Legacy categorize endpoint"""
    try:
        data = request.get_json()
        
        # Handle different input formats
        if 'content' in data:
            # Legacy format
            content = data['content']
            subject = data.get('subject', '')
            body = content
            snippet = ''
        else:
            # New format
            subject = data.get('subject', '')
            body = data.get('body', '')
            snippet = data.get('snippet', '')
        
        category, confidence = classify_email(subject, body, snippet)
        
        return jsonify({
            "label": category,
            "confidence": confidence,
            "scores": {
                category: confidence
            },
            "error": None
        })
    except Exception as e:
        return jsonify({
            "label": "Other",
            "confidence": 0.1,
            "scores": {"Other": 0.1},
            "error": str(e)
        }), 500

@app.route('/labels', methods=['GET'])
def get_labels():
    """Get available category labels"""
    return jsonify({
        "labels": ["Academic", "Placement", "Promotions", "Spam", "Other"],
        "count": 5
    })

if __name__ == '__main__':
    print("🚀 Starting Sortify Simple ML Service...")
    print("📧 Email Classification Categories: Academic, Placement, Promotions, Spam, Other")
    print("🎯 Confidence Range: 15% - 95%")
    print("🌐 Service URL: http://localhost:8000")
    
    app.run(host='0.0.0.0', port=8000, debug=True)
