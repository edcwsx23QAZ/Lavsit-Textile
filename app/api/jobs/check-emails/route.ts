import { NextResponse } from 'next/server'
import { checkSupplierEmails } from '@/lib/jobs/email-checker'

/**
 * API endpoint для запуска проверки email вручную
 * Также может использоваться внешним cron сервисом (например, cron-job.org)
 */
export async function POST(request: Request) {
  try {
    // Опциональная проверка API ключа для безопасности
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.EMAIL_CHECKER_API_KEY

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[check-emails] Manual email check triggered')
    await checkSupplierEmails()

    return NextResponse.json({
      success: true,
      message: 'Email check completed',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[check-emails] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check emails',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// GET endpoint для проверки статуса
export async function GET() {
  return NextResponse.json({
    service: 'Email Checker',
    status: 'active',
    description: 'POST to this endpoint to trigger email check for all suppliers',
    timestamp: new Date().toISOString(),
  })
}


