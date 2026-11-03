@echo off
cd /d "%~dp0\.."
echo ========================================================
echo  Starting Autonomous Job Application Cycle
echo ========================================================
node src/scheduler.js --now
pause
