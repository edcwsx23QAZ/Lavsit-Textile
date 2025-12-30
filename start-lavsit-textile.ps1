# PowerShell скрипт для запуска lavsit-textile на порту 4001
# ВАЖНО: При перезагрузке сервера в рамках чата запускать ТОЛЬКО lavsit-textile!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Запуск lavsit-textile на порту 4001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Шаг 1: Останавливаем все процессы на порту 4001
Write-Host "Шаг 1: Останавливаем все процессы на порту 4001..." -ForegroundColor Yellow
$listening = netstat -ano | Select-String ":4001" | Select-String "LISTENING"
if ($listening) {
    foreach ($line in $listening) {
        $pid = ($line -split '\s+')[-1]
        if ($pid -match '^\d+$') {
            Write-Host "  Останавливаем процесс $pid" -ForegroundColor Gray
            taskkill /F /PID $pid 2>$null
        }
    }
}

# Шаг 2: Останавливаем все процессы Node.js из lavsit-russia-delivery
Write-Host ""
Write-Host "Шаг 2: Останавливаем все процессы Node.js..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    $proc = $_
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmd -like "*lavsit-russia-delivery*") {
            Write-Host "  Останавливаем процесс $($proc.Id) из lavsit-russia-delivery" -ForegroundColor Gray
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

Start-Sleep -Seconds 2

# Шаг 3: Переходим в директорию lavsit-textile
Write-Host ""
Write-Host "Шаг 3: Переходим в директорию lavsit-textile..." -ForegroundColor Yellow
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

if (-not (Test-Path "package.json")) {
    Write-Host "ОШИБКА: Не найдена директория lavsit-textile!" -ForegroundColor Red
    Write-Host "Текущая директория: $(Get-Location)" -ForegroundColor Red
    exit 1
}

Write-Host "  Директория: $(Get-Location)" -ForegroundColor Gray
Write-Host "  Найден package.json: ДА" -ForegroundColor Green

# Шаг 4: Запускаем сервер
Write-Host ""
Write-Host "Шаг 4: Запускаем lavsit-textile на порту 4001..." -ForegroundColor Yellow
Write-Host "  Команда: npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Сервер запускается..." -ForegroundColor Green
Write-Host "После запуска откройте: http://localhost:4001" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npm run dev


