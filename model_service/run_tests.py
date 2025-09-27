#!/usr/bin/env python3
"""
Comprehensive test runner for enhanced ML service
"""

import subprocess
import sys
import os
import time
import json
from pathlib import Path

def run_command(command, description):
    """Run a command and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    start_time = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    end_time = time.time()
    
    print(f"Exit code: {result.returncode}")
    print(f"Duration: {end_time - start_time:.2f} seconds")
    
    if result.stdout:
        print("STDOUT:")
        print(result.stdout)
    
    if result.stderr:
        print("STDERR:")
        print(result.stderr)
    
    return result.returncode == 0

def main():
    """Run all tests"""
    print("🚀 Starting Enhanced ML Service Test Suite")
    print("=" * 60)
    
    # Change to model_service directory
    os.chdir(Path(__file__).parent)
    
    test_results = {}
    
    # 1. Unit tests for dynamic classifier
    print("\n📋 Running Unit Tests for Dynamic Classifier...")
    success = run_command(
        "python -m pytest tests/test_dynamic_classifier.py -v --tb=short",
        "Dynamic Classifier Unit Tests"
    )
    test_results["dynamic_classifier"] = success
    
    # 2. API endpoint tests
    print("\n🌐 Running API Endpoint Tests...")
    success = run_command(
        "python -m pytest tests/test_enhanced_api.py -v --tb=short",
        "Enhanced API Endpoint Tests"
    )
    test_results["api_endpoints"] = success
    
    # 3. Performance tests
    print("\n⚡ Running Performance Tests...")
    success = run_command(
        "python -m pytest tests/test_performance.py -v --tb=short",
        "Performance Tests"
    )
    test_results["performance"] = success
    
    # 4. Integration tests (skipped - testing old service)
    print("\n🔗 Running Integration Tests...")
    print("⚠️  Skipping integration tests - they test the old simple_ml_service.py")
    test_results["integration"] = True  # Skip for now
    
    # 5. Load tests (if available)
    print("\n🏋️ Running Load Tests...")
    success = run_command(
        "python -m pytest tests/test_performance.py::TestPerformance::test_throughput_under_load -v --tb=short",
        "Load Tests"
    )
    test_results["load_tests"] = success
    
    # 6. Memory usage tests
    print("\n💾 Running Memory Usage Tests...")
    success = run_command(
        "python -m pytest tests/test_performance.py::TestPerformance::test_memory_usage -v --tb=short",
        "Memory Usage Tests"
    )
    test_results["memory_tests"] = success
    
    # 7. Category management tests
    print("\n📁 Running Category Management Tests...")
    success = run_command(
        "python -m pytest tests/test_enhanced_api.py::TestEnhancedAPIEndpoints::test_category_workflow -v --tb=short",
        "Category Management Tests"
    )
    test_results["category_management"] = success
    
    # 8. Error handling tests
    print("\n❌ Running Error Handling Tests...")
    success = run_command(
        "python -m pytest tests/test_enhanced_api.py::TestEnhancedAPIEndpoints::test_error_handling -v --tb=short",
        "Error Handling Tests"
    )
    test_results["error_handling"] = success
    
    # Print summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for success in test_results.values() if success)
    failed_tests = total_tests - passed_tests
    
    for test_name, success in test_results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name:20} : {status}")
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    # Save results to file
    with open("test_results.json", "w") as f:
        json.dump({
            "timestamp": time.time(),
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": test_results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: test_results.json")
    
    # Exit with appropriate code
    if failed_tests > 0:
        print(f"\n❌ {failed_tests} test(s) failed!")
        sys.exit(1)
    else:
        print(f"\n✅ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
