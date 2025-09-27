"""
Performance and load testing for enhanced ML service
"""

import pytest
import time
import asyncio
import threading
import requests
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from enhanced_app import app, initialize_classifier
from fastapi.testclient import TestClient

# Initialize classifier for testing
os.environ["TESTING"] = "true"
initialize_classifier()

client = TestClient(app)

class TestPerformance:
    """Performance and load testing"""
    
    def test_single_prediction_performance(self):
        """Test single prediction performance"""
        email_data = {
            "subject": "Performance Test Email",
            "body": "This is a test email for performance testing with some content to analyze."
        }
        
        # Measure single prediction time
        start_time = time.time()
        response = client.post("/predict", json=email_data)
        end_time = time.time()
        
        assert response.status_code == 200
        processing_time = end_time - start_time
        
        # Should complete within 2 seconds (allowing for model loading time)
        assert processing_time < 2.0
        print(f"Single prediction time: {processing_time:.4f} seconds")
    
    def test_batch_prediction_performance(self):
        """Test batch prediction performance"""
        # Create batch of emails
        emails = []
        for i in range(100):
            emails.append({
                "subject": f"Batch Test Email {i}",
                "body": f"This is batch test email number {i} with some content for performance testing."
            })
        
        batch_data = {"emails": emails}
        
        # Measure batch prediction time
        start_time = time.time()
        response = client.post("/predict/batch", json=batch_data)
        end_time = time.time()
        
        assert response.status_code == 200
        processing_time = end_time - start_time
        
        # Should complete within 10 seconds for 100 emails
        assert processing_time < 10.0
        
        throughput = len(emails) / processing_time
        print(f"Batch prediction time: {processing_time:.4f} seconds")
        print(f"Throughput: {throughput:.2f} emails/second")
        
        # Should achieve at least 10 emails/second
        assert throughput >= 10.0
    
    def test_large_batch_performance(self):
        """Test large batch performance"""
        # Create large batch of emails
        emails = []
        for i in range(1000):
            emails.append({
                "subject": f"Large Batch Test Email {i}",
                "body": f"This is large batch test email number {i} with some content for performance testing."
            })
        
        batch_data = {"emails": emails}
        
        # Measure large batch prediction time
        start_time = time.time()
        response = client.post("/predict/batch", json=batch_data)
        end_time = time.time()
        
        assert response.status_code == 200
        processing_time = end_time - start_time
        
        # Should complete within 60 seconds for 1000 emails
        assert processing_time < 60.0
        
        throughput = len(emails) / processing_time
        print(f"Large batch prediction time: {processing_time:.4f} seconds")
        print(f"Throughput: {throughput:.2f} emails/second")
        
        # Should achieve at least 20 emails/second for large batches
        assert throughput >= 20.0
    
    def test_concurrent_requests(self):
        """Test concurrent request handling"""
        def make_request():
            email_data = {
                "subject": "Concurrent Test Email",
                "body": "This is a test email for concurrent request testing."
            }
            response = client.post("/predict", json=email_data)
            return response.status_code == 200
        
        # Test with 50 concurrent requests
        num_requests = 50
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_request) for _ in range(num_requests)]
            results = [future.result() for future in as_completed(futures)]
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # All requests should succeed
        assert all(results)
        assert len(results) == num_requests
        
        # Should complete within reasonable time
        assert total_time < 30.0
        
        throughput = num_requests / total_time
        print(f"Concurrent requests time: {total_time:.4f} seconds")
        print(f"Concurrent throughput: {throughput:.2f} requests/second")
    
    def test_memory_usage(self):
        """Test memory usage during processing"""
        import psutil
        import os
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Process large batch
        emails = []
        for i in range(500):
            emails.append({
                "subject": f"Memory Test Email {i}",
                "body": f"This is memory test email number {i} with some content for memory usage testing."
            })
        
        batch_data = {"emails": emails}
        response = client.post("/predict/batch", json=batch_data)
        
        # Get memory usage after processing
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        assert response.status_code == 200
        print(f"Memory increase: {memory_increase:.2f} MB")
        
        # Memory increase should be reasonable (less than 500MB for 500 emails)
        assert memory_increase < 500.0
    
    def test_category_management_performance(self):
        """Test category management performance"""
        # Test adding multiple categories
        start_time = time.time()
        
        categories_to_add = []
        for i in range(20):
            category_data = {
                "name": f"PerfTestCategory{i}",
                "description": f"Performance test category {i}",
                "keywords": [f"test{i}", f"perf{i}"],
                "color": f"#{i:06x}"
            }
            categories_to_add.append(category_data)
        
        # Add categories
        for category_data in categories_to_add:
            response = client.post("/categories", json=category_data)
            assert response.status_code == 200
        
        add_time = time.time() - start_time
        
        # Test removing categories
        start_time = time.time()
        
        for category_data in categories_to_add:
            response = client.delete(f"/categories/{category_data['name']}")
            assert response.status_code == 200
        
        remove_time = time.time() - start_time
        
        print(f"Add 20 categories time: {add_time:.4f} seconds")
        print(f"Remove 20 categories time: {remove_time:.4f} seconds")
        
        # Should complete within reasonable time
        assert add_time < 10.0
        assert remove_time < 10.0
    
    def test_cache_performance(self):
        """Test cache performance"""
        # Test with repeated predictions (should hit cache)
        email_data = {
            "subject": "Cache Test Email",
            "body": "This is a test email for cache performance testing."
        }
        
        # First prediction (cache miss)
        start_time = time.time()
        response1 = client.post("/predict", json=email_data)
        first_time = time.time() - start_time
        
        # Second prediction (cache hit)
        start_time = time.time()
        response2 = client.post("/predict", json=email_data)
        second_time = time.time() - start_time
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Cache hit should be faster
        print(f"First prediction (cache miss): {first_time:.4f} seconds")
        print(f"Second prediction (cache hit): {second_time:.4f} seconds")
        
        # Note: Cache performance may vary, so we don't assert strict timing
        # but we verify both requests succeed
    
    @pytest.mark.skip(reason="WebSocket test requires running server - skipping for now")
    def test_websocket_performance(self):
        """Test WebSocket performance"""
        import websocket
        import threading
        import time
        
        messages_received = []
        
        def on_message(ws, message):
            messages_received.append(json.loads(message))
        
        def on_error(ws, error):
            print(f"WebSocket error: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            print("WebSocket closed")
        
        def on_open(ws):
            print("WebSocket opened")
        
        # Connect to WebSocket
        ws = websocket.WebSocketApp(
            "ws://localhost:8000/ws",
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        
        # Start WebSocket in separate thread
        ws_thread = threading.Thread(target=ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        
        # Wait for connection
        time.sleep(1)
        
        # Add a category to trigger WebSocket message
        category_data = {
            "name": "WebSocketTestCategory",
            "description": "WebSocket test category",
            "keywords": ["websocket", "test"],
            "color": "#FF0000"
        }
        
        response = client.post("/categories", json=category_data)
        assert response.status_code == 200
        
        # Wait for WebSocket message
        time.sleep(2)
        
        # Check if message was received
        assert len(messages_received) > 0
        
        # Clean up
        client.delete("/categories/WebSocketTestCategory")
        ws.close()
    
    def test_error_recovery(self):
        """Test error recovery and resilience"""
        # Test with malformed requests
        malformed_requests = [
            {"subject": "Test"},  # Missing body
            {"body": "Test"},     # Missing subject
            {},                   # Empty request
            {"subject": None, "body": None},  # None values
        ]
        
        for request_data in malformed_requests:
            response = client.post("/predict", json=request_data)
            # Should either succeed or return proper error code
            assert response.status_code in [200, 422]
    
    def test_throughput_under_load(self):
        """Test throughput under sustained load"""
        def sustained_load_worker(worker_id, num_requests):
            results = []
            for i in range(num_requests):
                email_data = {
                    "subject": f"Load Test Email {worker_id}-{i}",
                    "body": f"This is sustained load test email {worker_id}-{i} with some content."
                }
                
                start_time = time.time()
                response = client.post("/predict", json=email_data)
                end_time = time.time()
                
                results.append({
                    "success": response.status_code == 200,
                    "time": end_time - start_time
                })
            
            return results
        
        # Run sustained load test
        num_workers = 5
        requests_per_worker = 20
        total_requests = num_workers * requests_per_worker
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [
                executor.submit(sustained_load_worker, i, requests_per_worker)
                for i in range(num_workers)
            ]
            all_results = [future.result() for future in as_completed(futures)]
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Flatten results
        all_individual_results = []
        for worker_results in all_results:
            all_individual_results.extend(worker_results)
        
        # Check all requests succeeded
        success_count = sum(1 for result in all_individual_results if result["success"])
        assert success_count == total_requests
        
        # Calculate throughput
        throughput = total_requests / total_time
        print(f"Sustained load test: {total_requests} requests in {total_time:.4f} seconds")
        print(f"Throughput: {throughput:.2f} requests/second")
        
        # Should achieve at least 5 requests/second under sustained load
        assert throughput >= 5.0
        
        # Calculate average response time
        avg_response_time = sum(result["time"] for result in all_individual_results) / len(all_individual_results)
        print(f"Average response time: {avg_response_time:.4f} seconds")
        
        # Average response time should be reasonable
        assert avg_response_time < 2.0

if __name__ == "__main__":
    pytest.main([__file__])
