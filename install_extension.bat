@echo off
setlocal
echo ========================================================
echo  JobCopilot AI - Extension One-Click Quick Installer
echo ========================================================
echo.

set "EXT_DIR=%~dp0extension"

echo [1/2] Locating Extension folder:
echo       %EXT_DIR%
echo.

echo [2/2] Opening Chrome Extensions page...
start chrome.exe "chrome://extensions" 2>nul
if %errorlevel% neq 0 (
    echo Opening Microsoft Edge Extensions page instead...
    start msedge.exe "edge://extensions" 2>nul
)

echo.
echo ========================================================
echo  NEXT STEPS (Takes 10 Seconds):
echo  1. In the browser tab that just opened, turn ON "Developer mode" (top right).
echo  2. Click "Load unpacked" (top left).
echo  3. Select the folder below:
echo.
echo     %EXT_DIR%
echo ========================================================
echo.
pause
