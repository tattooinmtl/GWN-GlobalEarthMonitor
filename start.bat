@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Install Node.js and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Building renderer...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo [INFO] Starting Electron app...
call npm start
if errorlevel 1 (
  echo [ERROR] App exited with errors.
  pause
  exit /b 1
)

endlocal
