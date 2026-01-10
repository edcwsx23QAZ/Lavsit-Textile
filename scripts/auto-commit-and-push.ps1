# PowerShell скрипт для автоматического коммита и push изменений
# Отслеживает изменения в файлах и автоматически коммитит их на GitHub

param(
    [int]$CommitDelay = 10,  # Задержка в секундах перед коммитом
    [switch]$DryRun = $false # Режим проверки без реального коммита
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Игнорируемые паттерны
$IgnorePatterns = @(
    "node_modules",
    "\.next",
    "\.git",
    "\.vercel",
    "dist",
    "build",
    "coverage",
    "\.env",
    "\.DS_Store",
    "Thumbs\.db",
    "\.log$",
    "\.tsbuildinfo$",
    "\.swp$",
    "\.swo$",
    "\~$",
    "\.revisions"
)

$ChangedFiles = New-Object System.Collections.Generic.HashSet[string]
$CommitTimer = $null
$IsCommitting = $false

function Test-IgnorePattern {
    param([string]$FilePath)
    
    $RelativePath = $FilePath.Replace((Get-Location).Path, "").TrimStart("\")
    
    foreach ($pattern in $IgnorePatterns) {
        if ($RelativePath -match $pattern) {
            return $true
        }
    }
    
    return $false
}

function Save-Revision {
    param([string]$CommitHash)
    
    try {
        $RevisionsDir = Join-Path (Get-Location).Path ".revisions"
        
        if (-not (Test-Path $RevisionsDir)) {
            New-Item -ItemType Directory -Path $RevisionsDir -Force | Out-Null
        }
        
        # Создаем git bundle для текущей ревизии
        $BundlePath = Join-Path $RevisionsDir "revision-$($CommitHash.Substring(0, 7))-$(Get-Date -Format 'yyyyMMdd-HHmmss').bundle"
        
        $GitBundleCommand = "git bundle create `"$BundlePath`" HEAD"
        Invoke-Expression $GitBundleCommand | Out-Null
        
        Write-Host "   📦 Ревизия сохранена: $($BundlePath | Split-Path -Leaf)" -ForegroundColor Gray
        
        # Очистка старых ревизий (оставляем только последние 50)
        $AllBundles = Get-ChildItem -Path $RevisionsDir -Filter "*.bundle" | Sort-Object LastWriteTime -Descending
        
        if ($AllBundles.Count -gt 50) {
            $ToDelete = $AllBundles | Select-Object -Skip 50
            foreach ($Bundle in $ToDelete) {
                Remove-Item $Bundle.FullName -Force
                Write-Host "   🗑️  Удалена старая ревизия: $($Bundle.Name)" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "   ⚠️  Не удалось сохранить ревизию: $_" -ForegroundColor Yellow
    }
}

function Commit-AndPush {
    if ($IsCommitting) {
        Write-Host "⏸️  Коммит уже выполняется, пропускаем..." -ForegroundColor Yellow
        return
    }
    
    $IsCommitting = $true
    
    try {
        # Проверяем статус
        $StatusOutput = git status --porcelain 2>&1
        
        if (-not $StatusOutput -or $StatusOutput -match "fatal") {
            Write-Host "ℹ️  Нет изменений для коммита" -ForegroundColor Gray
            $ChangedFiles.Clear()
            return
        }
        
        # Фильтруем изменения (игнорируем системные файлы)
        $RelevantChanges = $StatusOutput | Where-Object {
            $File = ($_ -split '\s+')[-1]
            -not (Test-IgnorePattern $File)
        }
        
        if (-not $RelevantChanges) {
            Write-Host "ℹ️  Нет релевантных изменений для коммита" -ForegroundColor Gray
            $ChangedFiles.Clear()
            return
        }
        
        Write-Host "`n📝 Обнаружены изменения, подготовка коммита..." -ForegroundColor Cyan
        
        if ($DryRun) {
            Write-Host "🔍 DRY RUN режим - изменения не будут сохранены" -ForegroundColor Yellow
            Write-Host "   Измененные файлы:" -ForegroundColor Gray
            $RelevantChanges | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
            $ChangedFiles.Clear()
            return
        }
        
        # Добавляем все изменения
        Write-Host "📦 Добавление изменений в staging..." -ForegroundColor Cyan
        git add -A 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            throw "Ошибка при добавлении файлов"
        }
        
        # Создаем коммит с временной меткой
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $CommitMessage = "Auto-commit: $Timestamp`n`nАвтоматический коммит изменений"
        
        Write-Host "💾 Создание коммита..." -ForegroundColor Cyan
        git commit -m $CommitMessage 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            # Возможно, нет изменений для коммита
            Write-Host "ℹ️  Нет изменений для коммита" -ForegroundColor Gray
            $ChangedFiles.Clear()
            return
        }
        
        # Получаем hash коммита
        $CommitHash = (git rev-parse HEAD).Trim()
        
        Write-Host "✅ Коммит создан: $($CommitHash.Substring(0, 7))" -ForegroundColor Green
        
        # Сохраняем ревизию локально
        Save-Revision -CommitHash $CommitHash
        
        # Отправляем на GitHub
        $CurrentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
        Write-Host "🚀 Отправка на GitHub (branch: $CurrentBranch)..." -ForegroundColor Cyan
        
        git push origin $CurrentBranch 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Изменения успешно отправлены на GitHub!" -ForegroundColor Green
            Write-Host "🔗 Branch: $CurrentBranch" -ForegroundColor Gray
            Write-Host "🔗 Commit: $($CommitHash.Substring(0, 7))`n" -ForegroundColor Gray
        } else {
            throw "Ошибка при отправке на GitHub"
        }
        
        $ChangedFiles.Clear()
        
    } catch {
        Write-Host "❌ Ошибка при коммите/push: $_" -ForegroundColor Red
        Write-Host "💡 Продолжаю отслеживание изменений...`n" -ForegroundColor Yellow
    } finally {
        $IsCommitting = $false
    }
}

