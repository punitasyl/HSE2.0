@echo off
echo Stopping any process on port 8001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
cd /d %~dp0\backend
echo Starting HSE Analytics backend on port 8001...
py -m uvicorn main:app --port 8001 --reload
pause
