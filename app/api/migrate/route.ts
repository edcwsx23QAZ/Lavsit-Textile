import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Проверка секретного ключа для безопасности
    const authHeader = request.headers.get('authorization')
    const secretKey = process.env.MIGRATION_SECRET_KEY || 'default-secret-key'
    
    if (authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Применение миграций Prisma...')
    
    // Применяем миграции
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      env: process.env,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    })

    console.log('✅ Миграции применены успешно')
    console.log('Output:', stdout)
    if (stderr) {
      console.warn('Warnings:', stderr)
    }

    return NextResponse.json({
      success: true,
      message: 'Миграции применены успешно',
      output: stdout,
      warnings: stderr || null
    })

  } catch (error: any) {
    console.error('❌ Ошибка при применении миграций:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      output: error.stdout || null,
      stderr: error.stderr || null
    }, { status: 500 })
  }
}

