@echo off
chcp 65001 >nul
echo ========================================
echo Запуск lavsit-textile на порту 4001
echo ========================================
echo.

echo Останавливаем процессы на порту 4001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4001 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

cd /d "%~dp0"
echo Текущая директория: %CD%
echo.

if not exist "package.json" (
    echo ОШИБКА: package.json не найден!
    pause
    exit /b 1
)

echo Запускаем сервер...
npm run dev


