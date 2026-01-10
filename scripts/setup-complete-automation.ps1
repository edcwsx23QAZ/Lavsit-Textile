# Полная настройка автоматизации для lavsit-textile
# Этот скрипт настраивает всю систему автоматического коммита, push и деплоя

Write-Host "[*] Настройка полной автоматизации для lavsit-textile..." -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Get-Location
$ErrorActionPreference = "Continue"

# 1. Проверка и установка зависимостей
Write-Host "[*] Проверка зависимостей..." -ForegroundColor Cyan
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Установка npm зависимостей..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   [ERROR] Ошибка при установке зависимостей" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "   [OK] Зависимости уже установлены" -ForegroundColor Green
    }
    
    # Проверяем chokidar
    if (-not (Test-Path "node_modules\chokidar")) {
        Write-Host "   Установка chokidar..." -ForegroundColor Yellow
        npm install chokidar@^3.6.0
    }
} catch {
    Write-Host "   [WARN] Ошибка при проверке зависимостей: $_" -ForegroundColor Yellow
}

# 2. Настройка Git hooks
Write-Host ""
Write-Host "[*] Настройка Git hooks..." -ForegroundColor Cyan

$HookDir = Join-Path $ProjectRoot ".git\hooks"
$HookFile = Join-Path $HookDir "post-commit"
$HookFilePS1 = Join-Path $HookDir "post-commit.ps1"

if (-not (Test-Path $HookDir)) {
    Write-Host "   [ERROR] Директория .git\hooks не найдена" -ForegroundColor Red
    Write-Host "   Убедитесь, что вы находитесь в Git репозитории" -ForegroundColor Yellow
    exit 1
}

# Копируем PowerShell hook
if (Test-Path $HookFilePS1) {
    # Создаем обертку для Git
    $HookContent = @"
#!/bin/sh
# PowerShell wrapper для post-commit hook на Windows
powershell.exe -ExecutionPolicy Bypass -File "$HookFilePS1"
"@
    
    $HookContent | Out-File -FilePath $HookFile -Encoding UTF8 -NoNewline
    Write-Host "   [OK] Git hook настроен" -ForegroundColor Green
} else {
    Write-Host "   [WARN] post-commit.ps1 не найден" -ForegroundColor Yellow
}

# 3. Создание директории для ревизий
Write-Host ""
Write-Host "[*] Настройка хранения ревизий..." -ForegroundColor Cyan

$RevisionsDir = Join-Path $ProjectRoot ".revisions"
if (-not (Test-Path $RevisionsDir)) {
    New-Item -ItemType Directory -Path $RevisionsDir -Force | Out-Null
    Write-Host "   [OK] Директория .revisions создана" -ForegroundColor Green
} else {
    Write-Host "   [OK] Директория .revisions уже существует" -ForegroundColor Green
}

# Добавляем в .gitignore если нужно
$GitIgnorePath = Join-Path $ProjectRoot ".gitignore"
if (Test-Path $GitIgnorePath) {
    $gitIgnoreContent = Get-Content $GitIgnorePath -Raw
    if ($gitIgnoreContent -notmatch "\.revisions") {
        Add-Content $GitIgnorePath "`n# Ревизии (локальные backups)`n.revisions/"
        Write-Host "   [OK] .revisions добавлен в .gitignore" -ForegroundColor Green
    }
}

