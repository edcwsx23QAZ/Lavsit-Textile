# Останавливаем процессы на порту 4001
$port = 4001
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    Write-Host "Останавливаем процессы на порту $port..."
    foreach ($pid in $processes) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "Процесс $pid остановлен"
    }
    Start-Sleep -Seconds 2
}

# Переходим в директорию проекта
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "Текущая директория: $(Get-Location)"
Write-Host "Запуск сервера на порту 4001..."

# Запускаем сервер
npm run dev

