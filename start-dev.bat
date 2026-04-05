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

echo [INFO] Starting Version2 dev mode (Vite + Electron)...
call npm run electron-dev
if errorlevel 1 (
  echo [ERROR] Dev app exited with errors.
  pause
  exit /b 1
)

endlocal
