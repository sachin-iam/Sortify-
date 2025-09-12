import pytest
import asyncio
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

class TestAPIEndpoints:
    """Test cases for ML service API endpoints"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OK"
        assert "timestamp" in data
        assert "version" in data
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Sortify ML Service is running"
        assert data["version"] == "2.0.0"
    
    def test_model_status(self):
        """Test model status endpoint"""
        response = client.get("/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "message" in data
    
    def test_get_labels(self):
        """Test get labels endpoint"""
        response = client.get("/labels")
        assert response.status_code == 200
        data = response.json()
        assert "labels" in data
        assert "count" in data
        assert isinstance(data["labels"], list)
        assert isinstance(data["count"], int)
    
    def test_predict_email(self):
        """Test email prediction endpoint"""
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
        assert isinstance(data["confidence"], float)
        assert 0 <= data["confidence"] <= 1
    
    def test_predict_batch_emails(self):
        """Test batch email prediction endpoint"""
        batch_data = {
            "emails": [
                {
                    "subject": "Academic Newsletter",
                    "body": "This is an academic newsletter with important updates."
                },
                {
                    "subject": "Job Opportunity",
                    "body": "We have an exciting opportunity for a Software Engineer position."
                }
            ]
        }
        
        response = client.post("/predict/batch", json=batch_data)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        
        for result in data:
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
    
    def test_predict_invalid_data(self):
        """Test prediction with invalid data"""
        invalid_data = {
            "subject": "",
            "body": ""
        }
        
        response = client.post("/predict", json=invalid_data)
        # Should still work with empty strings
        assert response.status_code == 200
    
    def test_categorize_legacy_endpoint(self):
        """Test legacy categorize endpoint"""
        content_data = {
            "content": "This is a test email content for categorization."
        }
        
        response = client.post("/categorize", json=content_data)
        assert response.status_code == 200
        data = response.json()
        assert "label" in data
        assert "confidence" in data
    
    def test_training_status(self):
        """Test training status endpoint"""
        response = client.get("/train/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_training" in data
        assert "progress" in data
        assert "current_epoch" in data
        assert "total_epochs" in data
    
    def test_metrics_endpoint(self):
        """Test metrics endpoint"""
        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "accuracy" in data
        assert "precision" in data
        assert "recall" in data
        assert "f1" in data
        assert "timestamp" in data
        assert "model_path" in data
    
    def test_train_model_invalid_data(self):
        """Test training with invalid data"""
        invalid_training_data = {
            "emails": [],
            "epochs": 3,
            "learning_rate": 2e-5,
            "batch_size": 16
        }
        
        response = client.post("/train", json=invalid_training_data)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "empty" in data["detail"].lower()
    
    def test_train_model_missing_label(self):
        """Test training with emails missing labels"""
        invalid_training_data = {
            "emails": [
                {
                    "subject": "Test Email",
                    "body": "This is a test email without a label."
                }
            ],
            "epochs": 3,
            "learning_rate": 2e-5,
            "batch_size": 16
        }
        
        response = client.post("/train", json=invalid_training_data)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "label" in data["detail"].lower()

if __name__ == "__main__":
    pytest.main([__file__])
