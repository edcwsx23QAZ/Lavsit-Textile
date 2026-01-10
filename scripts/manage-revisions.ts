import { readdir, stat, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const REVISIONS_DIR = join(process.cwd(), '.revisions')
const MAX_REVISIONS = 50

async function saveCurrentRevision() {
  console.log('💾 Сохранение текущей ревизии...')

  try {
    // Создаем директорию для ревизий
    await mkdir(REVISIONS_DIR, { recursive: true })

    // Получаем текущий commit hash
    const { stdout: commitHash } = await execAsync('git rev-parse HEAD')
    const hash = commitHash.trim().substring(0, 7)

    // Получаем commit message
    const { stdout: commitMessage } = await execAsync('git log -1 --pretty=%B')
    const message = commitMessage.trim().replace(/\n/g, ' ').replace(/"/g, "'")

    // Получаем дату коммита
    const { stdout: commitDate } = await execAsync('git log -1 --pretty=%ci')
    const date = commitDate.trim()

    // Создаем git bundle
    const bundlePath = join(REVISIONS_DIR, `revision-${hash}-${Date.now()}.bundle`)
    await execAsync(`git bundle create "${bundlePath}" HEAD`)

    // Создаем файл метаданных
    const metaPath = bundlePath.replace('.bundle', '.meta.json')
    const metadata = {
      hash: hash,
      fullHash: commitHash.trim(),
      date: date,
      message: message,
      bundlePath: bundlePath,
      savedAt: new Date().toISOString(),
    }

    const { writeFile } = await import('fs/promises')
    await writeFile(metaPath, JSON.stringify(metadata, null, 2))

    console.log(`✅ Ревизия сохранена: ${hash}`)
    console.log(`   📦 Bundle: ${bundlePath}`)
    console.log(`   📝 Message: ${message}`)
    console.log(`   📅 Date: ${date}`)

    // Очищаем старые ревизии
    await cleanupOldRevisions()

    return bundlePath
  } catch (error: any) {
    console.error('❌ Ошибка при сохранении ревизии:', error.message)
    throw error
  }
}

async function cleanupOldRevisions() {
  try {
    const files = await readdir(REVISIONS_DIR)
    const bundleFiles = files.filter(f => f.endsWith('.bundle'))

    if (bundleFiles.length <= MAX_REVISIONS) {
      return
    }

    // Получаем информацию о всех bundle файлах
    const bundles = await Promise.all(
      bundleFiles.map(async (file) => {
        const filePath = join(REVISIONS_DIR, file)
        const stats = await stat(filePath)
        return {
          name: file,
          path: filePath,
          mtime: stats.mtime,
          size: stats.size,
        }
      })
    )

    // Сортируем по дате изменения (новые первыми)
    bundles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    // Удаляем старые ревизии (оставляем только последние MAX_REVISIONS)
    const toDelete = bundles.slice(MAX_REVISIONS)
    
    if (toDelete.length > 0) {
      console.log(`🗑️  Удаление ${toDelete.length} старых ревизий...`)
      
      for (const bundle of toDelete) {
        await unlink(bundle.path)
        
        // Удаляем метаданные, если есть
        const metaPath = bundle.path.replace('.bundle', '.meta.json')
        try {
          await unlink(metaPath)
        } catch {}

        console.log(`   🗑️  Удалена: ${bundle.name}`)
      }

      console.log(`✅ Осталось ревизий: ${bundles.length - toDelete.length}`)
    }

  } catch (error: any) {
    console.error('⚠️  Ошибка при очистке старых ревизий:', error.message)
  }
}

async function listRevisions() {
  try {
    const files = await readdir(REVISIONS_DIR)
    const bundleFiles = files.filter(f => f.endsWith('.bundle')).sort().reverse()

    if (bundleFiles.length === 0) {
      console.log('ℹ️  Локальные ревизии не найдены')
      return
    }

    console.log(`\n📋 Список сохраненных ревизий (${bundleFiles.length}):\n`)

    for (const file of bundleFiles.slice(0, 20)) { // Показываем первые 20
      const bundlePath = join(REVISIONS_DIR, file)
      const metaPath = bundlePath.replace('.bundle', '.meta.json')

      try {
        const { readFile } = await import('fs/promises')
        const metaContent = await readFile(metaPath, 'utf-8')
        const metadata = JSON.parse(metaContent)

        console.log(`✅ ${metadata.hash}`)
        console.log(`   📅 ${metadata.date}`)
        console.log(`   📝 ${metadata.message}`)
        console.log(`   📦 ${file}`)
        console.log('')
      } catch {
        // Если нет метаданных, показываем только имя файла
        const stats = await stat(bundlePath)
        console.log(`✅ ${file}`)
        console.log(`   📅 ${stats.mtime.toLocaleString('ru-RU')}`)
        console.log('')
      }
    }

    if (bundleFiles.length > 20) {
      console.log(`   ... и еще ${bundleFiles.length - 20} ревизий\n`)
    }

    const totalSize = await calculateTotalSize()
    console.log(`💾 Общий размер ревизий: ${formatBytes(totalSize)}`)

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️  Директория ревизий не существует')
    } else {
      console.error('❌ Ошибка при получении списка ревизий:', error.message)
    }
  }
}

async function calculateTotalSize(): Promise<number> {
  try {
    const files = await readdir(REVISIONS_DIR)
    const bundleFiles = files.filter(f => f.endsWith('.bundle'))

    let totalSize = 0
    for (const file of bundleFiles) {
      const filePath = join(REVISIONS_DIR, file)
      const stats = await stat(filePath)
      totalSize += stats.size
    }

    return totalSize
  } catch {
    return 0
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

async function restoreRevision(hash: string) {
  console.log(`🔄 Восстановление ревизии: ${hash}...`)

  try {
    const files = await readdir(REVISIONS_DIR)
    const bundleFile = files.find(f => f.includes(hash) && f.endsWith('.bundle'))

    if (!bundleFile) {
      console.error(`❌ Ревизия ${hash} не найдена в локальных ревизиях`)
      console.log('💡 Используйте: git checkout <hash> для восстановления из Git истории')
      return
    }

    const bundlePath = join(REVISIONS_DIR, bundleFile)
    console.log(`📦 Найден bundle: ${bundleFile}`)

    // Восстанавливаем из bundle
    await execAsync(`git fetch "${bundlePath}" main:restore-${hash}`)
    console.log(`✅ Ревизия восстановлена в ветку: restore-${hash}`)
    console.log(`💡 Для применения выполните: git checkout restore-${hash}`)

  } catch (error: any) {
    console.error('❌ Ошибка при восстановлении ревизии:', error.message)
  }
}

// CLI интерфейс
const command = process.argv[2]
const arg = process.argv[3]

async function main() {
  switch (command) {
    case 'save':
      await saveCurrentRevision()
      break
    case 'list':
      await listRevisions()
      break
    case 'cleanup':
      await cleanupOldRevisions()
      break
    case 'restore':
      if (!arg) {
        console.error('❌ Укажите hash ревизии для восстановления')
        console.log('💡 Пример: npm run revisions:restore abc1234')
        process.exit(1)
      }
      await restoreRevision(arg)
      break
    default:
      console.log('📋 Управление локальными ревизиями\n')
      console.log('Использование:')
      console.log('  npm run revisions:save     - Сохранить текущую ревизию')
      console.log('  npm run revisions:list     - Показать список ревизий')
      console.log('  npm run revisions:cleanup  - Очистить старые ревизии (оставить 50)')
      console.log('  npm run revisions:restore <hash> - Восстановить ревизию\n')
      await listRevisions()
  }
}

main().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})


