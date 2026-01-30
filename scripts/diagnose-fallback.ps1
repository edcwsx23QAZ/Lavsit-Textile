# Диагностический скрипт для проверки настроек fallback механизма
# Использование: .\scripts\diagnose-fallback.ps1

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fallback Mechanism Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Проверка локального сервера
Write-Host "1. Checking local parser server..." -ForegroundColor Yellow
$port = if ($env:LOCAL_PARSER_PORT) { $env:LOCAL_PARSER_PORT } else { "4003" }

try {
    $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   [OK] Server is running on port $port" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
    Write-Host "   Supported parsers: $($health.parsers.Count)" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Server is NOT running" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   SOLUTION: Start the server with:" -ForegroundColor Yellow
    Write-Host "   npm run local-parser" -ForegroundColor White
    Write-Host ""
}

# 2. Проверка туннеля
Write-Host ""
Write-Host "2. Checking tunnel..." -ForegroundColor Yellow

# Проверяем ngrok
try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
    if ($ngrokApi.tunnels -and $ngrokApi.tunnels.Count -gt 0) {
        $tunnel = $ngrokApi.tunnels[0]
        Write-Host "   [OK] Ngrok tunnel is active" -ForegroundColor Green
        Write-Host "   URL: $($tunnel.public_url)" -ForegroundColor Gray
        Write-Host "   Local: $($tunnel.config.addr)" -ForegroundColor Gray
    } else {
        Write-Host "   [WARNING] Ngrok is running but no tunnels found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [INFO] Ngrok is not running" -ForegroundColor Gray
}

# Проверяем localtunnel процессы
$ltProcesses = Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*localtunnel*" }
if ($ltProcesses) {
    Write-Host "   [INFO] Localtunnel process found" -ForegroundColor Gray
    Write-Host "   Check localtunnel window for URL" -ForegroundColor Gray
} else {
    Write-Host "   [WARNING] Localtunnel is not running" -ForegroundColor Yellow
    Write-Host "   SOLUTION: Start tunnel with:" -ForegroundColor Yellow
    Write-Host "   npm run local-parser:start" -ForegroundColor White
}

# 3. Проверка переменных окружения
Write-Host ""
Write-Host "3. Checking environment variables..." -ForegroundColor Yellow

$localParserUrl = $env:LOCAL_PARSER_URL
if ($localParserUrl) {
    Write-Host "   [OK] LOCAL_PARSER_URL is set locally: $localParserUrl" -ForegroundColor Green
    
    # Пытаемся проверить доступность
    try {
        $healthCheck = Invoke-RestMethod -Uri "$localParserUrl/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   [OK] URL is accessible from this machine" -ForegroundColor Green
    } catch {
        Write-Host "   [WARNING] URL is not accessible from this machine" -ForegroundColor Yellow
        Write-Host "   This is normal if URL is a tunnel (ngrok/localtunnel)" -ForegroundColor Gray
        Write-Host "   The URL should be accessible from Vercel servers" -ForegroundColor Gray
    }
} else {
    Write-Host "   [WARNING] LOCAL_PARSER_URL is NOT set locally" -ForegroundColor Yellow
    Write-Host "   This is OK - it should be set in Vercel Dashboard" -ForegroundColor Gray
}

Write-Host ""
Write-Host "   IMPORTANT: Check Vercel Dashboard:" -ForegroundColor Cyan
Write-Host "   1. Go to: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "   2. Select project: lavsit-textile" -ForegroundColor White
Write-Host "   3. Go to: Settings -> Environment Variables" -ForegroundColor White
Write-Host "   4. Check if LOCAL_PARSER_URL is set" -ForegroundColor White
Write-Host "   5. Value should be your tunnel URL (e.g., https://xxxx.loca.lt)" -ForegroundColor White

# 4. Проверка логики fallback
Write-Host ""
Write-Host "4. Checking fallback logic..." -ForegroundColor Yellow
Write-Host "   [INFO] Fallback logic is implemented in:" -ForegroundColor Gray
Write-Host "   - lib/parsers/base-parser.ts (withFallback method)" -ForegroundColor Gray
Write-Host "   - All parsers use withFallback for parse() and analyze() methods" -ForegroundColor Gray
Write-Host ""
Write-Host "   How it works:" -ForegroundColor Cyan
Write-Host "   1. Tries to parse on Vercel first" -ForegroundColor White
Write-Host "   2. If error occurs, checks LOCAL_PARSER_URL" -ForegroundColor White
Write-Host "   3. If LOCAL_PARSER_URL is set, tries local parser" -ForegroundColor White
Write-Host "   4. If local parser also fails, returns original Vercel error" -ForegroundColor White

# 5. Рекомендации
Write-Host ""
Write-Host "5. Recommendations:" -ForegroundColor Yellow

$issues = @()

if (-not (Test-Path "http://localhost:$port/health" -ErrorAction SilentlyContinue)) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 1 -ErrorAction Stop
    } catch {
        $issues += "Local server is not running"
    }
}

if (-not $localParserUrl) {
    $issues += "LOCAL_PARSER_URL is not set (should be set in Vercel)"
}

if ($issues.Count -eq 0) {
    Write-Host "   [OK] No obvious issues found" -ForegroundColor Green
    Write-Host "   Make sure LOCAL_PARSER_URL is set in Vercel Dashboard" -ForegroundColor Gray
} else {
    Write-Host "   [WARNING] Found issues:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "   - $issue" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostics completed!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

