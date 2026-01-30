# Скрипт для полного перезапуска dev сервера

Write-Host "=== Перезапуск Dev сервера ===" -ForegroundColor Cyan
Write-Host ""

# Останавливаем все процессы Node.js на порту 4002
Write-Host "1. Остановка процессов на порту 4002..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 4002 -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pid in $processes) {
    if ($pid -gt 0) {
        Write-Host "   Остановка процесса $pid..." -ForegroundColor Gray
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 3

# Проверяем, что порт свободен
$stillRunning = Get-NetTCPConnection -LocalPort 4002 -ErrorAction SilentlyContinue
if ($stillRunning) {
    Write-Host "   ⚠️  Некоторые процессы все еще работают" -ForegroundColor Yellow
} else {
    Write-Host "   ✓ Порт 4002 свободен" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. Запуск dev сервера..." -ForegroundColor Yellow

# Запускаем dev сервер в фоне
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Split-Path -Parent $scriptPath

Set-Location $projectPath
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath'; npm run dev" -WindowStyle Minimized

Write-Host "   ✓ Dev сервер запущен в новом окне" -ForegroundColor Green
Write-Host ""
Write-Host "3. Ожидание запуска сервера (10 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Проверяем доступность
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4002" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✓ Сервер доступен (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Сервер еще запускается..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Готово ===" -ForegroundColor Cyan
Write-Host "Сервер должен быть доступен на http://localhost:4002" -ForegroundColor Gray

