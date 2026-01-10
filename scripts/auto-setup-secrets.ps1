# Автоматическая настройка GitHub Secrets и Vercel Environment Variables для Lavsit Textile
# Читает переменные из .env файла и настраивает их автоматически
# Использование: .\scripts\auto-setup-secrets.ps1

param(
    [switch]$GitHubOnly,
    [switch]$VercelOnly,
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"

Write-Host "🚀 Автоматическая настройка Secrets для Lavsit Textile" -ForegroundColor Cyan
Write-Host ("="*70) -ForegroundColor Cyan
Write-Host ""

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Словарь для хранения переменных
$envVars = @{}
$missingVars = @{}

# Функция для загрузки переменных из .env или .env.local
function Load-EnvFile {
    $envFiles = @(".env.local", ".env")
    $loaded = $false
    
    foreach ($envFile in $envFiles) {
        $envPath = Join-Path $repoRoot $envFile
        
        if (Test-Path $envPath) {
            Write-Host "📄 Загрузка переменных из $envFile..." -ForegroundColor Cyan
            Get-Content $envPath | ForEach-Object {
                if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*)$') {
                    $key = $matches[1].Trim()
                    $value = $matches[2].Trim() -replace '^["'']+', '' -replace '["'']+$', ''
                    if (-not [string]::IsNullOrWhiteSpace($value) -and $value -notmatch '^your-|^YOUR-|example|placeholder') {
                        $envVars[$key] = $value
                        Write-Host "   ✅ $key" -ForegroundColor Green
                    }
                }
            }
            $loaded = $true
            Write-Host ""
            break
        }
    }
    
    if (-not $loaded) {
        Write-Host "⚠️  Файлы .env или .env.local не найдены!" -ForegroundColor Yellow
        Write-Host "   Создайте файл .env.local с переменными" -ForegroundColor Gray
        return $false
    }
    return $true
}

# Переменные, которые нужны для GitHub Secrets (для Lavsit Textile)
$githubRequiredSecrets = @(
    "DATABASE_URL"
)

# Переменные, которые нужны для GitHub Actions (конфигурационные)
$githubConfigSecrets = @(
    @{Name = "VERCEL_TOKEN"; Description = "Vercel API Token"},
    @{Name = "VERCEL_ORG_ID"; Description = "Vercel Team/Organization ID"},
    @{Name = "VERCEL_PROJECT_ID"; Description = "Vercel Project ID"}
)

# Опциональные переменные для GitHub Secrets
$optionalGitHubSecrets = @(
    @{Name = "EMAIL_CHECKER_API_KEY"; Description = "API Key для защиты email checker endpoint"}
)

# Переменные, которые нужны для Vercel Environment Variables
$vercelRequiredVars = @(
    "DATABASE_URL"
)

$vercelOptionalVars = @(
    @{Name = "EMAIL_CHECKER_API_KEY"; Description = "API Key для защиты email checker endpoint"}
)

