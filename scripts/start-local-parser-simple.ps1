# Упрощенный скрипт для запуска сервера и туннеля
# Использование: .\scripts\start-local-parser-simple.ps1

$ErrorActionPreference = "Stop"

Write-Host "Starting local parser server with tunnel..." -ForegroundColor Green

$port = if ($env:LOCAL_PARSER_PORT) { $env:LOCAL_PARSER_PORT } else { "4003" }
Write-Host "Port: $port" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Запускаем сервер в фоновом режиме (скрыто)
Write-Host "Starting local parser server in background..." -ForegroundColor Cyan
$serverProcess = Start-Process powershell -ArgumentList "-WindowStyle", "Hidden", "-Command", "cd '$projectRoot'; `$env:LOCAL_PARSER_PORT='$port'; npm run local-parser" -PassThru

Start-Sleep -Seconds 5

# Проверяем health
try {
    $health = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 5 -UseBasicParsing
    if ($health.StatusCode -eq 200) {
        Write-Host "Server is running on port $port" -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Could not verify server health, but server process is running" -ForegroundColor Yellow
}

# Запускаем localtunnel в фоновом режиме (скрыто)
Write-Host "Starting localtunnel in background..." -ForegroundColor Cyan

# Создаем временный файл для вывода localtunnel
$outputFile = Join-Path $env:TEMP "localtunnel-output-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$errorFile = Join-Path $env:TEMP "localtunnel-error-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

# Запускаем localtunnel в фоне
$tunnelProcess = Start-Process powershell -ArgumentList "-WindowStyle", "Hidden", "-Command", "cd '$projectRoot'; npx --yes localtunnel --port $port *> '$outputFile'" -PassThru

# Ждем запуска и пытаемся получить URL
Start-Sleep -Seconds 10

$tunnelUrl = $null
if (Test-Path $outputFile) {
    $output = Get-Content $outputFile -Raw -ErrorAction SilentlyContinue
    if ($output -match "https://[a-z0-9-]+\.loca\.lt") {
        $tunnelUrl = $matches[0]
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Server and tunnel are running in background" -ForegroundColor Green
Write-Host ""

if ($tunnelUrl) {
    Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Add to Vercel Dashboard -> Settings -> Environment Variables:" -ForegroundColor Yellow
    Write-Host "  Name: LOCAL_PARSER_URL" -ForegroundColor White
    Write-Host "  Value: $tunnelUrl" -ForegroundColor White
} else {
    Write-Host "Tunnel is starting. Checking output file for URL..." -ForegroundColor Yellow
    Write-Host "Output file: $outputFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can check the URL by running:" -ForegroundColor Cyan
    Write-Host "  Get-Content '$outputFile'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or wait a few seconds and check the file manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Server PID: $($serverProcess.Id)" -ForegroundColor Gray
Write-Host "Tunnel PID: $($tunnelProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop servers, use:" -ForegroundColor Cyan
Write-Host "  Stop-Process -Id $($serverProcess.Id) -Force" -ForegroundColor Gray
Write-Host "  Stop-Process -Id $($tunnelProcess.Id) -Force" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green