# 4. Сохранение текущей ревизии
Write-Host ""
Write-Host "[*] Сохранение текущей ревизии..." -ForegroundColor Cyan
try {
    $CommitHash = (git rev-parse HEAD 2>&1).Trim()
    
    if ($CommitHash -and -not $CommitHash.Contains("fatal")) {
        $BundlePath = Join-Path $RevisionsDir "revision-$($CommitHash.Substring(0, 7))-$(Get-Date -Format 'yyyyMMdd-HHmmss').bundle"
        git bundle create $BundlePath HEAD 2>&1 | Out-Null
        
        if (Test-Path $BundlePath) {
            Write-Host "   [OK] Текущая ревизия сохранена: $($CommitHash.Substring(0, 7))" -ForegroundColor Green
        }
    } else {
        Write-Host "   [WARN] Git репозиторий не инициализирован или нет коммитов" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [WARN] Не удалось сохранить текущую ревизию: $_" -ForegroundColor Yellow
}

# 5. Проверка GitHub Actions
Write-Host ""
Write-Host "[*] Проверка GitHub Actions..." -ForegroundColor Cyan

$WorkflowDir = Join-Path $ProjectRoot ".github\workflows"
if (Test-Path $WorkflowDir) {
    $WorkflowFile = Join-Path $WorkflowDir "auto-deploy.yml"
    if (Test-Path $WorkflowFile) {
        Write-Host "   [OK] GitHub Actions workflow найден" -ForegroundColor Green
        Write-Host ""
        Write-Host "   [WARN] Убедитесь, что в GitHub добавлены secrets:" -ForegroundColor Yellow
        Write-Host "      - VERCEL_TOKEN" -ForegroundColor Gray
        Write-Host "      - VERCEL_ORG_ID" -ForegroundColor Gray
        Write-Host "      - VERCEL_PROJECT_ID" -ForegroundColor Gray
        Write-Host "      Ссылка: https://github.com/edcwsx23QAZ/Lavsit-Textile/settings/secrets/actions" -ForegroundColor Gray
    } else {
        Write-Host "   [WARN] GitHub Actions workflow не найден" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [WARN] Директория .github\workflows не найдена" -ForegroundColor Yellow
}

# 6. Проверка подключения к GitHub
Write-Host ""
Write-Host "[*] Проверка подключения к GitHub..." -ForegroundColor Cyan
try {
    $RemoteUrl = (git remote get-url origin 2>&1).Trim()
    if ($RemoteUrl -and -not $RemoteUrl.Contains("fatal")) {
        Write-Host "   [OK] Remote origin: $RemoteUrl" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] Remote origin не настроен" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [WARN] Не удалось проверить remote: $_" -ForegroundColor Yellow
}

# 7. Итоги и инструкции
Write-Host ""
Write-Host "[OK] Настройка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "[*] Доступные команды:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Автоматический коммит:" -ForegroundColor Yellow
Write-Host "     npm run auto:watch      - Запуск режима отслеживания изменений" -ForegroundColor Gray
Write-Host "     npm run auto:start      - Запуск авто-коммита как фоновой службы" -ForegroundColor Gray
Write-Host "     npm run auto:stop       - Остановка фоновой службы" -ForegroundColor Gray
Write-Host "     npm run auto:status     - Проверка статуса службы" -ForegroundColor Gray
Write-Host "     npm run auto:commit     - Ручной коммит и push" -ForegroundColor Gray
Write-Host ""
Write-Host "   Управление ревизиями:" -ForegroundColor Yellow
Write-Host "     npm run revisions:save    - Сохранить текущую ревизию" -ForegroundColor Gray
Write-Host "     npm run revisions:list    - Список сохраненных ревизий (последние 50)" -ForegroundColor Gray
Write-Host "     npm run revisions:cleanup - Очистить старые ревизии" -ForegroundColor Gray
Write-Host "     npm run revisions:restore [hash] - Восстановить ревизию" -ForegroundColor Gray
Write-Host ""
Write-Host "[*] Как это работает:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. [OK] При каждом коммите автоматически выполняется push на GitHub" -ForegroundColor Green
Write-Host "   2. [OK] GitHub Actions автоматически деплоит изменения в Vercel" -ForegroundColor Green
Write-Host "   3. [OK] Локально сохраняются последние 50 ревизий" -ForegroundColor Green
Write-Host "   4. [OK] Можно запустить авто-коммит в фоне для автоматического отслеживания изменений" -ForegroundColor Green
Write-Host ""
Write-Host "[TIP] Для запуска автономного режима:" -ForegroundColor Cyan
Write-Host "   npm run auto:start" -ForegroundColor White
Write-Host ""
