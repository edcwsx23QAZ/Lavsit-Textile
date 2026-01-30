# Скрипт для настройки автозапуска локального сервера парсеров при загрузке Windows
# Требует прав администратора
# Использование: .\scripts\setup-autostart-local-parser.ps1

$ErrorActionPreference = "Stop"

Write-Host "Setting up autostart for local parser server..." -ForegroundColor Green

# Проверяем права администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script requires administrator rights!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

# Получаем пути
$projectRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $projectRoot "scripts\start-local-parser-simple.ps1"
$taskName = "LavsitTextileLocalParser"

# Проверяем существование скрипта
if (-not (Test-Path $scriptPath)) {
    Write-Host "[ERROR] Script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

# Удаляем существующую задачу, если есть
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..." -ForegroundColor Yellow
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
    $result = Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Autostart local parser server Lavsit Textile with tunnel" `
        -ErrorAction Stop
    
    Write-Host "[SUCCESS] Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Information:" -ForegroundColor Cyan
    Write-Host "  Name: $taskName" -ForegroundColor White
    Write-Host "  State: $($result.State)" -ForegroundColor White
    Write-Host "  Trigger: At user logon" -ForegroundColor White
    Write-Host "  Script: $scriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "To check the task, use:" -ForegroundColor Yellow
    Write-Host "  npm run local-parser:check" -ForegroundColor Gray
    Write-Host "  or" -ForegroundColor Gray
    Write-Host "  Get-ScheduledTask -TaskName $taskName" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To remove the task, use:" -ForegroundColor Yellow
    Write-Host "  Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to create task: $_" -ForegroundColor Red
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

