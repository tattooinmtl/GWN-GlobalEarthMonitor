@echo off
REM Force stop all Node.js (npm) server processes

echo Stopping all Node.js (npm) servers...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL%==0 (
    echo All Node.js servers have been forcefully stopped.
) else (
    echo No running Node.js servers found or an error occurred.
)
pause
