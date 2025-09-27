#!/usr/bin/env python3
"""
Simple test script for the dynamic classifier
"""

from dynamic_classifier import DynamicEmailClassifier

def test_classifier():
    print("Testing Dynamic Email Classifier...")
    
    # Initialize classifier
    classifier = DynamicEmailClassifier()
    print(f"✅ Classifier initialized with {len(classifier.get_categories())} categories")
    
    # Test single prediction
    print("\n📧 Testing single prediction...")
    result = classifier.predict_single(
        "Academic Newsletter", 
        "Important updates about courses and research opportunities."
    )
    print(f"   Result: {result['label']} (confidence: {result['confidence']:.2%})")
    
    # Test batch prediction
    print("\n📦 Testing batch prediction...")
    emails = [
        {"subject": "Academic Newsletter", "body": "Important updates about courses and research."},
        {"subject": "Job Opportunity", "body": "Software Engineer position available."},
        {"subject": "Special Offer", "body": "50% off on all products!"}
    ]
    
    results = classifier.predict_batch(emails)
    print(f"   Processed {len(results)} emails:")
    for i, result in enumerate(results):
        print(f"     {i+1}: {result['label']} (confidence: {result['confidence']:.2%})")
    
    # Test category management
    print("\n📁 Testing category management...")
    print(f"   Current categories: {list(classifier.get_categories().keys())}")
    
    # Add new category
    success = classifier.add_category(
        "Newsletter", 
        "Newsletter content", 
        ["newsletter", "news"], 
        "#8B5CF6"
    )
    print(f"   Added 'Newsletter' category: {'✅' if success else '❌'}")
    print(f"   Updated categories: {list(classifier.get_categories().keys())}")
    
    # Test prediction with new category
    result = classifier.predict_single(
        "Weekly Newsletter", 
        "This week's newsletter contains important updates."
    )
    print(f"   Prediction with new category: {result['label']} (confidence: {result['confidence']:.2%})")
    
    # Remove category
    success = classifier.remove_category("Newsletter")
    print(f"   Removed 'Newsletter' category: {'✅' if success else '❌'}")
    print(f"   Final categories: {list(classifier.get_categories().keys())}")
    
    print("\n🎉 All tests completed successfully!")

if __name__ == "__main__":
    test_classifier()
