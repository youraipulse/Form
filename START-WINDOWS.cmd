@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22.12 or newer from https://nodejs.org/
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
echo Open http://127.0.0.1:4180/ in your browser.
call npm run dev
pause
