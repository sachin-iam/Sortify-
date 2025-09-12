@echo off
echo ========================================
echo    Running Sortify Tests
echo ========================================
echo.

echo [1/3] Running client tests...
cd client
call npm test
if %errorlevel% neq 0 (
    echo ❌ Client tests failed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] Running server tests...
cd server
call npm test
if %errorlevel% neq 0 (
    echo ❌ Server tests failed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/3] Running ML service tests...
cd model_service
pytest
if %errorlevel% neq 0 (
    echo ❌ ML service tests failed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo        All Tests Passed! ✅
echo ========================================
echo.
pause
