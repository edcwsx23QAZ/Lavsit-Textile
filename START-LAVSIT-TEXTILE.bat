@echo off
REM Скрипт для запуска lavsit-textile на порту 4001
REM Используется для перезапуска сервера в рамках чата
REM ВАЖНО: При перезагрузке сервера в рамках чата запускать ТОЛЬКО lavsit-textile!

echo ========================================
echo Запуск lavsit-textile на порту 4001
echo ========================================

echo.
echo Шаг 1: Останавливаем все процессы на порту 4001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4001 ^| findstr LISTENING') do (
    echo   Останавливаем процесс %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Шаг 2: Останавливаем все процессы Node.js из lavsit-russia-delivery...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *lavsit-russia-delivery*" >nul 2>&1

timeout /t 3 /nobreak >nul

echo.
echo Шаг 3: Переходим в директорию lavsit-textile...
cd /d "%~dp0"
if not exist "package.json" (
    echo ОШИБКА: Не найдена директория lavsit-textile!
    echo Текущая директория: %CD%
    pause
    exit /b 1
)

echo   Директория: %CD%
echo   Найден package.json: ДА

echo.
echo Шаг 4: Запускаем lavsit-textile на порту 4001...
echo   Команда: npm run dev
echo.
echo ========================================
echo Сервер запускается...
echo После запуска откройте: http://localhost:4001
echo ========================================
echo.

npm run dev