function Start-FileWatcher {
    Write-Host "👀 Запуск режима отслеживания изменений..." -ForegroundColor Cyan
    Write-Host "📁 Отслеживается директория: $(Get-Location)" -ForegroundColor Gray
    Write-Host "⏱️  Задержка перед коммитом: $CommitDelay секунд`n" -ForegroundColor Gray
    
    if ($DryRun) {
        Write-Host "🔍 DRY RUN режим активен - изменения не будут сохранены`n" -ForegroundColor Yellow
    }
    
    # Используем FileSystemWatcher для отслеживания изменений
    $Watcher = New-Object System.IO.FileSystemWatcher
    $Watcher.Path = Get-Location
    $Watcher.IncludeSubdirectories = $true
    $Watcher.EnableRaisingEvents = $true
    
    # Обработчик изменений
    $Action = {
        $Path = $Event.SourceEventArgs.FullPath
        $ChangeType = $Event.SourceEventArgs.ChangeType
        
        if (Test-IgnorePattern $Path) {
            return
        }
        
        # Игнорируем изменения в .git
        if ($Path -match "\.git[\\\/]") {
            return
        }
        
        Write-Host "📝 Изменение: $($Path | Split-Path -Leaf) ($ChangeType)" -ForegroundColor Gray
        
        [void]$ChangedFiles.Add($Path)
        
        # Отменяем предыдущий таймер
        if ($script:CommitTimer) {
            $script:CommitTimer.Dispose()
        }
        
        # Устанавливаем новый таймер
        $script:CommitTimer = [System.Timers.Timer]::new($CommitDelay * 1000)
        $script:CommitTimer.AutoReset = $false
        $script:CommitTimer.add_Elapsed({
            Commit-AndPush
        })
        $script:CommitTimer.Start()
    }
    
    # Подписываемся на события
    Register-ObjectEvent -InputObject $Watcher -EventName "Changed" -Action $Action | Out-Null
    Register-ObjectEvent -InputObject $Watcher -EventName "Created" -Action $Action | Out-Null
    Register-ObjectEvent -InputObject $Watcher -EventName "Renamed" -Action $Action | Out-Null
    
    Write-Host "✅ Режим отслеживания активен" -ForegroundColor Green
    Write-Host "💡 Изменения будут автоматически коммититься и отправляться на GitHub" -ForegroundColor Cyan
    Write-Host "🛑 Нажмите Ctrl+C для остановки`n" -ForegroundColor Yellow
    
    # Сохраняем текущую ревизию при старте
    try {
        $CurrentHash = (git rev-parse HEAD).Trim()
        Save-Revision -CommitHash $CurrentHash
    } catch {
        Write-Host "⚠️  Не удалось сохранить текущую ревизию" -ForegroundColor Yellow
    }
    
    # Ожидание
    try {
        while ($true) {
            Start-Sleep -Seconds 1
        }
    } finally {
        # Очистка при выходе
        if ($CommitTimer) {
            $CommitTimer.Dispose()
        }
        
        if ($ChangedFiles.Count -gt 0 -and -not $IsCommitting) {
            Write-Host "`n💾 Сохранение оставшихся изменений..." -ForegroundColor Cyan
            Commit-AndPush
        }
        
        $Watcher.EnableRaisingEvents = $false
        $Watcher.Dispose()
        
        Write-Host "`n⏹️  Режим отслеживания остановлен" -ForegroundColor Yellow
    }
}

# Запуск
Start-FileWatcher


