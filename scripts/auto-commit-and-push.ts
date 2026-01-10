import { exec } from 'child_process'
import { promisify } from 'util'
import { join, relative } from 'path'
import chokidar from 'chokidar'

const execAsync = promisify(exec)

// Игнорируемые файлы и директории
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.git/,
  /\.vercel/,
  /dist/,
  /build/,
  /coverage/,
  /\.env/,
  /\.env\.local/,
  /\.env\.vercel/,
  /\.env\.vercel-check/,
  /\.DS_Store/,
  /Thumbs\.db/,
  /\.log$/,
  /\.tsbuildinfo$/,
  /\.swp$/,
  /\.swo$/,
  /\~$/,
]

// Время ожидания перед коммитом (в миллисекундах)
const COMMIT_DELAY = 5000 // 5 секунд после последнего изменения

let commitTimer: NodeJS.Timeout | null = null
let isCommitting = false
let pendingChanges = new Set<string>()

async function runCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10, // 10MB
    })
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\nError: ${error.message}`)
  }
}

function shouldIgnore(filePath: string): boolean {
  const relativePath = relative(process.cwd(), filePath)
  return IGNORE_PATTERNS.some(pattern => pattern.test(relativePath))
}

async function commitAndPush() {
  if (isCommitting) {
    console.log('⏸️  Коммит уже выполняется, пропускаем...')
    return
  }

  isCommitting = true
  pendingChanges.clear()

  try {
    console.log('\n📝 Проверка изменений...')
    
    // Проверяем статус
    const { stdout: status } = await runCommand('git status --porcelain')
    
    if (!status.trim()) {
      console.log('ℹ️  Нет изменений для коммита')
      isCommitting = false
      return
    }

    // Добавляем все изменения
    console.log('📦 Добавление изменений в staging...')
    await runCommand('git add -A')

    // Создаем коммит с временной меткой
    const timestamp = new Date().toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const commitMessage = `Auto-commit: ${timestamp}\n\nАвтоматический коммит изменений`

    console.log('💾 Создание коммита...')
    await runCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`)

    // Отправляем на GitHub
    console.log('🚀 Отправка на GitHub...')
    const { stdout: branch } = await runCommand('git rev-parse --abbrev-ref HEAD')
    const currentBranch = branch.trim()

    await runCommand(`git push origin ${currentBranch}`)

    console.log('✅ Изменения успешно сохранены на GitHub!')
    console.log(`🔗 Branch: ${currentBranch}`)

    // Сохраняем ревизию локально
    await saveRevision()

  } catch (error: any) {
    console.error('❌ Ошибка при коммите/push:', error.message)
    // Не прерываем работу, продолжаем отслеживать изменения
  } finally {
    isCommitting = false
  }
}

async function saveRevision() {
  try {
    const { stdout: commitHash } = await runCommand('git rev-parse HEAD')
    const hash = commitHash.trim()
    
    // Создаем git bundle для хранения ревизии
    const revisionsDir = join(process.cwd(), '.revisions')
    const { mkdir } = await import('fs/promises')
    try {
      await mkdir(revisionsDir, { recursive: true })
    } catch {}

    const bundlePath = join(revisionsDir, `revision-${hash.substring(0, 7)}.bundle`)
    await runCommand(`git bundle create "${bundlePath}" HEAD`)

    // Удаляем старые ревизии (оставляем только последние 50)
    await cleanupOldRevisions(revisionsDir)

    console.log(`📦 Ревизия сохранена: ${bundlePath}`)
  } catch (error: any) {
    console.error('⚠️  Не удалось сохранить ревизию:', error.message)
  }
}

async function cleanupOldRevisions(revisionsDir: string) {
  try {
    const { readdir, stat, unlink } = await import('fs/promises')
    const files = await readdir(revisionsDir)
    
    const bundleFiles = files
      .filter(f => f.endsWith('.bundle'))
      .map(async (f) => {
        const filePath = join(revisionsDir, f)
        const stats = await stat(filePath)
        return { name: f, path: filePath, mtime: stats.mtime }
      })

    const bundles = await Promise.all(bundleFiles)
    bundles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    // Удаляем все ревизии кроме последних 50
    if (bundles.length > 50) {
      const toDelete = bundles.slice(50)
      for (const bundle of toDelete) {
        await unlink(bundle.path)
        console.log(`🗑️  Удалена старая ревизия: ${bundle.name}`)
      }
    }
  } catch (error: any) {
    console.error('⚠️  Ошибка при очистке старых ревизий:', error.message)
  }
}

function scheduleCommit(filePath: string) {
  pendingChanges.add(filePath)

  if (commitTimer) {
    clearTimeout(commitTimer)
  }

  commitTimer = setTimeout(() => {
    commitAndPush()
  }, COMMIT_DELAY)
}

async function startWatchMode() {
  console.log('👀 Запуск режима отслеживания изменений...')
  console.log(`📁 Отслеживается директория: ${process.cwd()}\n`)

  const watchDir = process.cwd()

  // Используем chokidar для более надежного отслеживания изменений
  const watcher = chokidar.watch(watchDir, {
    ignored: (path) => {
      const relativePath = relative(watchDir, path)
      return shouldIgnore(path) || relativePath.includes('.git') || relativePath.includes('.revisions')
    },
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000, // Ждем 1 секунду после последнего изменения
      pollInterval: 100
    }
  })

  watcher
    .on('change', (path) => {
      const relativePath = relative(watchDir, path)
      console.log(`📝 Изменение обнаружено: ${relativePath}`)
      scheduleCommit(path)
    })
    .on('add', (path) => {
      const relativePath = relative(watchDir, path)
      console.log(`➕ Новый файл: ${relativePath}`)
      scheduleCommit(path)
    })
    .on('unlink', (path) => {
      const relativePath = relative(watchDir, path)
      console.log(`🗑️  Файл удален: ${relativePath}`)
      scheduleCommit(path)
    })
    .on('error', (error) => {
      console.error('❌ Ошибка отслеживания:', error.message)
    })
    .on('ready', () => {
      console.log('✅ Режим отслеживания активен')
      console.log('💡 Изменения будут автоматически коммититься и отправляться на GitHub')
      console.log(`⏱️  Задержка перед коммитом: ${COMMIT_DELAY / 1000} секунд`)
      console.log('🛑 Нажмите Ctrl+C для остановки\n')

      // Сохраняем текущую ревизию при старте
      saveRevision().catch(err => {
        console.error('⚠️  Не удалось сохранить текущую ревизию:', err.message)
      })
    })

  // Обработка завершения
  process.on('SIGINT', async () => {
    console.log('\n\n⏹️  Остановка режима отслеживания...')
    watcher.close()
    if (commitTimer) {
      clearTimeout(commitTimer)
    }
    if (pendingChanges.size > 0 && !isCommitting) {
      console.log('💾 Сохранение оставшихся изменений...')
      await commitAndPush()
    }
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    watcher.close()
    if (commitTimer) {
      clearTimeout(commitTimer)
    }
    process.exit(0)
  })
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Остановка режима отслеживания...')
  if (commitTimer) {
    clearTimeout(commitTimer)
  }
  if (pendingChanges.size > 0 && !isCommitting) {
    console.log('💾 Сохранение оставшихся изменений...')
    commitAndPush().finally(() => {
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
})

process.on('SIGTERM', () => {
  if (commitTimer) {
    clearTimeout(commitTimer)
  }
  process.exit(0)
})

// Запуск
startWatchMode().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})

