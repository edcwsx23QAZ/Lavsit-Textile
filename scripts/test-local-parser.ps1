# Скрипт для тестирования локального парсера
# Использование: .\scripts\test-local-parser.ps1

$ErrorActionPreference = "Stop"

Write-Host "Testing local parser server..." -ForegroundColor Cyan
Write-Host ""

# Проверяем, запущен ли сервер
$port = if ($env:LOCAL_PARSER_PORT) { $env:LOCAL_PARSER_PORT } else { "4003" }

Write-Host "1. Checking if server is running on port $port..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   [OK] Server is running" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
    Write-Host "   Supported parsers: $($health.parsers -join ', ')" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Server is not running or not accessible" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   To start the server, run:" -ForegroundColor Yellow
    Write-Host "   npm run local-parser" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "2. Testing TextileNova parser..." -ForegroundColor Yellow

# Тестовый запрос для TextileNova
$testUrl = "https://textilenova.ru"  # Замените на реальный URL
$testData = @{
    parserName = "TextileNovaParser"
    supplierId = "test-id"
    supplierName = "TextileNova"
    url = $testUrl
    rules = @{
        columnMappings = @{
            collection = 0
            color = 0
        }
        skipRows = @()
        skipPatterns = @()
        specialRules = @{}
    }
} | ConvertTo-Json -Depth 10

try {
    Write-Host "   Sending test request..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:$port/parse" `
        -Method POST `
        -Body $testData `
        -ContentType "application/json" `
        -TimeoutSec 30 `
        -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "   [OK] Parser responded successfully" -ForegroundColor Green
        Write-Host "   Found fabrics: $($response.count)" -ForegroundColor Gray
    } else {
        Write-Host "   [ERROR] Parser returned error: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "   [ERROR] Failed to test parser" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "3. Checking environment variable..." -ForegroundColor Yellow
$localParserUrl = $env:LOCAL_PARSER_URL
if ($localParserUrl) {
    Write-Host "   [OK] LOCAL_PARSER_URL is set: $localParserUrl" -ForegroundColor Green
    
    # Проверяем доступность URL
    try {
        $healthCheck = Invoke-RestMethod -Uri "$localParserUrl/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   [OK] URL is accessible" -ForegroundColor Green
    } catch {
        Write-Host "   [WARNING] URL is not accessible from this machine" -ForegroundColor Yellow
        Write-Host "   This is normal if URL is a tunnel (ngrok/localtunnel)" -ForegroundColor Gray
    }
} else {
    Write-Host "   [WARNING] LOCAL_PARSER_URL is not set" -ForegroundColor Yellow
    Write-Host "   This variable should be set in Vercel Dashboard" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Green

