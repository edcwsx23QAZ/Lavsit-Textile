@echo off
REM Скрипт для настройки автозапуска локального сервера парсеров
REM Требует прав администратора
REM Использование: Запустите от имени администратора

echo ========================================
echo Настройка автозапуска локального сервера парсеров
echo ========================================
echo.

REM Проверяем права администратора
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ОШИБКА] Этот скрипт требует прав администратора!
    echo Запустите файл от имени администратора (правой кнопкой - Запуск от имени администратора)
    pause
    exit /b 1
)

echo [OK] Права администратора подтверждены
echo.

REM Получаем путь к проекту
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

echo [INFO] Директория проекта: %PROJECT_ROOT%
echo.

REM Запускаем PowerShell скрипт для настройки
echo [INFO] Запуск PowerShell скрипта настройки...
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-autostart-local-parser.ps1"

if %errorLevel% neq 0 (
    echo [ОШИБКА] Не удалось настроить автозапуск
    pause
    exit /b 1
)

echo.
echo ========================================
echo [УСПЕХ] Автозапуск настроен!
echo ========================================
echo.
echo Задача будет автоматически запускаться при входе в систему.
echo.
echo Для проверки задачи используйте:
echo   Get-ScheduledTask -TaskName "LavsitTextileLocalParser"
echo.
echo Для удаления задачи используйте:
echo   Unregister-ScheduledTask -TaskName "LavsitTextileLocalParser" -Confirm:$false
echo.
pause

