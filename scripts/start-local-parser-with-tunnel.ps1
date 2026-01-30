# Скрипт для автозапуска локального сервера парсеров с туннелем
# Использование: .\scripts\start-local-parser-with-tunnel.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Запуск локального сервера парсеров с туннелем..." -ForegroundColor Green

# Получаем порт из переменной окружения или используем по умолчанию
$port = if ($env:LOCAL_PARSER_PORT) { $env:LOCAL_PARSER_PORT } else { "4003" }
Write-Host "📡 Порт сервера: $port" -ForegroundColor Cyan

# Переходим в директорию проекта
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Проверяем наличие node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules не найдены, запускаем npm install..." -ForegroundColor Yellow
    npm install
}

# Функция для проверки доступности ngrok
function Test-Ngrok {
    try {
        $ngrokVersion = ngrok version 2>&1
        return $true
    } catch {
        return $false
    }
}

# Функция для проверки доступности localtunnel
function Test-Localtunnel {
    try {
        $ltVersion = npx localtunnel --help 2>&1
        return $true
    } catch {
        return $false
    }
}

# Запускаем локальный сервер в фоне
Write-Host "🔧 Запуск локального сервера парсеров..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:projectRoot
    $env:LOCAL_PARSER_PORT = $using:port
    npm run local-parser
}

# Ждем немного, чтобы сервер запустился
Start-Sleep -Seconds 3

# Проверяем, что сервер запустился
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 5 -UseBasicParsing
    if ($healthCheck.StatusCode -eq 200) {
        Write-Host "✅ Локальный сервер успешно запущен на порту $port" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Не удалось проверить health сервера, но продолжаем..." -ForegroundColor Yellow
}

# Пытаемся запустить ngrok
$tunnelUrl = $null
if (Test-Ngrok) {
    Write-Host "🌐 Запуск ngrok туннеля..." -ForegroundColor Cyan
    
    # Запускаем ngrok в фоне
    $ngrokJob = Start-Job -ScriptBlock {
        Set-Location $using:projectRoot
        ngrok http $using:port --log=stdout
    }
    
    # Ждем запуска ngrok
    Start-Sleep -Seconds 5
    
    # Получаем URL из ngrok API
    try {
        $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
        if ($ngrokApi.tunnels -and $ngrokApi.tunnels.Count -gt 0) {
            $tunnelUrl = $ngrokApi.tunnels[0].public_url
            Write-Host "✅ Ngrok туннель создан: $tunnelUrl" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Не удалось получить URL из ngrok API, пробуем localtunnel..." -ForegroundColor Yellow
    }
}

# Если ngrok не сработал, пробуем localtunnel
if (-not $tunnelUrl) {
    Write-Host "🌐 Запуск localtunnel..." -ForegroundColor Cyan
    
    # Создаем временный файл для вывода localtunnel
    $outputFile = Join-Path $env:TEMP "localtunnel-output.txt"
    
    # Запускаем localtunnel и перенаправляем вывод в файл
    $ltProcess = Start-Process -FilePath "npx" `
        -ArgumentList "--yes", "localtunnel", "--port", $port `
        -WorkingDirectory $projectRoot `
        -RedirectStandardOutput $outputFile `
        -RedirectStandardError "$outputFile.err" `
        -NoNewWindow `
        -PassThru
    
    # Ждем запуска и читаем URL из файла
    Start-Sleep -Seconds 10
    
    if (Test-Path $outputFile) {
        $output = Get-Content $outputFile -Raw
        # Localtunnel выводит URL в формате "your url is: https://xxxx.loca.lt"
        if ($output -match "https://[a-z0-9-]+\.loca\.lt") {
            $tunnelUrl = $matches[0]
            Write-Host "✅ Localtunnel туннель создан: $tunnelUrl" -ForegroundColor Green
        }
    }
    
    if (-not $tunnelUrl) {
        Write-Host "⚠️  Не удалось автоматически получить URL localtunnel." -ForegroundColor Yellow
        Write-Host "   Проверьте вывод процесса или запустите вручную:" -ForegroundColor Yellow
        Write-Host "   npx localtunnel --port $port" -ForegroundColor Gray
    }
}

# Выводим информацию
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ Локальный сервер парсеров запущен!" -ForegroundColor Green
Write-Host ""
if ($tunnelUrl) {
    Write-Host "🌐 URL туннеля: $tunnelUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Добавьте в Vercel Dashboard → Settings → Environment Variables:" -ForegroundColor Yellow
    Write-Host "   Имя: LOCAL_PARSER_URL" -ForegroundColor White
    Write-Host "   Значение: $tunnelUrl" -ForegroundColor White
} else {
    Write-Host "⚠️  Не удалось автоматически получить URL туннеля." -ForegroundColor Yellow
    Write-Host "   Проверьте вывод jobs или настройте туннель вручную." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "🛑 Для остановки нажмите Ctrl+C" -ForegroundColor Red
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Ждем завершения (или Ctrl+C)
try {
    Wait-Job -Id $serverJob.Id -ErrorAction SilentlyContinue
} catch {
    # Игнорируем ошибки при прерывании
}

# Останавливаем jobs при выходе
Write-Host "🛑 Остановка серверов..." -ForegroundColor Yellow
Stop-Job -Id $serverJob.Id -ErrorAction SilentlyContinue
Remove-Job -Id $serverJob.Id -ErrorAction SilentlyContinue

if ($ngrokJob) {
    Stop-Job -Id $ngrokJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $ngrokJob.Id -ErrorAction SilentlyContinue
}

if ($ltJob) {
    Stop-Job -Id $ltJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $ltJob.Id -ErrorAction SilentlyContinue
}

Write-Host "✅ Серверы остановлены" -ForegroundColor Green

