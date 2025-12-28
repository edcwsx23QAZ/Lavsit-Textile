import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailParser, EmailConfig } from '@/lib/email/email-parser'
import { EmailExcelParser } from '@/lib/parsers/email-excel-parser'
import { saveParsedDataToExcel } from '@/lib/parsers/save-parsed-data'
import { ParsedMail } from 'mailparser'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    if (supplier.parsingMethod !== 'email') {
      return NextResponse.json(
        { error: 'Supplier is not configured for email parsing' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    if (!supplier.emailConfig) {
      return NextResponse.json(
        { error: 'Email configuration not found for this supplier' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Parse email configuration
    const emailConfig: EmailConfig = JSON.parse(supplier.emailConfig)

    console.log(`[parse-email] Checking emails for supplier: ${supplier.name}`)

    // Connect to email server
    const emailParser = new EmailParser(emailConfig)
    await emailParser.connect()

    try {
      // Fetch emails (configurable number of days, default 90)
      const searchDays = emailConfig.searchDays || 90
      const since = new Date()
      since.setDate(since.getDate() - searchDays)

      console.log(`[parse-email] Searching emails from last ${searchDays} days (since ${since.toISOString()})`)
      console.log(`[parse-email] Filters: fromEmail=${emailConfig.fromEmail || 'none'}, subjectFilter=${emailConfig.subjectFilter || 'none'}, unreadOnly=${emailConfig.searchUnreadOnly !== false}`)
      console.log(`[parse-email] Full email config:`, JSON.stringify(emailConfig, null, 2))

      const emails = await emailParser.fetchNewEmails(supplier.id, since)
      console.log(`[parse-email] Found ${emails.length} email(s) matching criteria`)
      
      // Логируем детали найденных писем
      if (emails.length > 0) {
        console.log(`[parse-email] Email details:`)
        emails.forEach((email, idx) => {
          console.log(`  ${idx + 1}. From: ${email.from?.text || 'unknown'}, Subject: ${email.subject || 'no subject'}, Date: ${email.date?.toISOString() || 'no date'}`)
        })
      }

      if (emails.length === 0) {
        // Provide helpful message about why no emails were found
        const reasons: string[] = []
        if (emailConfig.searchUnreadOnly !== false) {
          reasons.push('ищутся только непрочитанные письма')
        }
        if (emailConfig.fromEmail) {
          reasons.push(`фильтр по отправителю: ${emailConfig.fromEmail}`)
        }
        if (emailConfig.subjectFilter) {
          reasons.push(`фильтр по теме: ${emailConfig.subjectFilter}`)
        }
        reasons.push(`период поиска: последние ${searchDays} дней`)

        console.log(`[parse-email] No emails found. Possible reasons: ${reasons.join(', ')}`)
      }

      // Find email with the latest date that has valid Excel attachments
      let latestEmail: ParsedMail | null = null
      let latestDate: Date | null = null
      let validEmails: Array<{ email: ParsedMail; date: Date; attachment: any }> = []

      console.log(`[parse-email] Checking ${emails.length} emails for valid Excel attachments...`)

      let totalAttachments = 0
      for (const email of emails) {
        const attachments = emailParser.extractExcelAttachments(email)
        totalAttachments += attachments.length
        
        if (attachments.length === 0) {
          console.log(`[parse-email] Email from ${email.date?.toISOString()}, subject: "${email.subject}" - no Excel attachments found`)
          continue
        }

        console.log(`[parse-email] Checking email from ${email.date?.toISOString()}, subject: "${email.subject}", Excel attachments: ${attachments.length}`)
        attachments.forEach((att, idx) => {
          console.log(`  Attachment ${idx + 1}: ${att.filename}, size: ${att.size || 'unknown'} bytes`)
        })

        // Проверяем каждое вложение
        for (const attachment of attachments) {
          try {
            // Сохраняем вложение во временный файл для проверки (без записи в БД)
            const tempFilePath = await emailParser.saveAttachment(
              supplier.id,
              email,
              attachment,
              true // skipDatabase = true
            )

            // Проверяем валидность файла
            // Для Аметиста используем AmetistParser, для остальных - EmailExcelParser
            let parser: any
            let isValid = false
            
            if (supplier.name === 'Аметист') {
              const { AmetistParser } = await import('@/lib/parsers/ametist-parser')
              parser = new AmetistParser(supplier.id, supplier.name)
              
              // Для ZIP файлов проверяем, что архив можно распаковать и содержит Excel
              if (tempFilePath.endsWith('.zip')) {
                try {
                  const zip = new AdmZip(tempFilePath)
                  const zipEntries = zip.getEntries()
                  const hasExcel = zipEntries.some(entry => 
                    entry.entryName.endsWith('.xlsx') || entry.entryName.endsWith('.xls')
                  )
                  if (hasExcel) {
                    // Пробуем распаковать и проверить Excel файл
                    const extractPath = path.join(path.dirname(tempFilePath), 'extracted')
                    if (!fs.existsSync(extractPath)) {
                      fs.mkdirSync(extractPath, { recursive: true })
                    }
                    zip.extractAllTo(extractPath, true)
                    const files = fs.readdirSync(extractPath)
                    const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
                    if (excelFile) {
                      const excelPath = path.join(extractPath, excelFile)
                      isValid = await parser.validateFile(excelPath)
                      // Удаляем временные файлы
                      fs.rmSync(extractPath, { recursive: true, force: true })
                    }
                  }
                } catch (zipError: any) {
                  console.log(`[parse-email] Error processing ZIP: ${zipError.message}`)
                  isValid = false
                }
              } else {
                isValid = await parser.validateFile(tempFilePath)
              }
            } else {
              parser = new EmailExcelParser(supplier.id, supplier.name)
              isValid = await parser.validateFile(tempFilePath)
            }

            if (isValid) {
              const emailDate = email.date || new Date(0)
              validEmails.push({
                email,
                date: emailDate,
                attachment,
              })
              console.log(`[parse-email] Valid Excel file found: ${attachment.filename}, date: ${emailDate.toISOString()}`)
              // Используем первое валидное вложение из письма
              break
            } else {
              console.log(`[parse-email] Invalid Excel file: ${attachment.filename} - skipping`)
              // Удаляем невалидный файл
              try {
                const fs = await import('fs')
                if (fs.existsSync(tempFilePath)) {
                  fs.unlinkSync(tempFilePath)
                }
              } catch (e) {
                // Ignore cleanup errors
              }
            }
          } catch (error: any) {
            console.error(`[parse-email] Error validating attachment ${attachment.filename}:`, error.message)
            continue
          }
        }
      }

      // Выбираем письмо с самой поздней датой из валидных
      for (const item of validEmails) {
        if (!latestDate || item.date > latestDate) {
          latestEmail = item.email
          latestDate = item.date
        }
      }

      if (!latestEmail) {
        console.log(`[parse-email] No emails with valid Excel attachments found`)
        console.log(`[parse-email] Summary: ${emails.length} emails checked, ${totalAttachments} Excel attachments found, ${validEmails.length} valid attachments`)
        
        let message = `Найдено ${emails.length} писем`
        if (totalAttachments > 0) {
          message += `, ${totalAttachments} Excel вложений найдено, но ни одно не содержит валидных данных`
        } else {
          message += `, но ни одно не содержит Excel вложений`
        }
        
        return NextResponse.json({
          success: true,
          emailsChecked: emails.length,
          attachmentsFound: totalAttachments,
          attachmentsProcessed: 0,
          fabricsCount: 0,
          message,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      console.log(`[parse-email] Selected email with latest date: ${latestDate?.toISOString()}, subject: ${latestEmail.subject}`)

      let totalFabrics = 0
      let processedAttachments = 0
      const errors: string[] = []

      // Process only the latest email with valid Excel attachment
      const email = latestEmail
      try {
        // Find the valid attachment from this email
        const validItem = validEmails.find((item) => item.email === email)
        if (!validItem) {
          throw new Error('Valid attachment not found for selected email')
        }

        // Find the valid attachment
        const attachments = emailParser.extractExcelAttachments(email)
        const validAttachment = attachments.find((att) => att.filename === validItem.attachment.filename)
        
        if (!validAttachment) {
          throw new Error('Valid attachment file not found')
        }

        // Find the file path from validation (it was already saved)
        const attachmentsDir = path.join(process.cwd(), 'data', 'email-attachments', supplier.id)
        
        let filePath: string
        if (fs.existsSync(attachmentsDir)) {
          const files = fs.readdirSync(attachmentsDir)
          const tempFile = files.find((f) => f.includes(validAttachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_')))
          
          if (tempFile) {
            filePath = path.join(attachmentsDir, tempFile)
            // Check if file still exists
            if (fs.existsSync(filePath)) {
              // Now save to database properly
              await prisma.emailAttachment.create({
                data: {
                  supplierId: supplier.id,
                  messageId: email.messageId || `msg_${Date.now()}`,
                  subject: email.subject || null,
                  fromEmail: email.from?.text || null,
                  attachmentName: validAttachment.filename,
                  filePath,
                  processed: false,
                },
              })
            } else {
              // File was deleted, save again
              filePath = await emailParser.saveAttachment(
                supplier.id,
                email,
                validAttachment
              )
            }
          } else {
            // Temp file not found, save again
            filePath = await emailParser.saveAttachment(
              supplier.id,
              email,
              validAttachment
            )
          }
        } else {
          // Directory doesn't exist, save attachment
          filePath = await emailParser.saveAttachment(
            supplier.id,
            email,
            validAttachment
          )
        }

        console.log(`[parse-email] Processing valid Excel file: ${validAttachment.filename}`)

        try {
          // Find the saved attachment record
          const attachmentRecord = await prisma.emailAttachment.findFirst({
            where: {
              supplierId: supplier.id,
              filePath,
              processed: false,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })

          if (!attachmentRecord) {
            console.error(`[parse-email] Attachment record not found for ${filePath}`)
            throw new Error('Attachment record not found')
          }

          // Parse the Excel file
          // Для Аметиста используем AmetistParser, для остальных - EmailExcelParser
          let parser: any
          if (supplier.name === 'Аметист') {
            const { AmetistParser } = await import('@/lib/parsers/ametist-parser')
            parser = new AmetistParser(supplier.id, supplier.name)
          } else {
            parser = new EmailExcelParser(supplier.id, supplier.name)
          }

          // Check if rules exist, if not, analyze and create them
          let rules = await parser.loadRules()
          if (!rules) {
            console.log(`[parse-email] Rules not found, analyzing file...`)
            try {
              const analysis = await parser.analyze(filePath)
              const { createAutoRules } = await import('@/lib/parsers/auto-rules')
              const autoRules = createAutoRules(supplier.name, analysis)
              await parser.saveRules(autoRules)
              rules = autoRules
              console.log(`[parse-email] Rules automatically created`)
            } catch (analysisError: any) {
              console.error(`[parse-email] Error analyzing file:`, analysisError)
              errors.push(`Ошибка анализа файла ${validAttachment.filename}: ${analysisError.message}`)
              throw analysisError
            }
          }

          // Parse fabrics
          const fabrics = await parser.parse(filePath)

          // Save parsed data to Excel
          try {
            await saveParsedDataToExcel(supplier.id, supplier.name, fabrics)
            console.log(`[parse-email] Parsed data saved to Excel`)
          } catch (saveError: any) {
            console.error(`[parse-email] Error saving to Excel:`, saveError)
            // Continue even if Excel save fails
          }

          // Update database
          const { validateDate } = await import('@/lib/date-validation')
          await prisma.$transaction([
            prisma.fabric.deleteMany({
              where: { supplierId: supplier.id },
            }),
            ...fabrics.map((fabric) =>
              prisma.fabric.create({
                data: {
                  ...fabric,
                  supplierId: supplier.id,
                  nextArrivalDate: validateDate(fabric.nextArrivalDate),
                  lastUpdatedAt: new Date(),
                },
              })
            ),
          ])

          // Mark attachment as processed
          await emailParser.markAsProcessed(attachmentRecord.id)

          totalFabrics += fabrics.length
          processedAttachments++

          console.log(`[parse-email] Processed ${fabrics.length} fabrics from ${validAttachment.filename}`)
        } catch (attachmentError: any) {
          console.error(`[parse-email] Error processing attachment:`, attachmentError)
          errors.push(`Ошибка обработки ${validAttachment.filename}: ${attachmentError.message}`)
        }
      } catch (emailError: any) {
        console.error(`[parse-email] Error processing email:`, emailError)
        errors.push(`Ошибка обработки письма: ${emailError.message}`)
      }

      // Update supplier status
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: {
          fabricsCount: totalFabrics,
          lastUpdatedAt: new Date(),
          status: errors.length > 0 ? 'error' : 'active',
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
        },
      })

      const response: any = {
        success: true,
        emailsChecked: emails.length,
        attachmentsProcessed: processedAttachments,
        fabricsCount: totalFabrics,
      }

      if (emails.length === 0) {
        response.message = 'Письма не найдены. Проверьте фильтры и убедитесь, что письма непрочитаны (если включен поиск только непрочитанных).'
        response.searchCriteria = {
          unreadOnly: emailConfig.searchUnreadOnly !== false,
          fromEmail: emailConfig.fromEmail || null,
          subjectFilter: emailConfig.subjectFilter || null,
          searchDays: emailConfig.searchDays || 90,
        }
      }

      if (errors.length > 0) {
        response.errors = errors
      }

      return NextResponse.json(response, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } finally {
      await emailParser.disconnect()
    }
  } catch (error: any) {
    console.error('[parse-email] Error:', error)
    console.error('[parse-email] Error stack:', error.stack)

    // Update supplier status on error
    try {
      await prisma.supplier.update({
        where: { id: params.id },
        data: {
          status: 'error',
          errorMessage: error.message || 'Unknown error',
        },
      })
    } catch (dbError: any) {
      console.error('[parse-email] Failed to update supplier status:', dbError)
    }

    // Ensure we always return JSON, even on errors
    const errorMessage = error.message || 'Failed to parse emails'
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { error: errorMessage, stack: error.stack }
      : { error: errorMessage }

    return NextResponse.json(
      errorDetails,
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

