#!/usr/bin/env python3
"""
Test script for the enhanced API
"""

import requests
import json
import time

def test_enhanced_api():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Enhanced ML API...")
    
    # Test health endpoint
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        return
    
    # Test root endpoint
    print("\n2. Testing root endpoint...")
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Root endpoint failed: {e}")
    
    # Test single prediction
    print("\n3. Testing single prediction...")
    try:
        email_data = {
            "subject": "Academic Newsletter",
            "body": "Important updates about courses and research opportunities."
        }
        response = requests.post(f"{base_url}/predict", json=email_data, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Prediction: {result['label']} (confidence: {result['confidence']:.2%})")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Single prediction failed: {e}")
    
    # Test batch prediction
    print("\n4. Testing batch prediction...")
    try:
        batch_data = {
            "emails": [
                {"subject": "Academic Newsletter", "body": "Important updates about courses."},
                {"subject": "Job Opportunity", "body": "Software Engineer position available."},
                {"subject": "Special Offer", "body": "50% off on all products!"}
            ]
        }
        response = requests.post(f"{base_url}/predict/batch", json=batch_data, timeout=15)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            results = response.json()
            print(f"   Processed {len(results)} emails:")
            for i, result in enumerate(results):
                print(f"     {i+1}: {result['label']} (confidence: {result['confidence']:.2%})")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Batch prediction failed: {e}")
    
    # Test categories endpoint
    print("\n5. Testing categories endpoint...")
    try:
        response = requests.get(f"{base_url}/categories", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            categories = response.json()
            print(f"   Categories: {len(categories)}")
            for cat in categories:
                print(f"     - {cat['name']} (ID: {cat['id']})")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Categories endpoint failed: {e}")
    
    # Test add category
    print("\n6. Testing add category...")
    try:
        category_data = {
            "name": "TestCategory",
            "description": "Test category for API testing",
            "keywords": ["test", "api"],
            "color": "#FF0000"
        }
        response = requests.post(f"{base_url}/categories", json=category_data, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Result: {result['message']}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Add category failed: {e}")
    
    # Test remove category
    print("\n7. Testing remove category...")
    try:
        response = requests.delete(f"{base_url}/categories/TestCategory", timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Result: {result['message']}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Remove category failed: {e}")
    
    # Test performance endpoint
    print("\n8. Testing performance endpoint...")
    try:
        response = requests.get(f"{base_url}/performance", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            stats = response.json()
            print(f"   Total predictions: {stats['total_predictions']}")
            print(f"   Average confidence: {stats['average_confidence']:.2%}")
            print(f"   Categories count: {stats['categories_count']}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Performance endpoint failed: {e}")
    
    print("\n🎉 API testing completed!")

if __name__ == "__main__":
    test_enhanced_api()
