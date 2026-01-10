# PowerShell скрипт для запуска автоматического коммита как фоновой службы
# Этот скрипт запускает автоматический коммит в фоне и работает автономно

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Stop
)

$ServiceName = "LavsitTextile-AutoCommit"
$ProjectRoot = "E:\Work programs\cursor\repositary\lavsit-textile"
$ScriptPath = Join-Path $ProjectRoot "scripts\auto-commit-and-push.ts"
$LogPath = Join-Path $ProjectRoot "auto-commit.log"
$PidFile = Join-Path $ProjectRoot ".auto-commit.pid"

function Test-IsAdmin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-AutoCommitService {
    Write-Host "🚀 Запуск автоматического коммита..." -ForegroundColor Cyan
    
    # Проверяем, не запущен ли уже процесс
    if (Test-Path $PidFile) {
        $oldPid = Get-Content $PidFile
        $process = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq "node") {
            Write-Host "⚠️  Процесс уже запущен (PID: $oldPid)" -ForegroundColor Yellow
            Write-Host "💡 Используйте -Stop для остановки" -ForegroundColor Gray
            return
        }
    }
    
    # Переходим в директорию проекта
    Set-Location $ProjectRoot
    
    # Проверяем, что npm установлен
    try {
        $null = Get-Command npm -ErrorAction Stop
    } catch {
        Write-Host "❌ npm не найден. Установите Node.js" -ForegroundColor Red
        exit 1
    }
    
    # Запускаем процесс в фоне
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "node"
    $processInfo.Arguments = "node_modules\.bin\tsx $ScriptPath"
    $processInfo.WorkingDirectory = $ProjectRoot
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    # Настройка вывода в файл
    $processInfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $processInfo.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    
    # Перенаправление вывода в лог-файл
    $process.add_OutputDataReceived({
        param($sender, $e)
        if ($e.Data) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            "$timestamp | $($e.Data)" | Add-Content $LogPath
        }
    })
    
    $process.add_ErrorDataReceived({
        param($sender, $e)
        if ($e.Data) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            "$timestamp | ERROR: $($e.Data)" | Add-Content $LogPath
        }
    })
    
    try {
        $process.Start() | Out-Null
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        # Сохраняем PID
        $process.Id | Out-File $PidFile -Encoding UTF8
        
        Write-Host "✅ Автоматический коммит запущен!" -ForegroundColor Green
        Write-Host "   PID: $($process.Id)" -ForegroundColor Gray
        Write-Host "   Лог: $LogPath" -ForegroundColor Gray
        Write-Host "   Процесс работает в фоне" -ForegroundColor Gray
        Write-Host ""
        Write-Host "💡 Для просмотра логов: Get-Content $LogPath -Tail 50 -Wait" -ForegroundColor Cyan
        Write-Host "💡 Для остановки: .\scripts\start-auto-commit-service.ps1 -Stop" -ForegroundColor Cyan
        
        # Не ждем завершения процесса
        return $process
    } catch {
        Write-Host "❌ Ошибка при запуске: $_" -ForegroundColor Red
        exit 1
    }
}

function Stop-AutoCommitService {
    Write-Host "🛑 Остановка автоматического коммита..." -ForegroundColor Cyan
    
    if (-not (Test-Path $PidFile)) {
        Write-Host "ℹ️  Процесс не запущен" -ForegroundColor Yellow
        return
    }
    
    $pid = Get-Content $PidFile
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    
    if ($process) {
        try {
            $process.Kill()
            Write-Host "✅ Процесс остановлен (PID: $pid)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Не удалось остановить процесс: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  Процесс с PID $pid не найден" -ForegroundColor Yellow
    }
    
    # Удаляем PID файл
    if (Test-Path $PidFile) {
        Remove-Item $PidFile
    }
}

function Get-AutoCommitStatus {
    Write-Host "📊 Статус автоматического коммита:" -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-Path $PidFile) {
        $pid = Get-Content $PidFile
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        
        if ($process) {
            Write-Host "✅ Статус: Запущен" -ForegroundColor Green
            Write-Host "   PID: $pid" -ForegroundColor Gray
            Write-Host "   Время работы: $($process.StartTime)" -ForegroundColor Gray
            
            if (Test-Path $LogPath) {
                $logSize = (Get-Item $LogPath).Length / 1KB
                Write-Host "   Размер лога: $([math]::Round($logSize, 2)) KB" -ForegroundColor Gray
                
                Write-Host ""
                Write-Host "📝 Последние 5 строк лога:" -ForegroundColor Cyan
                Get-Content $LogPath -Tail 5 | ForEach-Object {
                    Write-Host "   $_" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "❌ Статус: PID файл существует, но процесс не найден" -ForegroundColor Red
            Write-Host "   Очистка PID файла..." -ForegroundColor Yellow
            Remove-Item $PidFile
        }
    } else {
        Write-Host "❌ Статус: Не запущен" -ForegroundColor Red
    }
    
    # Проверяем Git hook
    $hookPath = Join-Path $ProjectRoot ".git\hooks\post-commit"
    if (Test-Path $hookPath) {
        Write-Host ""
        Write-Host "✅ Git hook настроен: $hookPath" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Git hook не настроен" -ForegroundColor Yellow
        Write-Host "   Запустите: npm run setup:auto-commit" -ForegroundColor Gray
    }
}

# Обработка параметров
if ($Stop) {
    Stop-AutoCommitService
} elseif ($Status) {
    Get-AutoCommitStatus
} elseif ($Uninstall) {
    Stop-AutoCommitService
    Write-Host "🗑️  Сервис удален" -ForegroundColor Green
} else {
    # По умолчанию запускаем
    Start-AutoCommitService
    
    # Выводим подсказку о том, как запустить в автозагрузке
    Write-Host ""
    Write-Host "💡 Для запуска при старте Windows:" -ForegroundColor Cyan
    Write-Host "   1. Откройте планировщик заданий (taskschd.msc)" -ForegroundColor Gray
    Write-Host "   2. Создайте новое задание" -ForegroundColor Gray
    Write-Host "   3. Триггер: При входе пользователя" -ForegroundColor Gray
    Write-Host "   4. Действие: Запустить программу" -ForegroundColor Gray
    Write-Host "   5. Программа: powershell.exe" -ForegroundColor Gray
    Write-Host "   6. Аргументы: -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`"" -ForegroundColor Gray
}

