@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo Запуск lavsit-textile на порту 4001
echo ========================================
echo.
echo Текущая директория: %CD%
echo.

REM Останавливаем процессы на порту 4001
echo Останавливаем процессы на порту 4001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4001 ^| findstr LISTENING') do (
    echo   Останавливаем процесс %%a
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

REM Проверяем что мы в правильной директории
if not exist "package.json" (
    echo ОШИБКА: package.json не найден!
    echo Текущая директория: %CD%
    pause
    exit /b 1
)

REM Проверяем что это именно lavsit-textile
findstr /C:"lavsit-textile" package.json >nul
if errorlevel 1 (
    echo ОШИБКА: Это не lavsit-textile!
    pause
    exit /b 1
)

echo package.json найден - это lavsit-textile
echo.
echo Запускаем: npm run dev
echo.
echo ========================================
echo Сервер запускается на http://localhost:4001
echo ========================================
echo.

npm run dev

