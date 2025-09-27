#!/usr/bin/env python3
"""
Enhanced ML Service Demo Script
Demonstrates all features of the dynamic email classification system
"""

import requests
import json
import time
import asyncio
import websockets
from typing import List, Dict, Any

class EnhancedMLServiceDemo:
    """Demo class for enhanced ML service"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.ws_url = base_url.replace("http", "ws") + "/ws"
    
    def test_health(self):
        """Test service health"""
        print("🏥 Testing service health...")
        response = requests.get(f"{self.base_url}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Service is healthy: {data['status']}")
            print(f"   Model loaded: {data['model_loaded']}")
            print(f"   Categories: {data['categories_count']}")
            return True
        else:
            print(f"❌ Service health check failed: {response.status_code}")
            return False
    
    def test_single_prediction(self):
        """Test single email prediction"""
        print("\n📧 Testing single email prediction...")
        
        test_emails = [
            {
                "subject": "Academic Newsletter",
                "body": "Important updates about courses, research opportunities, and academic events."
            },
            {
                "subject": "Job Opportunity - Software Engineer",
                "body": "We have an exciting opportunity for a Software Engineer position at our company."
            },
            {
                "subject": "Special Offer - 50% Off!",
                "body": "Don't miss out on our special offer! Get 50% off on all products for a limited time."
            },
            {
                "subject": "URGENT: Claim Your Prize!",
                "body": "Congratulations! You have won $1,000,000! Click here to claim your prize immediately!"
            }
        ]
        
        for i, email in enumerate(test_emails, 1):
            response = requests.post(f"{self.base_url}/predict", json=email)
            if response.status_code == 200:
                result = response.json()
                print(f"   Email {i}: {result['label']} (confidence: {result['confidence']:.2%})")
            else:
                print(f"   Email {i}: Failed - {response.status_code}")
    
    def test_batch_prediction(self):
        """Test batch email prediction"""
        print("\n📦 Testing batch email prediction...")
        
        # Create batch of emails
        emails = []
        for i in range(10):
            emails.append({
                "subject": f"Test Email {i+1}",
                "body": f"This is test email number {i+1} with some content for batch processing."
            })
        
        start_time = time.time()
        response = requests.post(f"{self.base_url}/predict/batch", json={"emails": emails})
        end_time = time.time()
        
        if response.status_code == 200:
            results = response.json()
            processing_time = end_time - start_time
            throughput = len(emails) / processing_time
            
            print(f"✅ Batch prediction successful!")
            print(f"   Processed: {len(emails)} emails")
            print(f"   Time: {processing_time:.2f} seconds")
            print(f"   Throughput: {throughput:.2f} emails/second")
            
            # Show sample results
            for i, result in enumerate(results[:3]):
                print(f"   Email {i+1}: {result['label']} ({result['confidence']:.2%})")
        else:
            print(f"❌ Batch prediction failed: {response.status_code}")
    
    def test_category_management(self):
        """Test dynamic category management"""
        print("\n📁 Testing category management...")
        
        # Get initial categories
        response = requests.get(f"{self.base_url}/categories")
        if response.status_code == 200:
            initial_categories = response.json()
            print(f"   Initial categories: {len(initial_categories)}")
        
        # Add new category
        new_category = {
            "name": "Newsletter",
            "description": "Newsletter and news content",
            "keywords": ["newsletter", "news", "update", "announcement"],
            "color": "#8B5CF6"
        }
        
        print("   Adding new category: Newsletter")
        response = requests.post(f"{self.base_url}/categories", json=new_category)
        if response.status_code == 200:
            print("   ✅ Category added successfully")
        else:
            print(f"   ❌ Failed to add category: {response.status_code}")
            return
        
        # Test prediction with new category
        test_email = {
            "subject": "Weekly Newsletter",
            "body": "This week's newsletter contains important updates and announcements."
        }
        
        print("   Testing prediction with new category...")
        response = requests.post(f"{self.base_url}/predict", json=test_email)
        if response.status_code == 200:
            result = response.json()
            print(f"   Prediction: {result['label']} (confidence: {result['confidence']:.2%})")
        
        # Update category
        print("   Updating category...")
        update_data = {
            "description": "Updated newsletter description",
            "color": "#FF5733"
        }
        response = requests.put(f"{self.base_url}/categories/Newsletter", json=update_data)
        if response.status_code == 200:
            print("   ✅ Category updated successfully")
        
        # Remove category
        print("   Removing category...")
        response = requests.delete(f"{self.base_url}/categories/Newsletter")
        if response.status_code == 200:
            print("   ✅ Category removed successfully")
    
    def test_performance_metrics(self):
        """Test performance metrics"""
        print("\n📊 Testing performance metrics...")
        
        response = requests.get(f"{self.base_url}/performance")
        if response.status_code == 200:
            stats = response.json()
            print(f"   Total predictions: {stats['total_predictions']}")
            print(f"   Batch predictions: {stats['total_batch_predictions']}")
            print(f"   Average confidence: {stats['average_confidence']:.2%}")
            print(f"   Uptime: {stats['uptime_seconds']:.0f} seconds")
            print(f"   Cache size: {stats['cache_size']}")
            print(f"   Categories: {stats['categories_count']}")
        else:
            print(f"   ❌ Failed to get performance metrics: {response.status_code}")
    
    def test_websocket_updates(self):
        """Test WebSocket real-time updates"""
        print("\n🔌 Testing WebSocket updates...")
        
        async def websocket_test():
            try:
                async with websockets.connect(self.ws_url) as websocket:
                    print("   ✅ WebSocket connected")
                    
                    # Add a category to trigger update
                    category_data = {
                        "name": "WebSocketTest",
                        "description": "WebSocket test category",
                        "keywords": ["websocket", "test"],
                        "color": "#00FF00"
                    }
                    
                    # Send category add request
                    response = requests.post(f"{self.base_url}/categories", json=category_data)
                    if response.status_code == 200:
                        print("   Category added, waiting for WebSocket update...")
                        
                        # Wait for WebSocket message
                        try:
                            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                            data = json.loads(message)
                            print(f"   ✅ Received WebSocket update: {data['type']}")
                        except asyncio.TimeoutError:
                            print("   ⚠️ WebSocket update timeout")
                    
                    # Clean up
                    requests.delete(f"{self.base_url}/categories/WebSocketTest")
                    
            except Exception as e:
                print(f"   ❌ WebSocket test failed: {e}")
        
        # Run WebSocket test
        asyncio.run(websocket_test())
    
    def test_large_scale_processing(self):
        """Test large-scale email processing"""
        print("\n🚀 Testing large-scale processing...")
        
        # Create large batch
        emails = []
        for i in range(100):
            emails.append({
                "subject": f"Large Scale Test Email {i+1}",
                "body": f"This is large scale test email number {i+1} with content for performance testing."
            })
        
        print(f"   Processing {len(emails)} emails...")
        start_time = time.time()
        
        response = requests.post(f"{self.base_url}/predict/batch", json={"emails": emails})
        end_time = time.time()
        
        if response.status_code == 200:
            processing_time = end_time - start_time
            throughput = len(emails) / processing_time
            
            print(f"   ✅ Large-scale processing successful!")
            print(f"   Time: {processing_time:.2f} seconds")
            print(f"   Throughput: {throughput:.2f} emails/second")
            
            # Check if throughput meets requirements
            if throughput >= 20:
                print("   ✅ Throughput requirement met (≥20 emails/second)")
            else:
                print("   ⚠️ Throughput below requirement (<20 emails/second)")
        else:
            print(f"   ❌ Large-scale processing failed: {response.status_code}")
    
    def run_complete_demo(self):
        """Run complete demo"""
        print("🎯 Enhanced ML Service Demo")
        print("=" * 50)
        
        # Test all features
        if not self.test_health():
            print("❌ Service is not available. Please start the service first.")
            return
        
        self.test_single_prediction()
        self.test_batch_prediction()
        self.test_category_management()
        self.test_performance_metrics()
        self.test_websocket_updates()
        self.test_large_scale_processing()
        
        print("\n🎉 Demo completed successfully!")
        print("=" * 50)

def main():
    """Main demo function"""
    demo = EnhancedMLServiceDemo()
    demo.run_complete_demo()

if __name__ == "__main__":
    main()
