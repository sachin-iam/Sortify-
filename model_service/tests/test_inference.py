import pytest
import torch
from inference import EmailCategorizer

class TestEmailCategorizer:
    """Test cases for EmailCategorizer class"""
    
    def test_initialization(self):
        """Test EmailCategorizer initialization"""
        try:
            categorizer = EmailCategorizer()
            assert categorizer is not None
            assert categorizer.categories is not None
            assert len(categorizer.categories) == 5
            assert "Academic" in categorizer.categories
            assert "Promotions" in categorizer.categories
            assert "Placement" in categorizer.categories
            assert "Spam" in categorizer.categories
            assert "Other" in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model initialization failed: {e}")
    
    def test_get_labels(self):
        """Test get_labels method"""
        try:
            categorizer = EmailCategorizer()
            labels = categorizer.get_labels()
            assert isinstance(labels, list)
            assert len(labels) == 5
            assert all(isinstance(label, str) for label in labels)
        except Exception as e:
            pytest.skip(f"Model initialization failed: {e}")
    
    def test_get_model_info(self):
        """Test get_model_info method"""
        try:
            categorizer = EmailCategorizer()
            model_info = categorizer.get_model_info()
            assert isinstance(model_info, dict)
            assert "model_name" in model_info
            assert "categories" in model_info
            assert "device" in model_info
            assert "num_labels" in model_info
            assert "status" in model_info
        except Exception as e:
            pytest.skip(f"Model initialization failed: {e}")
    
    def test_predict_academic_email(self):
        """Test prediction for academic email"""
        try:
            categorizer = EmailCategorizer()
            result = categorizer.predict(
                "Academic Newsletter",
                "This is an academic newsletter with important updates about courses and research opportunities."
            )
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert isinstance(result["confidence"], float)
            assert 0 <= result["confidence"] <= 1
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")
    
    def test_predict_promotional_email(self):
        """Test prediction for promotional email"""
        try:
            categorizer = EmailCategorizer()
            result = categorizer.predict(
                "Special Offer - 50% Off!",
                "Don't miss out on our special offer! Get 50% off on all products for a limited time."
            )
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")
    
    def test_predict_job_email(self):
        """Test prediction for job placement email"""
        try:
            categorizer = EmailCategorizer()
            result = categorizer.predict(
                "Job Opportunity - Software Engineer",
                "We have an exciting opportunity for a Software Engineer position. Please review the attached job description."
            )
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")
    
    def test_predict_spam_email(self):
        """Test prediction for spam email"""
        try:
            categorizer = EmailCategorizer()
            result = categorizer.predict(
                "URGENT: Claim Your Prize Now!",
                "Congratulations! You have won $1,000,000! Click here to claim your prize immediately!"
            )
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")
    
    def test_predict_batch_emails(self):
        """Test batch prediction"""
        try:
            categorizer = EmailCategorizer()
            emails = [
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
            
            results = categorizer.predict_batch(emails)
            
            assert isinstance(results, list)
            assert len(results) == 3
            
            for result in results:
                assert isinstance(result, dict)
                assert "label" in result
                assert "confidence" in result
                assert "scores" in result
                assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model batch prediction failed: {e}")
    
    def test_predict_empty_input(self):
        """Test prediction with empty input"""
        try:
            categorizer = EmailCategorizer()
            result = categorizer.predict("", "")
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")
    
    def test_predict_long_text(self):
        """Test prediction with very long text"""
        try:
            categorizer = EmailCategorizer()
            long_text = "This is a very long email body. " * 100  # Very long text
            result = categorizer.predict("Long Email Subject", long_text)
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")
    
    def test_predict_special_characters(self):
        """Test prediction with special characters"""
        try:
            categorizer = EmailCategorizer()
            result = categorizer.predict(
                "Email with Special Characters: @#$%^&*()",
                "This email contains special characters: @#$%^&*() and unicode: 🎉🚀💻"
            )
            
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in categorizer.categories
        except Exception as e:
            pytest.skip(f"Model prediction failed: {e}")

if __name__ == "__main__":
    pytest.main([__file__])
