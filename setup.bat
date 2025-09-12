@echo off
echo ========================================
echo    Sortify - AI-Powered Email Organization
echo ========================================
echo.

echo [1/6] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)

echo.
echo [2/6] Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install client dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo [3/6] Installing server dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install server dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo [4/6] Installing ML service dependencies...
cd model_service
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install ML service dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo [5/6] Setting up environment files...
if not exist "server\.env" (
    copy "server\env.example" "server\.env"
    echo ✅ Created server/.env from example
) else (
    echo ⚠️  server/.env already exists
)

echo.
echo [6/6] Seeding database with demo data...
cd server
call npm run seed
if %errorlevel% neq 0 (
    echo ⚠️  Database seeding failed (this is normal if MongoDB is not running)
)
cd ..

echo.
echo ========================================
echo           Setup Complete! 🎉
echo ========================================
echo.
echo To start the application:
echo   1. Start MongoDB (if using local instance)
echo   2. Run: npm run dev
echo.
echo The application will be available at:
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:5000
echo   - ML Service: http://localhost:8000
echo.
echo Demo credentials:
echo   Email: demo@example.com
echo   Password: demo123
echo.
pause
