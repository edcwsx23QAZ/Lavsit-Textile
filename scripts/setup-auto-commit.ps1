# Скрипт для настройки автоматического коммита и деплоя
# Устанавливает git hooks и настраивает GitHub Actions

Write-Host "Настройка автоматического коммита и деплоя..." -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Get-Location

# 1. Настройка git hooks
Write-Host "Настройка git hooks..." -ForegroundColor Cyan

# Копируем PowerShell версию post-commit hook
$HookSource = Join-Path $ProjectRoot ".git\hooks\post-commit.ps1"
$HookTarget = Join-Path $ProjectRoot ".git\hooks\post-commit"

if (Test-Path $HookSource) {
    # Создаем wrapper для PowerShell hook
    $HookContent = @"
#!/bin/sh
# PowerShell wrapper для post-commit hook на Windows
powershell.exe -ExecutionPolicy Bypass -File "$HookSource"
"@
    
    $HookContent | Out-File -FilePath $HookTarget -Encoding UTF8 -NoNewline
    Write-Host "   Git hook настроен" -ForegroundColor Green
} else {
    Write-Host "   post-commit.ps1 не найден" -ForegroundColor Yellow
}

# Делаем hook исполняемым (для Git Bash)
try {
    icacls $HookTarget /grant Everyone:RX 2>&1 | Out-Null
} catch {
    # Игнорируем ошибки на Windows
}

# 2. Проверка GitHub Actions secrets
Write-Host ""
Write-Host "Проверка GitHub Actions secrets..." -ForegroundColor Cyan
Write-Host "   Для работы автоматического деплоя нужно добавить secrets в GitHub:" -ForegroundColor Yellow
Write-Host "   1. Перейдите: https://github.com/edcwsx23QAZ/Lavsit-Textile/settings/secrets/actions" -ForegroundColor Gray
Write-Host "   2. Добавьте следующие secrets:" -ForegroundColor Gray
Write-Host "      - VERCEL_TOKEN: R7r2N1maVjii1BkkRQvidtls" -ForegroundColor Gray
Write-Host "      - VERCEL_ORG_ID: team_2FyqWSswogxney3SWR8bxRzV" -ForegroundColor Gray
Write-Host "      - VERCEL_PROJECT_ID: prj_bMA2mQ3UsVKhrjJsHqSiZ1rdj15K" -ForegroundColor Gray

# 3. Создание директории для ревизий
Write-Host ""
Write-Host "Настройка хранения ревизий..." -ForegroundColor Cyan
$RevisionsDir = Join-Path $ProjectRoot ".revisions"
if (-not (Test-Path $RevisionsDir)) {
    New-Item -ItemType Directory -Path $RevisionsDir -Force | Out-Null
    Write-Host "   Директория .revisions создана" -ForegroundColor Green
} else {
    Write-Host "   Директория .revisions уже существует" -ForegroundColor Green
}

# 4. Сохранение текущей ревизии
Write-Host ""
Write-Host "Сохранение текущей ревизии..." -ForegroundColor Cyan
try {
    $CommitHash = (git rev-parse HEAD).Trim()
    
    if (-not $CommitHash) {
        Write-Host "   Git репозиторий не инициализирован" -ForegroundColor Yellow
    } else {
        $BundlePath = Join-Path $RevisionsDir "revision-$($CommitHash.Substring(0, 7))-$(Get-Date -Format 'yyyyMMdd-HHmmss').bundle"
        git bundle create $BundlePath HEAD 2>&1 | Out-Null
        
        if (Test-Path $BundlePath) {
            Write-Host "   Текущая ревизия сохранена: $($CommitHash.Substring(0, 7))" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   Не удалось сохранить текущую ревизию: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Настройка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "Доступные команды:" -ForegroundColor Cyan
Write-Host "   npm run auto:watch        - Запуск режима отслеживания изменений" -ForegroundColor Gray
Write-Host "   npm run auto:commit       - Ручной коммит и push изменений" -ForegroundColor Gray
Write-Host "   npm run revisions:save    - Сохранить текущую ревизию" -ForegroundColor Gray
Write-Host "   npm run revisions:list    - Список сохраненных ревизий" -ForegroundColor Gray
Write-Host "   npm run revisions:cleanup - Очистить старые ревизии (оставить 50)" -ForegroundColor Gray
Write-Host ""
Write-Host "Для автоматического деплоя в Vercel добавьте secrets в GitHub (см. выше)" -ForegroundColor Yellow
Write-Host ""
