# Скрипт для настройки автозапуска локального сервера парсеров при загрузке Windows
# Требует прав администратора
# Использование: .\scripts\setup-autostart-local-parser.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Настройка автозапуска локального сервера парсеров..." -ForegroundColor Green

# Проверяем права администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Этот скрипт требует прав администратора!" -ForegroundColor Red
    Write-Host "   Запустите PowerShell от имени администратора" -ForegroundColor Yellow
    exit 1
}

# Получаем пути
$projectRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $projectRoot "scripts\start-local-parser-simple.ps1"
$taskName = "LavsitTextileLocalParser"

# Проверяем существование скрипта
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Скрипт не найден: $scriptPath" -ForegroundColor Red
    exit 1
}

# Удаляем существующую задачу, если есть
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "🗑️  Удаление существующей задачи..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Создаем действие для запуска PowerShell скрипта в скрытом режиме
# WorkingDirectory задаем через cd в аргументах
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"Set-Location '$projectRoot'; & '$scriptPath'`""

# Создаем триггер для запуска при входе пользователя
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Настраиваем параметры задачи
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Создаем принципал (запуск от текущего пользователя)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Регистрируем задачу
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Автозапуск локального сервера парсеров Lavsit Textile с туннелем" | Out-Null
    
    Write-Host "✅ Задача планировщика создана успешно!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Информация о задаче:" -ForegroundColor Cyan
    Write-Host "   Имя: $taskName" -ForegroundColor White
    Write-Host "   Запуск: При входе пользователя в систему" -ForegroundColor White
    Write-Host "   Скрипт: $scriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Для проверки задачи используйте:" -ForegroundColor Yellow
    Write-Host "   Get-ScheduledTask -TaskName $taskName" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Для удаления задачи используйте:" -ForegroundColor Yellow
    Write-Host "   Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false" -ForegroundColor Gray
} catch {
    Write-Host "❌ Ошибка при создании задачи: $_" -ForegroundColor Red
    exit 1
}