# Функция для проверки наличия GitHub CLI
function Test-GitHubCLI {
    try {
        $null = gh --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# Функция для установки GitHub Secret
function Set-GitHubSecret {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Repo
    )
    
    if ($DryRun) {
        Write-Host "   [DRY RUN] Установка GitHub Secret: $Name" -ForegroundColor Gray
        return $true
    }
    
    try {
        $Value | gh secret set $Name --repo $Repo 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Установлен GitHub Secret: $Name" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ⚠️  Не удалось установить: $Name (код: $LASTEXITCODE)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "   ❌ Ошибка при установке $Name : $_" -ForegroundColor Red
        return $false
    }
}

# Функция для проверки наличия Vercel CLI
function Test-VercelCLI {
    try {
        $null = vercel --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# Функция для установки Vercel Environment Variable
function Set-VercelEnvVar {
    param(
        [string]$Name,
        [string]$Value,
        [string[]]$Environments = @("production", "preview", "development")
    )
    
    if ($DryRun) {
        Write-Host "   [DRY RUN] Установка Vercel Env Var: $Name для $($Environments -join ', ')" -ForegroundColor Gray
        return $true
    }
    
    $successCount = 0
    foreach ($env in $Environments) {
        try {
            echo $Value | vercel env add $Name $env --yes 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Установлена переменная $Name для $env" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "   ⚠️  Переменная $Name для $env уже существует или ошибка" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ❌ Ошибка при установке $Name для $env : $_" -ForegroundColor Red
        }
    }
    
    return $successCount -gt 0
}

# Загрузка переменных из .env
$envLoaded = Load-EnvFile

# Если DATABASE_URL не найден, попробуем построить из известных данных
if (-not $envVars.ContainsKey("DATABASE_URL")) {
    Write-Host "🔧 DATABASE_URL не найден, пытаемся построить из известных данных..." -ForegroundColor Cyan
    
    # Известные данные из проекта (из scripts/fix-database-url.ts)
    $supabaseProjectId = "hduadapicktrcrqjvzvd"
    $supabasePassword = "edcwsx123QAZ!"
    
    # URL encoding для пароля
    $encodedPassword = [System.Uri]::EscapeDataString($supabasePassword)
    
    # Используем Connection Pooler URL для US East (по умолчанию)
    # Можно попробовать другие регионы, если этот не работает
    $databaseUrl = "postgresql://postgres.$supabaseProjectId`:$encodedPassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
    
    $envVars["DATABASE_URL"] = $databaseUrl
    Write-Host "   ✅ DATABASE_URL построен автоматически (US East region)" -ForegroundColor Green
    Write-Host "   💡 Если регион другой, обновите DATABASE_URL вручную" -ForegroundColor Gray
    Write-Host ""
}

# Попытка загрузить Vercel credentials из известных данных
if (-not $envVars.ContainsKey("VERCEL_TOKEN")) {
    # Проверяем наличие в файле AUTOMATED_DEPLOY.md или .vercel-token
    $vercelTokenFile = Join-Path $repoRoot ".vercel-token"
    if (Test-Path $vercelTokenFile) {
        $vercelToken = Get-Content $vercelTokenFile -Raw | ForEach-Object { $_.Trim() }
        if (-not [string]::IsNullOrWhiteSpace($vercelToken)) {
            $envVars["VERCEL_TOKEN"] = $vercelToken
            Write-Host "✅ VERCEL_TOKEN найден в .vercel-token" -ForegroundColor Green
        }
    }
    
    # Или используем известное значение
    if (-not $envVars.ContainsKey("VERCEL_TOKEN")) {
        $envVars["VERCEL_TOKEN"] = "R7r2N1maVjii1BkkRQvidtls"
        $envVars["VERCEL_ORG_ID"] = "team_2FyqWSswogxney3SWR8bxRzV"
        $envVars["VERCEL_PROJECT_ID"] = "prj_bMA2mQ3UsVKhrjJsHqSiZ1rdj15K"
        Write-Host "✅ Использованы известные Vercel credentials из проекта" -ForegroundColor Green
    }
}

# Получение информации о репозитории
$gitRemote = git remote get-url origin 2>$null
if ($gitRemote -match 'github\.com[/:]([^/]+)/([^/]+?)(?:\.git)?$') {
    $githubOwner = $matches[1]
    $githubRepo = $matches[2] -replace '\.git$', ''
    $githubRepoFull = "$githubOwner/$githubRepo"
    Write-Host "📦 GitHub репозиторий: $githubRepoFull" -ForegroundColor Cyan
} else {
    Write-Host "❌ Не удалось определить GitHub репозиторий" -ForegroundColor Red
    exit 1
}

Write-Host ""

# === НАСТРОЙКА GITHUB SECRETS ===
if (-not $VercelOnly) {
    Write-Host "🔐 Настройка GitHub Secrets..." -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-GitHubCLI) {
        Write-Host "✅ GitHub CLI установлен" -ForegroundColor Green
        
        $ghAuth = gh auth status 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Не авторизован в GitHub CLI" -ForegroundColor Yellow
            Write-Host "   Выполните: gh auth login" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "✅ Авторизован в GitHub CLI" -ForegroundColor Green
            Write-Host ""
            
            # Установка обязательных secrets из .env
            foreach ($secretName in $githubRequiredSecrets) {
                if ($envVars.ContainsKey($secretName)) {
                    Set-GitHubSecret -Name $secretName -Value $envVars[$secretName] -Repo $githubRepoFull
                } else {
                    Write-Host "   ⚠️  $secretName отсутствует в .env.local" -ForegroundColor Yellow
                    $missingVars[$secretName] = "Required for GitHub Secrets"
                }
            }
            
            # Установка опциональных secrets, если они есть
            foreach ($optVar in $optionalGitHubSecrets) {
                if ($envVars.ContainsKey($optVar.Name)) {
                    Set-GitHubSecret -Name $optVar.Name -Value $envVars[$optVar.Name] -Repo $githubRepoFull
                }
            }
            
            Write-Host ""
            Write-Host "📋 Требуются дополнительные конфигурационные secrets:" -ForegroundColor Yellow
            foreach ($configSecret in $githubConfigSecrets) {
                $existing = gh secret list --repo $githubRepoFull 2>&1 | Select-String $configSecret.Name
                if ($existing) {
                    Write-Host "   ✅ $($configSecret.Name) уже установлен" -ForegroundColor Green
                } else {
                    Write-Host "   ❌ $($configSecret.Name) - $($configSecret.Description)" -ForegroundColor Red
                    $missingVars[$configSecret.Name] = $configSecret.Description
                }
            }
        }
    } else {
        Write-Host "⚠️  GitHub CLI не установлен" -ForegroundColor Yellow
        Write-Host "   Установите: winget install GitHub.cli" -ForegroundColor Gray
    }
    Write-Host ""
}

# === НАСТРОЙКА VERCEL ENVIRONMENT VARIABLES ===
if (-not $GitHubOnly) {
    Write-Host "🌐 Настройка Vercel Environment Variables..." -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-VercelCLI) {
        Write-Host "✅ Vercel CLI установлен" -ForegroundColor Green
        
        $vercelAuth = vercel whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Не авторизован в Vercel CLI" -ForegroundColor Yellow
            Write-Host "   Выполните: vercel login" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "✅ Авторизован в Vercel CLI" -ForegroundColor Green
            Write-Host "   Пользователь: $vercelAuth" -ForegroundColor Gray
            Write-Host ""
            
            if (-not (Test-Path ".vercel\project.json")) {
                Write-Host "⚠️  Проект не связан с Vercel" -ForegroundColor Yellow
                Write-Host "   Выполните: vercel link" -ForegroundColor Gray
                Write-Host ""
            } else {
                Write-Host "✅ Проект связан с Vercel" -ForegroundColor Green
                Write-Host ""
                
                # Установка обязательных переменных
                foreach ($varName in $vercelRequiredVars) {
                    if ($envVars.ContainsKey($varName)) {
                        Set-VercelEnvVar -Name $varName -Value $envVars[$varName]
                    } else {
                        Write-Host "   ⚠️  $varName отсутствует в .env.local" -ForegroundColor Yellow
                    }
                }
                
                # Установка опциональных переменных
                foreach ($optVar in $vercelOptionalVars) {
                    if ($envVars.ContainsKey($optVar.Name)) {
                        Set-VercelEnvVar -Name $optVar.Name -Value $envVars[$optVar.Name]
                    }
                }
            }
        }
    } else {
        Write-Host "⚠️  Vercel CLI не установлен" -ForegroundColor Yellow
        Write-Host "   Установите: npm install -g vercel" -ForegroundColor Gray
    }
    Write-Host ""
}

