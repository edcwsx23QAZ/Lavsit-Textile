@echo off
chcp 65001 >nul 2>&1
REM Script for setting up autostart of local parser server
REM Requires administrator rights
REM Usage: Run as Administrator

echo ========================================
echo Setting up autostart for local parser server
echo ========================================
echo.

REM Check for administrator rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires administrator rights!
    echo Please run the file as Administrator (right-click - Run as administrator)
    echo.
    pause
    exit /b 1
)

echo [OK] Administrator rights confirmed
echo.

REM Get project path
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

echo [INFO] Project directory: %PROJECT_ROOT%
echo.

REM Run PowerShell script for setup
echo [INFO] Running PowerShell setup script...
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-autostart-local-parser.ps1"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Failed to setup autostart
    echo Please check the error messages above
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Autostart configured!
echo ========================================
echo.
echo The task will automatically start on system login.
echo.
echo To check the task, use:
echo   npm run local-parser:check
echo.
echo To remove the task, use:
echo   Unregister-ScheduledTask -TaskName "LavsitTextileLocalParser" -Confirm:$false
echo.
echo Press any key to close this window...
pause >nul
