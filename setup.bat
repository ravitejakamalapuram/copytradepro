@echo off
setlocal enabledelayedexpansion

REM CopyTrade Pro Setup Script for Windows
REM This script automates the complete setup process for the CopyTrade Pro application

echo.
echo ========================================
echo   CopyTrade Pro Setup Script
echo ========================================
echo.

REM Function to check if command exists
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 20.15.1 or higher.
    echo Visit: https://nodejs.org/en/download/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=%
echo [SUCCESS] Node.js version %NODE_VERSION% is installed

REM Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [SUCCESS] npm version %NPM_VERSION% is available
echo.

REM Check if we're in the right directory
if not exist "README.md" (
    echo [ERROR] Please run this script from the root directory of the CopyTrade Pro project
    pause
    exit /b 1
)
if not exist "backend" (
    echo [ERROR] Backend directory not found. Please run from project root.
    pause
    exit /b 1
)
if not exist "frontend" (
    echo [ERROR] Frontend directory not found. Please run from project root.
    pause
    exit /b 1
)

echo [SUCCESS] Project structure validated
echo.

REM Create backend directories
echo [INFO] Setting up backend environment...
if not exist "backend\data" mkdir "backend\data"
if not exist "backend\logs" mkdir "backend\logs"

REM Create backend .env file if it doesn't exist
if not exist "backend\.env" (
    echo # Backend Environment Configuration > "backend\.env"
    echo NODE_ENV=development >> "backend\.env"
    echo PORT=3001 >> "backend\.env"
    echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production >> "backend\.env"
    echo FRONTEND_URL=http://localhost:5173 >> "backend\.env"
    echo. >> "backend\.env"
    echo # Database Configuration >> "backend\.env"
    echo DB_PATH=./data/trading.db >> "backend\.env"
    echo. >> "backend\.env"
    echo # Security Configuration >> "backend\.env"
    echo BCRYPT_ROUNDS=12 >> "backend\.env"
    echo RATE_LIMIT_WINDOW_MS=900000 >> "backend\.env"
    echo RATE_LIMIT_MAX_REQUESTS=100 >> "backend\.env"
    echo. >> "backend\.env"
    echo # Logging Configuration >> "backend\.env"
    echo LOG_LEVEL=info >> "backend\.env"
    echo LOG_FILE=./logs/app.log >> "backend\.env"
    echo [SUCCESS] Created backend environment file
) else (
    echo [WARNING] Backend .env file already exists. Skipping...
)
echo.

REM Create frontend .env file if it doesn't exist
echo [INFO] Setting up frontend environment...
if not exist "frontend\.env" (
    echo # Frontend Environment Configuration > "frontend\.env"
    echo VITE_API_URL=http://localhost:3001 >> "frontend\.env"
    echo [SUCCESS] Created frontend environment file
) else (
    echo [WARNING] Frontend .env file already exists. Skipping...
)
echo.

REM Install backend dependencies
echo [INFO] Installing backend dependencies...
cd backend
if exist "package-lock.json" (
    del "package-lock.json"
    echo [INFO] Removed existing package-lock.json
)
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)
echo [SUCCESS] Backend dependencies installed successfully
cd ..
echo.

REM Install frontend dependencies
echo [INFO] Installing frontend dependencies...
cd frontend
if exist "package-lock.json" (
    del "package-lock.json"
    echo [INFO] Removed existing package-lock.json
)
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    cd ..
    pause
    exit /b 1
)
echo [SUCCESS] Frontend dependencies installed successfully
cd ..
echo.

REM Build backend
echo [INFO] Building backend...
cd backend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build backend
    cd ..
    pause
    exit /b 1
)
echo [SUCCESS] Backend built successfully
cd ..
echo.

REM Create startup scripts
echo [INFO] Creating startup scripts...

REM Create start-dev.bat script
echo @echo off > start-dev.bat
echo setlocal >> start-dev.bat
echo. >> start-dev.bat
echo echo [INFO] Starting CopyTrade Pro in development mode... >> start-dev.bat
echo. >> start-dev.bat
echo echo [INFO] Starting backend server... >> start-dev.bat
echo start "Backend Server" cmd /k "cd backend && npm run dev" >> start-dev.bat
echo. >> start-dev.bat
echo timeout /t 3 /nobreak ^>nul >> start-dev.bat
echo. >> start-dev.bat
echo echo [INFO] Starting frontend development server... >> start-dev.bat
echo start "Frontend Server" cmd /k "cd frontend && npm run dev" >> start-dev.bat
echo. >> start-dev.bat
echo echo [SUCCESS] Development servers started! >> start-dev.bat
echo echo Backend: http://localhost:3001 >> start-dev.bat
echo echo Frontend: http://localhost:5173 >> start-dev.bat
echo echo. >> start-dev.bat
echo echo Press any key to exit... >> start-dev.bat
echo pause >> start-dev.bat

echo [SUCCESS] Created start-dev.bat script

REM Create start-prod.bat script
echo @echo off > start-prod.bat
echo setlocal >> start-prod.bat
echo. >> start-prod.bat
echo echo [INFO] Starting CopyTrade Pro in production mode... >> start-prod.bat
echo. >> start-prod.bat
echo echo [INFO] Building frontend... >> start-prod.bat
echo cd frontend >> start-prod.bat
echo call npm run build >> start-prod.bat
echo cd .. >> start-prod.bat
echo. >> start-prod.bat
echo echo [INFO] Starting backend server... >> start-prod.bat
echo cd backend >> start-prod.bat
echo call npm start >> start-prod.bat

echo [SUCCESS] Created start-prod.bat script
echo.

REM Final success message
echo ========================================
echo   Setup completed successfully! 🎉
echo ========================================
echo.
echo Next steps:
echo   1. Review and update environment variables in backend\.env and frontend\.env
echo   2. Start development servers: start-dev.bat
echo   3. Open your browser to http://localhost:5173
echo.
echo For production deployment:
echo   1. Update environment variables for production
echo   2. Run: start-prod.bat
echo.
echo [WARNING] Important: Change the JWT_SECRET in backend\.env before deploying to production!
echo.
pause
