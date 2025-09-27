"""
Comprehensive test cases for dynamic email classifier
"""

import pytest
import torch
import json
import tempfile
import os
from dynamic_classifier import DynamicEmailClassifier, DynamicCategoryManager

class TestDynamicCategoryManager:
    """Test cases for DynamicCategoryManager"""
    
    def test_initialization(self):
        """Test category manager initialization"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_file = f.name
        
        try:
            manager = DynamicCategoryManager(temp_file)
            assert manager is not None
            assert len(manager.get_categories()) == 5  # Default categories
            assert "Academic" in manager.get_category_names()
            assert "Promotions" in manager.get_category_names()
        finally:
            os.unlink(temp_file)
    
    def test_add_category(self):
        """Test adding new category"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_file = f.name
        
        try:
            manager = DynamicCategoryManager(temp_file)
            
            # Add new category
            success = manager.add_category(
                name="Newsletter",
                description="Newsletter content",
                keywords=["newsletter", "news", "update"],
                color="#8B5CF6"
            )
            
            assert success == True
            assert "Newsletter" in manager.get_category_names()
            
            # Check category data
            categories = manager.get_categories()
            newsletter_cat = categories["Newsletter"]
            assert newsletter_cat["description"] == "Newsletter content"
            assert newsletter_cat["keywords"] == ["newsletter", "news", "update"]
            assert newsletter_cat["color"] == "#8B5CF6"
            
        finally:
            os.unlink(temp_file)
    
    def test_remove_category(self):
        """Test removing category"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_file = f.name
        
        try:
            manager = DynamicCategoryManager(temp_file)
            
            # Add category first
            manager.add_category("TestCategory", "Test description")
            assert "TestCategory" in manager.get_category_names()
            
            # Remove category
            success = manager.remove_category("TestCategory")
            assert success == True
            assert "TestCategory" not in manager.get_category_names()
            
            # Try to remove default category (should fail)
            success = manager.remove_category("Academic")
            assert success == False
            
        finally:
            os.unlink(temp_file)
    
    def test_update_category(self):
        """Test updating category"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_file = f.name
        
        try:
            manager = DynamicCategoryManager(temp_file)
            
            # Add category
            manager.add_category("TestCategory", "Original description")
            
            # Update category
            success = manager.update_category(
                "TestCategory",
                description="Updated description",
                color="#FF0000"
            )
            
            assert success == True
            categories = manager.get_categories()
            test_cat = categories["TestCategory"]
            assert test_cat["description"] == "Updated description"
            assert test_cat["color"] == "#FF0000"
            
        finally:
            os.unlink(temp_file)
    
    def test_get_category_by_id(self):
        """Test getting category by ID"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_file = f.name
        
        try:
            manager = DynamicCategoryManager(temp_file)
            
            # Test existing category
            academic_name = manager.get_category_by_id(0)
            assert academic_name == "Academic"
            
            # Test non-existent ID
            non_existent = manager.get_category_by_id(999)
            assert non_existent is None
            
        finally:
            os.unlink(temp_file)

class TestDynamicEmailClassifier:
    """Test cases for DynamicEmailClassifier"""
    
    @pytest.fixture
    def classifier(self):
        """Create classifier instance for testing"""
        try:
            return DynamicEmailClassifier()
        except Exception as e:
            pytest.skip(f"Classifier initialization failed: {e}")
    
    def test_initialization(self, classifier):
        """Test classifier initialization"""
        assert classifier is not None
        assert classifier.model is not None
        assert classifier.tokenizer is not None
        # Check that we have at least the default 5 categories
        assert len(classifier.get_categories()) >= 5
    
    def test_predict_single_academic(self, classifier):
        """Test single prediction for academic email"""
        result = classifier.predict_single(
            "Academic Newsletter",
            "This is an academic newsletter with important updates about courses and research opportunities."
        )
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert "category_id" in result
        assert isinstance(result["confidence"], float)
        assert 0 <= result["confidence"] <= 1
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_predict_single_promotional(self, classifier):
        """Test single prediction for promotional email"""
        result = classifier.predict_single(
            "Special Offer - 50% Off!",
            "Don't miss out on our special offer! Get 50% off on all products for a limited time."
        )
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_predict_single_job(self, classifier):
        """Test single prediction for job email"""
        result = classifier.predict_single(
            "Job Opportunity - Software Engineer",
            "We have an exciting opportunity for a Software Engineer position. Please review the attached job description."
        )
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_predict_single_spam(self, classifier):
        """Test single prediction for spam email"""
        result = classifier.predict_single(
            "URGENT: Claim Your Prize Now!",
            "Congratulations! You have won $1,000,000! Click here to claim your prize immediately!"
        )
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_predict_batch(self, classifier):
        """Test batch prediction"""
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
        
        results = classifier.predict_batch(emails)
        
        assert isinstance(results, list)
        assert len(results) == 3
        
        for result in results:
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert "scores" in result
            assert result["label"] in list(classifier.get_categories().keys())
    
    def test_predict_empty_input(self, classifier):
        """Test prediction with empty input"""
        result = classifier.predict_single("", "")
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_predict_long_text(self, classifier):
        """Test prediction with very long text"""
        long_text = "This is a very long email body. " * 100
        result = classifier.predict_single("Long Email Subject", long_text)
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_add_category(self, classifier):
        """Test adding new category"""
        initial_count = len(classifier.get_categories())
        
        # Try to add a unique category name
        import time
        unique_name = f"TestCategory_{int(time.time())}"
        
        success = classifier.add_category(
            name=unique_name,
            description="Test category content",
            keywords=["test", "category"],
            color="#8B5CF6"
        )
        
        assert success == True
        assert len(classifier.get_categories()) == initial_count + 1
        assert unique_name in list(classifier.get_categories().keys())
        
        # Clean up
        classifier.remove_category(unique_name)
    
    def test_remove_category(self, classifier):
        """Test removing category"""
        # Add category first
        classifier.add_category("TestCategory", "Test description")
        assert "TestCategory" in list(classifier.get_categories().keys())
        
        # Remove category
        success = classifier.remove_category("TestCategory")
        assert success == True
        assert "TestCategory" not in list(classifier.get_categories().keys())
    
    def test_get_model_info(self, classifier):
        """Test getting model information"""
        info = classifier.get_model_info()
        
        assert isinstance(info, dict)
        assert "model_name" in info
        assert "device" in info
        assert "categories" in info
        assert "num_categories" in info
        assert "status" in info
        assert info["status"] == "ready"
    
    def test_get_performance_stats(self, classifier):
        """Test getting performance statistics"""
        stats = classifier.get_performance_stats()
        
        assert isinstance(stats, dict)
        assert "cache_size" in stats
        assert "batch_size" in stats
        assert "categories_count" in stats
        assert "device" in stats
    
    def test_clear_cache(self, classifier):
        """Test clearing prediction cache"""
        # Make some predictions to populate cache
        classifier.predict_single("Test", "Test body")
        
        # Clear cache
        classifier.clear_cache()
        
        # Check cache is empty
        stats = classifier.get_performance_stats()
        assert stats["cache_size"] == 0
    
    def test_large_batch_processing(self, classifier):
        """Test processing large batch of emails"""
        # Create large batch
        emails = []
        for i in range(100):
            emails.append({
                "subject": f"Test Email {i}",
                "body": f"This is test email number {i} with some content."
            })
        
        results = classifier.predict_batch(emails)
        
        assert isinstance(results, list)
        assert len(results) == 100
        
        for result in results:
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result
            assert result["label"] in list(classifier.get_categories().keys())
    
    def test_special_characters(self, classifier):
        """Test prediction with special characters"""
        result = classifier.predict_single(
            "Email with Special Characters: @#$%^&*()",
            "This email contains special characters: @#$%^&*() and unicode: 🎉🚀💻"
        )
        
        assert isinstance(result, dict)
        assert "label" in result
        assert "confidence" in result
        assert "scores" in result
        assert result["label"] in list(classifier.get_categories().keys())
    
    def test_category_consistency(self, classifier):
        """Test that categories remain consistent after operations"""
        initial_categories = list(classifier.get_categories().keys())
        
        # Add category
        classifier.add_category("TestCategory", "Test")
        assert len(classifier.get_categories()) == len(initial_categories) + 1
        
        # Remove category
        classifier.remove_category("TestCategory")
        assert list(classifier.get_categories().keys()) == initial_categories
    
    def test_concurrent_predictions(self, classifier):
        """Test concurrent predictions"""
        import threading
        import time
        
        results = []
        errors = []
        
        def predict_worker():
            try:
                result = classifier.predict_single(
                    "Concurrent Test",
                    "This is a test for concurrent predictions."
                )
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Start multiple threads
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=predict_worker)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check results
        assert len(errors) == 0, f"Errors in concurrent predictions: {errors}"
        assert len(results) == 10
        
        for result in results:
            assert isinstance(result, dict)
            assert "label" in result
            assert "confidence" in result

if __name__ == "__main__":
    pytest.main([__file__])
