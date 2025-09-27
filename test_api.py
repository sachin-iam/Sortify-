import requests
import time

def test_api():
    # Wait for server to start
    time.sleep(5)
    
    try:
        # Test the API endpoint
        url = "http://localhost:8001/classify_email"
        
        with open("data/sample_email1.eml", "rb") as f:
            files = {"file": ("sample_email1.eml", f, "message/rfc822")}
            response = requests.post(url, files=files)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()

