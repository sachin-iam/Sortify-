"""
Comprehensive test cases for enhanced API endpoints
"""

import pytest
import asyncio
import json
import os
from fastapi.testclient import TestClient
from enhanced_app import app, initialize_classifier

# Initialize classifier for testing
os.environ["TESTING"] = "true"
initialize_classifier()

client = TestClient(app)

class TestEnhancedAPIEndpoints:
    """Test cases for enhanced API endpoints"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OK"
        assert "timestamp" in data
        assert "version" in data
        assert "model_loaded" in data
        assert "categories_count" in data
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Sortify Enhanced ML Service is running"
        assert data["version"] == "3.0.0"
        assert "features" in data
        assert isinstance(data["features"], list)
    
    def test_model_status(self):
        """Test model status endpoint"""
        response = client.get("/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "message" in data
        assert "model_info" in data
    
    def test_predict_single_email(self):
        """Test single email prediction"""
        email_data = {
            "subject": "Academic Newsletter",
            "body": "This is an academic newsletter with important updates about courses and research opportunities."
        }
        
        response = client.post("/predict", json=email_data)
        assert response.status_code == 200
        data = response.json()
        assert "label" in data
        assert "confidence" in data
        assert "scores" in data
        assert "category_id" in data
        assert isinstance(data["confidence"], float)
        assert 0 <= data["confidence"] <= 1
    
    def test_predict_batch_emails(self):
        """Test batch email prediction"""
        batch_data = {
            "emails": [
                {
                    "subject": "Academic Newsletter",
                    "body": "This is an academic newsletter with important updates."
                },
                {
                    "subject": "Job Opportunity",
                    "body": "We have an exciting opportunity for a Software Engineer position."
                },
                {
                    "subject": "Special Offer",
                    "body": "Don't miss out on our special offer! Get 50% off on all products."
                }
            ]
        }
        
        response = client.post("/predict/batch", json=batch_data)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
        
        for result in data:
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert "category_id" in result
    
    def test_get_categories(self):
        """Test get categories endpoint"""
        response = client.get("/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # At least default categories
        
        for category in data:
            assert "name" in category
            assert "id" in category
            assert "description" in category
            assert "keywords" in category
            assert "color" in category
            assert "created_at" in category
    
    def test_add_category(self):
        """Test adding new category"""
        import time
        unique_name = f"TestCategory_{int(time.time())}"
        category_data = {
            "name": unique_name,
            "description": "Test category content",
            "keywords": ["test", "category", "unique"],
            "color": "#8B5CF6"
        }
        
        response = client.post("/categories", json=category_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert f"Category '{unique_name}' added successfully" in data["message"]
        assert "category" in data
        assert data["category"]["name"] == unique_name
        
        # Clean up - remove the test category
        cleanup_response = client.delete(f"/categories/{unique_name}")
        assert cleanup_response.status_code == 200
    
    def test_add_duplicate_category(self):
        """Test adding duplicate category"""
        category_data = {
            "name": "Academic",  # Default category
            "description": "Test description",
            "keywords": ["test"],
            "color": "#FF0000"
        }
        
        response = client.post("/categories", json=category_data)
        assert response.status_code == 400  # Should fail with bad request
    
    def test_remove_category(self):
        """Test removing category"""
        # First add a category
        category_data = {
            "name": "TestCategory",
            "description": "Test category for removal",
            "keywords": ["test"],
            "color": "#FF0000"
        }
        client.post("/categories", json=category_data)
        
        # Now remove it
        response = client.delete("/categories/TestCategory")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Category 'TestCategory' removed successfully" in data["message"]
    
    def test_remove_nonexistent_category(self):
        """Test removing non-existent category"""
        response = client.delete("/categories/NonExistentCategory")
        assert response.status_code == 500  # Should fail
    
    def test_remove_default_category(self):
        """Test removing default category (should fail)"""
        response = client.delete("/categories/Academic")
        assert response.status_code == 500  # Should fail
    
    def test_update_category(self):
        """Test updating category"""
        # First add a category
        category_data = {
            "name": "UpdateTestCategory",
            "description": "Original description",
            "keywords": ["original"],
            "color": "#000000"
        }
        client.post("/categories", json=category_data)
        
        # Update it
        update_data = {
            "description": "Updated description",
            "keywords": ["updated", "test"],
            "color": "#FFFFFF"
        }
        
        response = client.put("/categories/UpdateTestCategory", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Category 'UpdateTestCategory' updated successfully" in data["message"]
        
        # Clean up
        client.delete("/categories/UpdateTestCategory")
    
    def test_update_nonexistent_category(self):
        """Test updating non-existent category"""
        update_data = {
            "description": "Updated description"
        }
        
        response = client.put("/categories/NonExistentCategory", json=update_data)
        assert response.status_code == 404  # Should fail
    
    def test_get_performance_stats(self):
        """Test getting performance statistics"""
        response = client.get("/performance")
        assert response.status_code == 200
        data = response.json()
        assert "total_predictions" in data
        assert "total_batch_predictions" in data
        assert "average_confidence" in data
        assert "uptime_seconds" in data
        assert "cache_size" in data
        assert "categories_count" in data
    
    def test_clear_cache(self):
        """Test clearing prediction cache"""
        response = client.post("/cache/clear")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Cache cleared successfully" in data["message"]
    
    def test_legacy_categorize_endpoint(self):
        """Test legacy categorize endpoint"""
        content_data = {
            "content": "This is a test email content for categorization."
        }
        
        response = client.post("/categorize", json=content_data)
        assert response.status_code == 200
        data = response.json()
        assert "label" in data
        assert "confidence" in data
        assert "scores" in data
        assert "category_id" in data
    
    def test_legacy_labels_endpoint(self):
        """Test legacy labels endpoint"""
        response = client.get("/labels")
        assert response.status_code == 200
        data = response.json()
        assert "labels" in data
        assert "count" in data
        assert isinstance(data["labels"], list)
        assert isinstance(data["count"], int)
        assert data["count"] >= 5  # At least default categories
    
    def test_predict_invalid_data(self):
        """Test prediction with invalid data"""
        invalid_data = {
            "subject": "",
            "body": ""
        }
        
        response = client.post("/predict", json=invalid_data)
        assert response.status_code == 200  # Should still work with empty strings
    
    def test_predict_missing_fields(self):
        """Test prediction with missing fields"""
        invalid_data = {
            "subject": "Test"
            # Missing body field
        }
        
        response = client.post("/predict", json=invalid_data)
        assert response.status_code == 422  # Validation error
    
    def test_batch_predict_empty_list(self):
        """Test batch prediction with empty list"""
        batch_data = {
            "emails": []
        }
        
        response = client.post("/predict/batch", json=batch_data)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    def test_large_batch_prediction(self):
        """Test large batch prediction"""
        emails = []
        for i in range(50):  # Large batch
            emails.append({
                "subject": f"Test Email {i}",
                "body": f"This is test email number {i} with some content."
            })
        
        batch_data = {"emails": emails}
        
        response = client.post("/predict/batch", json=batch_data)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 50
        
        for result in data:
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert "category_id" in result
    
    def test_category_workflow(self):
        """Test complete category workflow"""
        # 1. Get initial categories
        response = client.get("/categories")
        initial_count = len(response.json())
        
        # 2. Add new category
        category_data = {
            "name": "WorkflowTest",
            "description": "Test category for workflow",
            "keywords": ["workflow", "test"],
            "color": "#FF5733"
        }
        response = client.post("/categories", json=category_data)
        assert response.status_code == 200
        
        # 3. Verify category was added
        response = client.get("/categories")
        new_count = len(response.json())
        assert new_count == initial_count + 1
        
        # 4. Test prediction with new category
        email_data = {
            "subject": "Workflow Test Email",
            "body": "This is a test email for the workflow test category."
        }
        response = client.post("/predict", json=email_data)
        assert response.status_code == 200
        
        # 5. Update category
        update_data = {
            "description": "Updated workflow test category",
            "color": "#33FF57"
        }
        response = client.put("/categories/WorkflowTest", json=update_data)
        assert response.status_code == 200
        
        # 6. Remove category
        response = client.delete("/categories/WorkflowTest")
        assert response.status_code == 200
        
        # 7. Verify category was removed
        response = client.get("/categories")
        final_count = len(response.json())
        assert final_count == initial_count
    
    def test_performance_under_load(self):
        """Test performance under load"""
        import time
        
        # Make multiple concurrent requests
        start_time = time.time()
        
        # Create test data
        emails = []
        for i in range(20):
            emails.append({
                "subject": f"Load Test Email {i}",
                "body": f"This is load test email number {i} with some content for testing performance."
            })
        
        batch_data = {"emails": emails}
        
        # Make multiple batch requests
        responses = []
        for _ in range(5):  # 5 concurrent batch requests
            response = client.post("/predict/batch", json=batch_data)
            responses.append(response)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == 200
        
        # Should complete within reasonable time (adjust threshold as needed)
        assert processing_time < 30  # 30 seconds for 100 emails
        
        print(f"Processed 100 emails in {processing_time:.2f} seconds")
    
    def test_error_handling(self):
        """Test error handling"""
        # Test with malformed JSON
        response = client.post("/predict", data="invalid json")
        assert response.status_code == 422
        
        # Test with wrong endpoint
        response = client.get("/nonexistent")
        assert response.status_code == 404
        
        # Test with wrong method
        response = client.get("/predict")
        assert response.status_code == 405  # Method not allowed

if __name__ == "__main__":
    pytest.main([__file__])
