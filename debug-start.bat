@echo off
chcp 65001 >nul
echo ========================================
echo Отладка запуска lavsit-textile
echo ========================================
echo.

cd /d "%~dp0"
echo Текущая директория: %CD%
echo.

if not exist "package.json" (
    echo ОШИБКА: package.json не найден!
    pause
    exit /b 1
)

echo Проверка package.json...
type package.json | findstr "lavsit-textile"
echo.

echo Проверка node_modules...
if exist "node_modules" (
    echo node_modules найден
) else (
    echo ОШИБКА: node_modules не найден! Нужно выполнить: npm install
    pause
    exit /b 1
)

echo.
echo Останавливаем процессы на порту 4001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4001 ^| findstr LISTENING') do (
    echo   Останавливаем процесс %%a
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo.
echo Запускаем сервер...
echo Команда: npm run dev
echo.
npm run dev
pause


