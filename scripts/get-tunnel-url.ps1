# Скрипт для получения URL туннеля
# Использование: .\scripts\get-tunnel-url.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔍 Поиск активного туннеля..." -ForegroundColor Cyan

# Получаем порт
$port = if ($env:LOCAL_PARSER_PORT) { $env:LOCAL_PARSER_PORT } else { "4003" }

# Пытаемся получить URL из ngrok
try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
    if ($ngrokApi.tunnels -and $ngrokApi.tunnels.Count -gt 0) {
        $tunnelUrl = $ngrokApi.tunnels | Where-Object { $_.config.addr -eq "http://localhost:$port" } | Select-Object -First 1
        if ($tunnelUrl) {
            $publicUrl = $tunnelUrl.public_url
            Write-Host "✅ Найден ngrok туннель: $publicUrl" -ForegroundColor Green
            Write-Host ""
            Write-Host "📋 Добавьте в Vercel Dashboard → Settings → Environment Variables:" -ForegroundColor Yellow
            Write-Host "   Имя: LOCAL_PARSER_URL" -ForegroundColor White
            Write-Host "   Значение: $publicUrl" -ForegroundColor White
            exit 0
        }
    }
} catch {
    # Ngrok не запущен или недоступен
}

# Если ngrok не найден, проверяем localtunnel
Write-Host "⚠️  Ngrok не найден. Проверьте, что туннель запущен." -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Для запуска туннеля используйте:" -ForegroundColor Cyan
Write-Host "   .\scripts\start-local-parser-with-tunnel.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "   или вручную:" -ForegroundColor Cyan
Write-Host "   ngrok http $port" -ForegroundColor Gray
Write-Host "   npx localtunnel --port $port" -ForegroundColor Gray

