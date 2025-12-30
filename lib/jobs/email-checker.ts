import { prisma } from '@/lib/db/prisma'
import { EmailParser, EmailConfig } from '@/lib/email/email-parser'
import { EmailExcelParser } from '@/lib/parsers/email-excel-parser'
import { saveParsedDataToExcel } from '@/lib/parsers/save-parsed-data'
import { ParsedMail } from 'mailparser'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Проверяет email для всех поставщиков с типом "email"
 * Вызывается по расписанию (каждые 30-60 минут)
 */
export async function checkSupplierEmails(): Promise<void> {
  console.log('[EmailChecker] Starting email check for all suppliers...')

  try {
    // Получаем всех поставщиков с типом "email"
    const suppliers = await prisma.supplier.findMany({
      where: {
        parsingMethod: 'email',
        emailConfig: {
          not: null,
        },
      },
    })

    console.log(`[EmailChecker] Found ${suppliers.length} suppliers with email configuration`)

    for (const supplier of suppliers) {
      if (!supplier.emailConfig) {
        console.log(`[EmailChecker] Skipping ${supplier.name} - no email config`)
        continue
      }

      try {
        console.log(`[EmailChecker] Checking emails for supplier: ${supplier.name}`)

        // Parse email configuration
        const emailConfig: EmailConfig = JSON.parse(supplier.emailConfig)

        // Connect to email server
        const emailParser = new EmailParser(emailConfig)
        await emailParser.connect()

        try {
          // Fetch emails (configurable number of days, default 90)
          const searchDays = emailConfig.searchDays || 90
          const since = new Date()
          since.setDate(since.getDate() - searchDays)

          const emails = await emailParser.fetchNewEmails(supplier.id, since)
          console.log(`[EmailChecker] Found ${emails.length} email(s) for ${supplier.name}`)

          if (emails.length === 0) {
            continue
          }

          // Find email with the latest date that has valid Excel attachments
          let latestEmail: ParsedMail | null = null
          let latestDate: Date | null = null
          let validEmails: Array<{ email: ParsedMail; date: Date; attachment: any }> = []

          console.log(`[EmailChecker] Checking ${emails.length} emails for valid Excel attachments...`)

          for (const email of emails) {
            const attachments = emailParser.extractExcelAttachments(email)
            if (attachments.length === 0) {
              continue
            }

            console.log(`[EmailChecker] Checking email from ${email.date?.toISOString()}, subject: ${email.subject}, attachments: ${attachments.length}`)

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
                const parser = new EmailExcelParser(supplier.id, supplier.name)
                const isValid = await parser.validateFile(tempFilePath)

                if (isValid) {
                  const emailDate = email.date || new Date(0)
                  validEmails.push({
                    email,
                    date: emailDate,
                    attachment,
                  })
                  console.log(`[EmailChecker] Valid Excel file found: ${attachment.filename}, date: ${emailDate.toISOString()}`)
                  // Используем первое валидное вложение из письма
                  break
                } else {
                  console.log(`[EmailChecker] Invalid Excel file: ${attachment.filename} - skipping`)
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
                console.error(`[EmailChecker] Error validating attachment ${attachment.filename}:`, error.message)
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
            console.log(
              `[EmailChecker] No emails with valid Excel attachments found for ${supplier.name}`
            )
            continue
          }

          console.log(
            `[EmailChecker] Selected email with latest date: ${latestDate?.toISOString()}, subject: ${latestEmail.subject}`
          )

          // Process only the latest email with valid Excel attachment
          try {
            const email = latestEmail
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
              const tempFile = files.find((f: string) => f.includes(validAttachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_')))
              
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

            console.log(`[EmailChecker] Processing valid Excel file: ${validAttachment.filename}`)

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
                    console.error(
                      `[EmailChecker] Attachment record not found for ${filePath}`
                    )
                    continue
                  }

                  // Parse the Excel file
                  const parser = new EmailExcelParser(supplier.id, supplier.name)

                  // Check if rules exist, if not, analyze and create them
                  let rules = await parser.loadRules()
                  if (!rules) {
                    console.log(
                      `[EmailChecker] Rules not found for ${supplier.name}, analyzing file...`
                    )
                    try {
                      const analysis = await parser.analyze(filePath)
                      const { createAutoRules } = await import('@/lib/parsers/auto-rules')
                      const autoRules = createAutoRules(supplier.name, analysis)
                      await parser.saveRules(autoRules)
                      rules = autoRules
                      console.log(
                        `[EmailChecker] Rules automatically created for ${supplier.name}`
                      )
                    } catch (analysisError: any) {
                      console.error(
                        `[EmailChecker] Error analyzing file for ${supplier.name}:`,
                        analysisError
                      )
                      continue
                    }
                  }

                  // Parse fabrics
                  const fabrics = await parser.parse(filePath)

                  // Save parsed data to Excel
                  try {
                    await saveParsedDataToExcel(supplier.id, supplier.name, fabrics)
                    console.log(
                      `[EmailChecker] Parsed data saved to Excel for ${supplier.name}`
                    )
                  } catch (saveError: any) {
                    console.error(
                      `[EmailChecker] Error saving to Excel for ${supplier.name}:`,
                      saveError
                    )
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

            console.log(
              `[EmailChecker] Processed ${fabrics.length} fabrics from ${validAttachment.filename} for ${supplier.name}`
            )
          } catch (attachmentError: any) {
            console.error(
              `[EmailChecker] Error processing attachment for ${supplier.name}:`,
              attachmentError
            )
          }

          // Update supplier status
          await prisma.supplier.update({
            where: { id: supplier.id },
            data: {
              lastUpdatedAt: new Date(),
              status: 'active',
              errorMessage: null,
            },
          })

          console.log(`[EmailChecker] Successfully processed emails for ${supplier.name}`)
        } finally {
          await emailParser.disconnect()
        }
      } catch (error: any) {
        console.error(`[EmailChecker] Error processing supplier ${supplier.name}:`, error)

        // Update supplier status on error
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            status: 'error',
            errorMessage: error.message || 'Unknown error',
          },
        })
      }
    }

    console.log('[EmailChecker] Email check completed')
  } catch (error: any) {
    console.error('[EmailChecker] Fatal error:', error)
    throw error
  }
}

