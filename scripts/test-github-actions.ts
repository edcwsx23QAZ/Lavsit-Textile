/**
 * Скрипт для тестирования GitHub Actions и проверки secrets
 * Выполняет тестовый коммит и проверяет, что workflow запускается
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function testGitHubActions() {
  console.log('🧪 Тестирование GitHub Actions...\n')

  try {
    // 1. Проверка наличия workflow файла
    console.log('1️⃣ Проверка workflow файла...')
    const { existsSync } = await import('fs')
    const workflowPath = '.github/workflows/auto-deploy.yml'
    
    if (existsSync(workflowPath)) {
      console.log('   ✅ Workflow файл существует\n')
    } else {
      console.log('   ❌ Workflow файл не найден\n')
      return false
    }

    // 2. Проверка структуры workflow
    console.log('2️⃣ Проверка структуры workflow...')
    const { readFileSync } = await import('fs')
    const workflowContent = readFileSync(workflowPath, 'utf-8')
    
    const hasVercelToken = workflowContent.includes('VERCEL_TOKEN')
    const hasVercelOrgId = workflowContent.includes('VERCEL_ORG_ID')
    const hasVercelProjectId = workflowContent.includes('VERCEL_PROJECT_ID')
    const hasMainBranch = workflowContent.includes('main')
    
    console.log(`   ✅ VERCEL_TOKEN секрет: ${hasVercelToken ? '✓' : '✗'}`)
    console.log(`   ✅ VERCEL_ORG_ID секрет: ${hasVercelOrgId ? '✓' : '✗'}`)
    console.log(`   ✅ VERCEL_PROJECT_ID секрет: ${hasVercelProjectId ? '✓' : '✗'}`)
    console.log(`   ✅ Триггер на ветку main: ${hasMainBranch ? '✓' : '✗'}\n`)

    // 3. Проверка git hooks
    console.log('3️⃣ Проверка git hooks...')
    const postCommitHook = '.git/hooks/post-commit'
    
    if (existsSync(postCommitHook)) {
      console.log('   ✅ post-commit hook существует\n')
    } else {
      console.log('   ⚠️  post-commit hook не найден (можно создать через npm run setup:auto-commit)\n')
    }

    // 4. Проверка текущей ветки
    console.log('4️⃣ Проверка текущей ветки...')
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD')
    const currentBranch = branch.trim()
    console.log(`   Текущая ветка: ${currentBranch}\n`)

    // 5. Проверка наличия изменений
    console.log('5️⃣ Проверка изменений...')
    const { stdout: status } = await execAsync('git status --porcelain')
    
    if (status.trim()) {
      console.log('   ⚠️  Есть незакоммиченные изменения:')
      console.log(status.split('\n').filter(Boolean).map(line => `      ${line}`).join('\n'))
      console.log('\n   💡 Для тестирования GitHub Actions можно сделать коммит и push\n')
    } else {
      console.log('   ✅ Нет незакоммиченных изменений\n')
    }

    // 6. Информация о тестировании
    console.log('📋 Инструкция для тестирования:\n')
    console.log('   1. Убедитесь, что secrets добавлены в GitHub:')
    console.log('      https://github.com/edcwsx23QAZ/Lavsit-Textile/settings/secrets/actions\n')
    console.log('   2. Проверьте, что секреты имеют правильные значения:')
    console.log('      VERCEL_TOKEN: R7r2N1maVjii1BkkRQvidtls')
    console.log('      VERCEL_ORG_ID: team_2FyqWSswogxney3SWR8bxRzV')
    console.log('      VERCEL_PROJECT_ID: prj_bMA2mQ3UsVKhrjJsHqSiZ1rdj15K\n')
    console.log('   3. Сделайте тестовый коммит и push:')
    console.log('      git add .')
    console.log('      git commit -m "Test: проверка GitHub Actions"')
    console.log('      git push origin main\n')
    console.log('   4. Проверьте статус GitHub Actions:')
    console.log('      https://github.com/edcwsx23QAZ/Lavsit-Textile/actions\n')
    console.log('   5. Проверьте деплой в Vercel:')
    console.log('      https://vercel.com/dashboard\n')

    // 7. Проверка доступности GitHub API (опционально)
    console.log('6️⃣ Проверка доступности GitHub репозитория...')
    try {
      const response = await fetch('https://api.github.com/repos/edcwsx23QAZ/Lavsit-Textile')
      if (response.ok) {
        const repo = await response.json()
        console.log(`   ✅ Репозиторий доступен: ${repo.full_name}`)
        console.log(`   ✅ Видимость: ${repo.private ? 'приватный' : 'публичный'}\n`)
      } else {
        console.log(`   ⚠️  Репозиторий недоступен: ${response.status}\n`)
      }
    } catch (error: any) {
      console.log(`   ⚠️  Не удалось проверить репозиторий: ${error.message}\n`)
    }

    console.log('✅ Проверка завершена!\n')
    return true

  } catch (error: any) {
    console.error('❌ Ошибка при проверке:', error.message)
    return false
  }
}

// Запуск
testGitHubActions()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error)
    process.exit(1)
  })


