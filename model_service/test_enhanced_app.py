#!/usr/bin/env python3
"""
Test script for enhanced app functionality
"""

from fastapi.testclient import TestClient
from enhanced_app import app, initialize_classifier
import os

def test_enhanced_app():
    """Test enhanced app functionality"""
    print("🧪 Testing Enhanced App...")
    
    # Set testing environment
    os.environ["TESTING"] = "true"
    
    # Initialize classifier for testing
    initialize_classifier()
    
    client = TestClient(app)
    
    # Test health endpoint
    print("\n1. Testing health endpoint...")
    response = client.get("/health")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Response: {data}")
    else:
        print(f"   Error: {response.text}")
    
    # Test root endpoint
    print("\n2. Testing root endpoint...")
    response = client.get("/")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Response: {data}")
    else:
        print(f"   Error: {response.text}")
    
    # Test single prediction
    print("\n3. Testing single prediction...")
    email_data = {
        "subject": "Academic Newsletter",
        "body": "Important updates about courses and research opportunities."
    }
    response = client.post("/predict", json=email_data)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Prediction: {data['label']} (confidence: {data['confidence']:.2%})")
    else:
        print(f"   Error: {response.text}")
    
    # Test batch prediction
    print("\n4. Testing batch prediction...")
    batch_data = {
        "emails": [
            {"subject": "Academic Newsletter", "body": "Important updates about courses."},
            {"subject": "Job Opportunity", "body": "Software Engineer position available."},
            {"subject": "Special Offer", "body": "50% off on all products!"}
        ]
    }
    response = client.post("/predict/batch", json=batch_data)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Processed {len(data)} emails:")
        for i, result in enumerate(data):
            print(f"     {i+1}: {result['label']} (confidence: {result['confidence']:.2%})")
    else:
        print(f"   Error: {response.text}")
    
    # Test categories endpoint
    print("\n5. Testing categories endpoint...")
    response = client.get("/categories")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Categories: {len(data)}")
        for cat in data:
            print(f"     - {cat['name']} (ID: {cat['id']})")
    else:
        print(f"   Error: {response.text}")
    
    # Test add category
    print("\n6. Testing add category...")
    import time
    unique_name = f"TestCategory_{int(time.time())}"
    category_data = {
        "name": unique_name,
        "description": "Test category for API testing",
        "keywords": ["test", "api"],
        "color": "#FF0000"
    }
    response = client.post("/categories", json=category_data)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Result: {data['message']}")
    else:
        print(f"   Error: {response.text}")
    
    # Test remove category
    print("\n7. Testing remove category...")
    response = client.delete(f"/categories/{unique_name}")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Result: {data['message']}")
    else:
        print(f"   Error: {response.text}")
    
    # Test performance endpoint
    print("\n8. Testing performance endpoint...")
    response = client.get("/performance")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Total predictions: {data['total_predictions']}")
        print(f"   Average confidence: {data['average_confidence']:.2%}")
        print(f"   Categories count: {data['categories_count']}")
    else:
        print(f"   Error: {response.text}")
    
    print("\n🎉 Enhanced app testing completed!")

if __name__ == "__main__":
    test_enhanced_app()
