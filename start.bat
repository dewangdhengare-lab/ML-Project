@echo off
echo ============================================
echo  AI-Based Human Activity Recognition Platform
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Download from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download from https://nodejs.org/
    pause
    exit /b 1
)

:: Setup backend
echo [1/4] Setting up Python virtual environment...
if not exist "backend\.venv" (
    python -m venv backend\.venv
)
call backend\.venv\Scripts\activate.bat

echo [2/4] Installing Python dependencies...
pip install -r backend\requirements.txt --quiet

:: Setup frontend
echo [3/4] Installing frontend dependencies...
cd frontend
call npm install --silent
cd ..

:: Start services
echo [4/4] Starting services...
echo.
echo  Backend:  http://localhost:8001
echo  Frontend: http://localhost:5173
echo  API Docs: http://localhost:8001/docs
echo.
echo Press Ctrl+C to stop all services.
echo.

:: Start backend in background
start "HAR Backend" cmd /c "call backend\.venv\Scripts\activate.bat && cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

:: Start frontend (foreground)
cd frontend
call npm run dev