# === ИТОГОВЫЙ ОТЧЕТ ===
Write-Host ("="*70) -ForegroundColor Cyan
Write-Host "📊 ИТОГОВЫЙ ОТЧЕТ" -ForegroundColor Cyan
Write-Host ""

if ($missingVars.Count -eq 0) {
    Write-Host "✅ Все необходимые переменные настроены!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Отсутствуют следующие переменные:" -ForegroundColor Yellow
    Write-Host ""
    foreach ($var in $missingVars.GetEnumerator()) {
        Write-Host "   ❌ $($var.Key)" -ForegroundColor Red
        Write-Host "      $($var.Value)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "💡 Инструкции:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Для VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID:" -ForegroundColor White
    Write-Host "   1. Откройте Vercel Dashboard → ваш проект → Settings" -ForegroundColor Gray
    Write-Host "   2. VERCEL_TOKEN: Settings → Tokens → Create Token" -ForegroundColor Gray
    Write-Host "   3. VERCEL_ORG_ID: Team Settings → General → Team ID" -ForegroundColor Gray
    Write-Host "   4. VERCEL_PROJECT_ID: Project Settings → General → Project ID" -ForegroundColor Gray
    Write-Host "   5. Выполните: gh secret set [NAME] --repo $githubRepoFull" -ForegroundColor Gray
    Write-Host ""
}

if ($DryRun) {
    Write-Host "ℹ️  Это был DRY RUN - ничего не было изменено" -ForegroundColor Cyan
    Write-Host "   Запустите без -DryRun для реальной настройки" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Готово!" -ForegroundColor Green
Write-Host ""

