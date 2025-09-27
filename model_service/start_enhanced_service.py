#!/usr/bin/env python3
"""
Startup script for Enhanced ML Service
"""

import os
import sys
import subprocess
import time
import requests
from pathlib import Path

def check_dependencies():
    """Check if all dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    required_packages = [
        "fastapi", "uvicorn", "torch", "transformers", 
        "numpy", "scikit-learn", "sqlalchemy", "websockets"
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing packages: {', '.join(missing_packages)}")
        print("Please install them with: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies are installed")
    return True

def check_model_availability():
    """Check if the model can be loaded"""
    print("🤖 Checking model availability...")
    
    try:
        from dynamic_classifier import DynamicEmailClassifier
        classifier = DynamicEmailClassifier()
        print("✅ Model loaded successfully")
        return True
    except Exception as e:
        print(f"❌ Model loading failed: {e}")
        print("This might be due to network issues or insufficient memory.")
        return False

def start_service():
    """Start the enhanced ML service"""
    print("🚀 Starting Enhanced ML Service...")
    
    # Set environment variables
    os.environ["MODEL_SERVICE_PORT"] = "8000"
    os.environ["LOG_LEVEL"] = "INFO"
    
    # Start the service
    try:
        subprocess.run([
            sys.executable, "enhanced_app.py"
        ], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"❌ Service failed to start: {e}")

def main():
    """Main startup function"""
    print("🎯 Sortify Enhanced ML Service Startup")
    print("=" * 50)
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check model availability
    if not check_model_availability():
        print("⚠️ Model loading failed, but service will still start")
        print("The service will use fallback classification methods")
    
    # Start service
    print("\n" + "=" * 50)
    start_service()

if __name__ == "__main__":
    main()
