import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import * as fs from 'fs'
import { ArtvisionParser } from '@/lib/parsers/artvision-parser'
import { SouzmParser } from '@/lib/parsers/souzm-parser'
import { DomiartParser } from '@/lib/parsers/domiart-parser'
import { updateFabricsFromParser } from '@/lib/manual-upload-utils'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

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
        { status: 404 }
      )
    }

    let parser
    
    // Проверяем метод парсинга для email-поставщиков
    // ВАЖНО: Артекс использует URL парсинг, не email!
    if (supplier.parsingMethod === 'email' && supplier.name !== 'Артекс') {
      // For email type, we need to get the latest unprocessed attachment
      const { EmailParser } = await import('@/lib/email/email-parser')
      
      if (!supplier.emailConfig) {
        return NextResponse.json(
          { 
            error: `Email configuration not found for ${supplier.name}. Please configure email settings first.`,
            details: `Use POST /api/suppliers/${supplier.id}/email-config to set up email configuration. Required fields: host, port, user, password, fromEmail (optional), subjectFilter (optional).`,
            endpoint: `/api/suppliers/${supplier.id}/email-config`
          },
          { status: 400 }
        )
      }

      let emailConfig = JSON.parse(supplier.emailConfig)
      console.log(`[parse] Email config for ${supplier.name} (raw):`, JSON.stringify(emailConfig, null, 2))
      
      // Нормализуем структуру emailConfig (конвертируем из вложенной в плоскую, если нужно)
      if (emailConfig.imap && (emailConfig.imap.host || emailConfig.imap.port || emailConfig.imap.user)) {
        // Вложенная структура - конвертируем в плоскую для EmailParser
        console.log(`[parse] Converting nested emailConfig to flat structure`)
        emailConfig = {
          host: emailConfig.imap.host || '',
          port: emailConfig.imap.port || 993,
          user: emailConfig.imap.user || '',
          password: emailConfig.imap.password || '',
          secure: emailConfig.imap.secure !== false,
          fromEmail: emailConfig.fromEmail || '',
          subjectFilter: emailConfig.subjectFilter || '',
          searchDays: emailConfig.searchDays || 90,
          searchUnreadOnly: emailConfig.searchUnreadOnly !== undefined ? emailConfig.searchUnreadOnly : false,
          useAnyLatestAttachment: emailConfig.useAnyLatestAttachment === true,
        }
      }
      
      console.log(`[parse] Email config for ${supplier.name} (normalized):`, JSON.stringify(emailConfig, null, 2))
      const emailParser = new EmailParser(emailConfig)
      
      // На Vercel файлы в /tmp удаляются после завершения функции
      // Поэтому на Vercel всегда получаем письма заново и обрабатываем их сразу
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
      
      // Get attachments - use any latest if configured, otherwise only unprocessed
      // Для Нортекса и других email-поставщиков автоматически используем последнее вложение, если нет необработанных
      // ВАЖНО: Если useAnyLatestAttachment включен, используем последнее вложение (даже обработанное)
      const useAnyLatest = emailConfig.useAnyLatestAttachment === true
      console.log(`[parse] useAnyLatestAttachment from config: ${emailConfig.useAnyLatestAttachment}, useAnyLatest: ${useAnyLatest}`)
      console.log(`[parse] Environment: ${isVercel ? 'Vercel' : 'Local'}`)
      
      let unprocessedFiles: string[] = []
      
      // На Vercel всегда получаем письма заново, так как файлы в /tmp не сохраняются между запросами
      if (isVercel) {
        console.log(`[parse] ⚠️ Vercel environment detected. Will fetch emails fresh on each request (files in /tmp are ephemeral).`)
      } else {
        // Локально сначала пытаемся получить вложения из БД
        unprocessedFiles = await emailParser.getUnprocessedAttachments(supplier.id, useAnyLatest)
        console.log(`[parse] Found ${unprocessedFiles.length} file(s) after getUnprocessedAttachments (useAnyLatest=${useAnyLatest})`)
      }
      
      // Если не найдено вложений, проверяем ситуацию
      if (unprocessedFiles.length === 0) {
        console.log(`[parse] No attachments found with current settings, checking for any attachments...`)
        const totalAttachments = await prisma.emailAttachment.count({
          where: { supplierId: supplier.id },
        })
        
        if (totalAttachments > 0) {
          // Проверяем, существуют ли файлы на диске
          const allAttachments = await prisma.emailAttachment.findMany({
            where: { supplierId: supplier.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { filePath: true, processed: true },
          })
          
          const existingFiles = allAttachments.filter(att => {
            // Проверяем оригинальный путь
            let exists = fs.existsSync(att.filePath)
            
            // Если файл не найден и путь содержит data/email-attachments, пробуем найти в /tmp
            if (!exists && att.filePath.includes('data/email-attachments')) {
              const tmpPath = att.filePath.replace(/.*data\/email-attachments/, '/tmp/email-attachments')
              exists = fs.existsSync(tmpPath)
              if (exists) {
                console.log(`[parse] ✅ File found in /tmp: ${tmpPath} (original: ${att.filePath})`)
                // Обновляем путь для дальнейшего использования
                att.filePath = tmpPath
              }
            }
            
            if (!exists) {
              console.log(`[parse] ⚠️ File not found on disk: ${att.filePath}`)
            }
            return exists
          })
          
          if (existingFiles.length > 0) {
            // Есть файлы на диске - используем последний
            console.log(`[parse] Found ${existingFiles.length} file(s) on disk, using latest one`)
            unprocessedFiles = [existingFiles[0].filePath]
            console.log(`[parse] ✅ Using latest file on disk: ${unprocessedFiles[0]}`)
          } else {
            // Файлы есть в БД, но не существуют на диске - автоматически запускаем Check Email
            const processedCount = await prisma.emailAttachment.count({
              where: { 
                supplierId: supplier.id,
                processed: true,
              },
            })
            console.log(`[parse] ⚠️ Files exist in DB but not on disk. Total: ${totalAttachments}, processed: ${processedCount}`)
            console.log(`[parse] 🔄 Automatically running "Check Email" to fetch new emails...`)
            
            try {
              // Импортируем и вызываем логику parse-email напрямую
              const { EmailParser } = await import('@/lib/email/email-parser')
              const parseEmailParser = new EmailParser(emailConfig)
              await parseEmailParser.connect()
              
              try {
                // Получаем период поиска из конфигурации
                const searchDays = emailConfig.searchDays || 90
                const since = new Date()
                since.setDate(since.getDate() - searchDays)
                
                console.log(`[parse] [auto-check-email] Searching emails from last ${searchDays} days (since ${since.toISOString()})`)
                
                // Получаем новые письма
                let emails = await parseEmailParser.fetchNewEmails(supplier.id, since)
                console.log(`[parse] [auto-check-email] Found ${emails.length} email(s) matching criteria`)
                
                // Если письма не найдены с фильтрами, пробуем без фильтров
                if (emails.length === 0 && (emailConfig.fromEmail || emailConfig.subjectFilter)) {
                  console.log(`[parse] [auto-check-email] ⚠️ No emails found with filters. Trying without filters...`)
                  
                  const emailConfigWithoutFilters = {
                    ...emailConfig,
                    fromEmail: undefined,
                    subjectFilter: undefined,
                  }
                  
                  const emailParserWithoutFilters = new EmailParser(emailConfigWithoutFilters)
                  await emailParserWithoutFilters.connect()
                  
                  try {
                    const emailsWithoutFilters = await emailParserWithoutFilters.fetchNewEmails(supplier.id, since)
                    console.log(`[parse] [auto-check-email] Found ${emailsWithoutFilters.length} email(s) without filters`)
                    
                    if (emailsWithoutFilters.length > 0) {
                      // Фильтруем письма вручную
                      let filteredEmails = emailsWithoutFilters
                      
                      if (emailConfig.fromEmail) {
                        filteredEmails = filteredEmails.filter(email => {
                          const fromText = email.from?.text || email.from?.value?.[0]?.address || ''
                          return fromText.toLowerCase().includes(emailConfig.fromEmail.toLowerCase())
                        })
                        console.log(`[parse] [auto-check-email] After manual fromEmail filter: ${filteredEmails.length} email(s)`)
                      }
                      
                      if (emailConfig.subjectFilter && filteredEmails.length > 0) {
                        filteredEmails = filteredEmails.filter(email => {
                          const subject = email.subject || ''
                          return subject.toLowerCase().includes(emailConfig.subjectFilter.toLowerCase())
                        })
                        console.log(`[parse] [auto-check-email] After manual subjectFilter: ${filteredEmails.length} email(s)`)
                      }
                      
                      if (filteredEmails.length > 0) {
                        emails = filteredEmails
                        console.log(`[parse] [auto-check-email] ✅ Using ${emails.length} email(s) after manual filtering`)
                      }
                    }
                  } finally {
                    await emailParserWithoutFilters.disconnect()
                  }
                }
                
                if (emails.length > 0) {
                  // Сортируем письма по дате (от новых к старым)
                  const sortedEmails = [...emails].sort((a, b) => {
                    const dateA = a.date || new Date(0)
                    const dateB = b.date || new Date(0)
                    return dateB.getTime() - dateA.getTime()
                  })
                  
                  // Ищем письмо с валидным Excel вложением
                  let latestEmail: any = null
                  let validAttachment: any = null
                  
                  for (const email of sortedEmails) {
                    const attachments = parseEmailParser.extractExcelAttachments(email)
                    if (attachments.length > 0) {
                      // Проверяем валидность первого вложения
                      const tempFilePath = await parseEmailParser.saveAttachment(
                        supplier.id,
                        email,
                        attachments[0],
                        true // skipDatabase = true
                      )
                      
                      // Валидация файла - используем правильный парсер в зависимости от поставщика
                      let isValid = false
                      if (supplier.name === 'Аметист') {
                        const { AmetistParser } = await import('@/lib/parsers/ametist-parser')
                        const validator = new AmetistParser(supplier.id, supplier.name)
                        isValid = await validator.validateFile(tempFilePath)
                      } else {
                        const { EmailExcelParser } = await import('@/lib/parsers/email-excel-parser')
                        const validator = new EmailExcelParser(supplier.id, supplier.name)
                        isValid = await validator.validateFile(tempFilePath)
                      }
                      
                      if (isValid) {
                        latestEmail = email
                        validAttachment = attachments[0]
                        // Удаляем временный файл
                        if (fs.existsSync(tempFilePath)) {
                          fs.unlinkSync(tempFilePath)
                        }
                        break
                      } else {
                        // Удаляем невалидный файл
                        if (fs.existsSync(tempFilePath)) {
                          fs.unlinkSync(tempFilePath)
                        }
                      }
                    }
                  }
                  
                  if (latestEmail && validAttachment) {
                    // Сохраняем вложение в БД
                    const filePath = await parseEmailParser.saveAttachment(
                      supplier.id,
                      latestEmail,
                      validAttachment
                    )
                    
                    console.log(`[parse] [auto-check-email] ✅ Successfully fetched new email attachment: ${validAttachment.filename}`)
                    
                    // Теперь пытаемся получить файлы снова
                    unprocessedFiles = await emailParser.getUnprocessedAttachments(supplier.id, true)
                    console.log(`[parse] [auto-check-email] Found ${unprocessedFiles.length} file(s) after auto-check-email`)
                    
                    if (unprocessedFiles.length === 0) {
                      console.log(`[parse] [auto-check-email] ⚠️ Still no files found after auto-check-email`)
                    }
                  } else {
                    console.log(`[parse] [auto-check-email] ⚠️ No valid Excel attachments found in emails`)
                  }
                } else {
                  console.log(`[parse] [auto-check-email] ⚠️ No emails found matching criteria`)
                }
              } finally {
                await parseEmailParser.disconnect()
              }
            } catch (checkEmailError: any) {
              console.error(`[parse] [auto-check-email] Error during auto-check-email:`, checkEmailError)
              // Не прерываем выполнение, продолжаем с ошибкой
            }
            
            // Если после автоматической проверки файлы все еще не найдены
            if (unprocessedFiles.length === 0) {
              return NextResponse.json(
                { 
                  error: `Email attachments found in database but files are missing on disk. Attempted to fetch new emails automatically but no valid attachments found. Total attachments: ${totalAttachments}, processed: ${processedCount}. Please check email settings and try again.`
                },
                { status: 400 }
              )
            }
          }
        }
      }
      
      if (unprocessedFiles.length === 0) {
        // Check if there are any attachments at all in the database
        const totalAttachments = await prisma.emailAttachment.count({
          where: { supplierId: supplier.id },
        })
        
        // Если файлов нет в БД (или мы на Vercel), автоматически пытаемся запустить parse-email
        // На Vercel всегда получаем письма заново, так как файлы в /tmp не сохраняются между запросами
        if (totalAttachments === 0 || isVercel) {
          if (isVercel) {
            console.log(`[parse] ⚠️ Vercel environment: Always fetching emails fresh (files in /tmp are ephemeral)`)
          } else {
            console.log(`[parse] ⚠️ No email attachments in database. Automatically running "Check Email" to fetch emails...`)
          }
          
          try {
            // Импортируем и вызываем логику parse-email напрямую
            const { EmailParser } = await import('@/lib/email/email-parser')
            const parseEmailParser = new EmailParser(emailConfig)
            await parseEmailParser.connect()
            
            try {
              // Получаем период поиска из конфигурации
              const searchDays = emailConfig.searchDays || 90
              const since = new Date()
              since.setDate(since.getDate() - searchDays)
              
              console.log(`[parse] [auto-check-email] Searching emails from last ${searchDays} days (since ${since.toISOString()})`)
              
              // Получаем новые письма
              let emails = await parseEmailParser.fetchNewEmails(supplier.id, since)
              console.log(`[parse] [auto-check-email] Found ${emails.length} email(s) matching criteria`)
              
              // Если письма не найдены с фильтрами, пробуем без фильтров (fallback)
              if (emails.length === 0 && (emailConfig.fromEmail || emailConfig.subjectFilter)) {
                console.log(`[parse] [auto-check-email] ⚠️ No emails found with filters. Trying without filters (fallback)...`)
                
                const emailConfigWithoutFilters = {
                  ...emailConfig,
                  fromEmail: undefined,
                  subjectFilter: undefined,
                }
                
                const emailParserWithoutFilters = new EmailParser(emailConfigWithoutFilters)
                await emailParserWithoutFilters.connect()
                
                try {
                  const emailsWithoutFilters = await emailParserWithoutFilters.fetchNewEmails(supplier.id, since)
                  console.log(`[parse] [auto-check-email] Found ${emailsWithoutFilters.length} email(s) without filters`)
                  
                  if (emailsWithoutFilters.length > 0) {
                    // Фильтруем письма вручную по fromEmail и subjectFilter
                    let filteredEmails = emailsWithoutFilters
                    
                    if (emailConfig.fromEmail) {
                      filteredEmails = filteredEmails.filter(email => {
                        const fromText = email.from?.text || email.from?.value?.[0]?.address || ''
                        return fromText.toLowerCase().includes(emailConfig.fromEmail.toLowerCase())
                      })
                      console.log(`[parse] [auto-check-email] After manual fromEmail filter: ${filteredEmails.length} email(s)`)
                    }
                    
                    if (emailConfig.subjectFilter && filteredEmails.length > 0) {
                      filteredEmails = filteredEmails.filter(email => {
                        const subject = email.subject || ''
                        return subject.toLowerCase().includes(emailConfig.subjectFilter.toLowerCase())
                      })
                      console.log(`[parse] [auto-check-email] After manual subjectFilter: ${filteredEmails.length} email(s)`)
                    }
                    
                    if (filteredEmails.length > 0) {
                      console.log(`[parse] [auto-check-email] ✅ Found ${filteredEmails.length} email(s) after manual filtering`)
                      emails = filteredEmails
                    } else {
                      console.log(`[parse] [auto-check-email] ⚠️ No emails match filters even after manual filtering`)
                    }
                  }
                } finally {
                  await emailParserWithoutFilters.disconnect()
                }
              }
              
              if (emails.length > 0) {
                // Сортируем письма по дате (от новых к старым)
                const sortedEmails = [...emails].sort((a, b) => {
                  const dateA = a.date || new Date(0)
                  const dateB = b.date || new Date(0)
                  return dateB.getTime() - dateA.getTime()
                })
                
                // Ищем письмо с валидным Excel вложением
                let latestEmail: any = null
                let validAttachment: any = null
                
                for (const email of sortedEmails) {
                  const attachments = parseEmailParser.extractExcelAttachments(email)
                  if (attachments.length > 0) {
                    // Проверяем валидность первого вложения
                    const tempFilePath = await parseEmailParser.saveAttachment(
                      supplier.id,
                      email,
                      attachments[0],
                      true // skipDatabase = true
                    )
                    
                    // Валидация файла - используем правильный парсер в зависимости от поставщика
                    let isValid = false
                    if (supplier.name === 'Аметист') {
                      const { AmetistParser } = await import('@/lib/parsers/ametist-parser')
                      const validator = new AmetistParser(supplier.id, supplier.name)
                      isValid = await validator.validateFile(tempFilePath)
                    } else {
                      const { EmailExcelParser } = await import('@/lib/parsers/email-excel-parser')
                      const validator = new EmailExcelParser(supplier.id, supplier.name)
                      isValid = await validator.validateFile(tempFilePath)
                    }
                    
                    if (isValid) {
                      latestEmail = email
                      validAttachment = attachments[0]
                      // Удаляем временный файл
                      if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath)
                      }
                      break
                    } else {
                      // Удаляем невалидный файл
                      if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath)
                      }
                    }
                  }
                }
                
                if (latestEmail && validAttachment) {
                  // Сохраняем вложение в БД (на Vercel файл будет в /tmp, но путь сохраним в БД)
                  const filePath = await parseEmailParser.saveAttachment(
                    supplier.id,
                    latestEmail,
                    validAttachment
                  )
                  
                  console.log(`[parse] [auto-check-email] ✅ Successfully fetched new email attachment: ${validAttachment.filename}`)
                  console.log(`[parse] [auto-check-email] File saved to: ${filePath}`)
                  
                  // На Vercel используем файл сразу, так как он будет удален после завершения функции
                  // Локально можем получить файлы через getUnprocessedAttachments
                  if (isVercel) {
                    // На Vercel используем файл напрямую
                    unprocessedFiles = [filePath]
                    console.log(`[parse] [auto-check-email] Vercel: Using file directly: ${filePath}`)
                  } else {
                    // Локально получаем файлы через getUnprocessedAttachments
                    unprocessedFiles = await emailParser.getUnprocessedAttachments(supplier.id, true)
                    console.log(`[parse] [auto-check-email] Found ${unprocessedFiles.length} file(s) after auto-check-email`)
                    
                    if (unprocessedFiles.length === 0) {
                      console.log(`[parse] [auto-check-email] ⚠️ Still no files found after auto-check-email, using direct path`)
                      unprocessedFiles = [filePath]
                    }
                  }
                } else {
                  console.log(`[parse] [auto-check-email] ⚠️ No valid Excel attachments found in emails`)
                }
              } else {
                console.log(`[parse] [auto-check-email] ⚠️ No emails found matching criteria`)
              }
            } finally {
              await parseEmailParser.disconnect()
            }
          } catch (checkEmailError: any) {
            console.error(`[parse] [auto-check-email] Error during auto-check-email:`, checkEmailError)
            // Не прерываем выполнение, продолжаем с ошибкой
          }
        }
        
        // Если после автоматической проверки файлы все еще не найдены
        if (unprocessedFiles.length === 0) {
          const totalAttachmentsAfter = await prisma.emailAttachment.count({
            where: { supplierId: supplier.id },
          })
          
          let message: string
          if (totalAttachmentsAfter === 0) {
            message = `No email attachments found. Automatically attempted to fetch emails but found none. Please check:\n1. Email configuration is correct (use /api/suppliers/${supplier.id}/email-config)\n2. Email account has access to incoming emails\n3. Emails from the supplier exist in the mailbox\n4. Email filters (fromEmail, subjectFilter) are correct`
          } else {
            const processedCount = await prisma.emailAttachment.count({
              where: { 
                supplierId: supplier.id,
                processed: true,
              },
            })
            message = `No unprocessed email attachments found. Total attachments in DB: ${totalAttachmentsAfter}, processed: ${processedCount}. Please run "Check Email" (POST /api/suppliers/${supplier.id}/parse-email) to fetch new emails or enable "Use any latest attachment" in email settings.`
          }
          
          console.log(`[parse] ${message}`)
          return NextResponse.json(
            { error: message },
            { status: 400 }
          )
        }
      }

      // Use the most recent file
      const filePath = unprocessedFiles[0]
      
      // Выбираем парсер в зависимости от поставщика
      if (supplier.name === 'Аметист') {
        const { AmetistParser } = await import('@/lib/parsers/ametist-parser')
        parser = new AmetistParser(supplier.id, supplier.name)
      } else {
        const { EmailExcelParser } = await import('@/lib/parsers/email-excel-parser')
        parser = new EmailExcelParser(supplier.id, supplier.name)
      }
      
      // Store file path for later use
      ;(parser as any).filePath = filePath
    } else {
      // Для остальных поставщиков используем switch по имени
      switch (supplier.name) {
        case 'Artvision':
          parser = new ArtvisionParser(supplier.id, supplier.name)
          break
        case 'Союз-М':
          parser = new SouzmParser(supplier.id, supplier.name)
          break
        case 'Домиарт':
          parser = new DomiartParser(supplier.id, supplier.name)
          break
        case 'Артекс':
          const { ArteksParser } = await import('@/lib/parsers/arteks-parser')
          parser = new ArteksParser(supplier.id, supplier.name)
          break
        case 'TextileData':
          const { TextileDataParser } = await import('@/lib/parsers/textiledata-parser')
          parser = new TextileDataParser(supplier.id, supplier.name)
          break
        case 'NoFrames':
          const { NoFramesParser } = await import('@/lib/parsers/noframes-parser')
          parser = new NoFramesParser(supplier.id, supplier.name)
          break
        case 'Tex.Group':
        case 'Fancy Fabric':
          const { TexGroupParser } = await import('@/lib/parsers/texgroup-parser')
          parser = new TexGroupParser(supplier.id, supplier.name)
          break
        case 'Vektor':
          const { VektorParser } = await import('@/lib/parsers/vektor-parser')
          parser = new VektorParser(supplier.id, supplier.name)
          break
        case 'TextileNova':
          const { TextileNovaParser } = await import('@/lib/parsers/textilenova-parser')
          parser = new TextileNovaParser(supplier.id, supplier.name)
          break
        case 'Viptextil':
          const { ViptextilParser } = await import('@/lib/parsers/viptextil-parser')
          parser = new ViptextilParser(supplier.id, supplier.name)
          break
        case 'Artefact':
          const { ArtefactParser } = await import('@/lib/parsers/artefact-parser')
          parser = new ArtefactParser(supplier.id, supplier.name)
          break
        case 'Эгида':
          const { EgidaParser } = await import('@/lib/parsers/egida-parser')
          parser = new EgidaParser(supplier.id, supplier.name)
          break
        default:
          return NextResponse.json(
            { error: 'Unknown supplier' },
            { status: 400 }
          )
      }
    }

    // Проверяем наличие правил парсинга
    const rules = await parser.loadRules()
    if (!rules) {
      console.log(`[parse] Правила не найдены для ${supplier.name}, проводим автоматический анализ...`)
      // Автоматически проводим анализ и создаем правила
      try {
        // For email type, analyze method is already overridden to use file path
        // For other types, use parsingUrl
        const analysis = supplier.parsingMethod === 'email'
          ? await (parser as any).analyze((parser as any).filePath)
          : await parser.analyze(supplier.parsingUrl)
        const { createAutoRules } = await import('@/lib/parsers/auto-rules')
        const autoRules = createAutoRules(supplier.name, analysis)
        await parser.saveRules(autoRules)
        console.log(`[parse] Правила автоматически созданы для ${supplier.name}`)
      } catch (analysisError: any) {
        console.error(`[parse] Ошибка анализа для ${supplier.name}:`, analysisError)
        
        // Более детальное сообщение об ошибке
        let errorMessage = 'Не удалось автоматически создать правила парсинга. '
        let suggestion = ''
        
        if (analysisError.message?.includes('timeout') || analysisError.message?.includes('ECONNABORTED')) {
          errorMessage += 'Превышено время ожидания при загрузке файла.'
          suggestion = 'Проверьте доступность URL и скорость интернет-соединения.'
        } else if (analysisError.message?.includes('404') || analysisError.message?.includes('not found')) {
          errorMessage += 'Файл не найден по указанному URL.'
          suggestion = 'Проверьте правильность URL в настройках поставщика. Возможно, файл был перемещен или удален.'
        } else if (analysisError.message?.includes('parse') || analysisError.message?.includes('invalid')) {
          errorMessage += 'Не удалось распарсить файл.'
          suggestion = 'Возможно, изменилась структура файла. Проведите анализ вручную через /api/suppliers/' + supplier.id + '/analyze'
        } else {
          errorMessage += analysisError.message || 'Неизвестная ошибка.'
          suggestion = 'Проведите анализ вручную через /api/suppliers/' + supplier.id + '/analyze'
        }
        
        return NextResponse.json(
          { 
            error: errorMessage,
            suggestion: suggestion,
            details: analysisError.message,
            endpoint: `/api/suppliers/${supplier.id}/analyze`
          },
          { status: 400 }
        )
      }
    } else {
      console.log(`[parse] Правила найдены для ${supplier.name}`)
    }

    // For email type, use stored file path
    // For other types, use parsingUrl
    console.log(`[parse] ════════════════════════════════════════════════════════`)
    console.log(`[parse] Запуск парсера для ${supplier.name}`)
    console.log(`[parse] Метод парсинга: ${supplier.parsingMethod}`)
    console.log(`[parse] URL/путь: ${supplier.parsingMethod === 'email' ? (parser as any).filePath : supplier.parsingUrl}`)
    
    const fabrics = supplier.parsingMethod === 'email' 
      ? await (parser as any).parse((parser as any).filePath)
      : await parser.parse(supplier.parsingUrl)
    
    console.log(`[parse] ════════════════════════════════════════════════════════`)
    console.log(`[parse] Парсер завершил работу для ${supplier.name}`)
    console.log(`[parse] Парсер вернул ${fabrics.length} тканей`)
    
    if (fabrics.length === 0) {
      console.log(`[parse] ⚠️ КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ: Парсер вернул 0 тканей!`)
      console.log(`[parse] Проверьте логи парсера выше на наличие ошибок или проблем с парсингом`)
    } else {
      console.log(`[parse] ✅ Парсер успешно нашел ${fabrics.length} тканей`)
      console.log(`[parse] Примеры найденных тканей (первые 5):`)
      fabrics.slice(0, 5).forEach((f: any, i: number) => {
        console.log(`[parse]   ${i + 1}. "${f.collection}" | "${f.colorNumber}" | в наличии: ${f.inStock} | метраж: ${f.meterage || 'нет'} | цена: ${f.price || 'нет'}`)
      })
    }
    console.log(`[parse] ════════════════════════════════════════════════════════`)

    // Сохраняем распарсенные данные в Excel файл
    try {
      const { saveParsedDataToExcel } = await import('@/lib/parsers/save-parsed-data')
      await saveParsedDataToExcel(supplier.id, supplier.name, fabrics)
      console.log(`[parse] Данные сохранены в Excel для ${supplier.name}`)
    } catch (saveError: any) {
      console.error(`[parse] Ошибка сохранения в Excel для ${supplier.name}:`, saveError)
      // Не прерываем выполнение, если не удалось сохранить в Excel
    }

    // Обновляем ткани, учитывая ручные загрузки
    console.log(`[parse] ════════════════════════════════════════════════════════`)
    console.log(`[parse] Запуск updateFabricsFromParser для ${supplier.name}`)
    console.log(`[parse] Тканей для обработки: ${fabrics.length}`)
    
    const updatedCount = await updateFabricsFromParser(supplier.id, fabrics)
    
    console.log(`[parse] updateFabricsFromParser завершил работу`)
    console.log(`[parse] Обновлено/создано тканей: ${updatedCount}`)
    console.log(`[parse] ════════════════════════════════════════════════════════`)

    // Получаем актуальное количество тканей
    const fabricsCount = await prisma.fabric.count({
      where: { supplierId: supplier.id },
    })
    
    console.log(`[parse] Актуальное количество тканей в базе для ${supplier.name}: ${fabricsCount}`)

    // Обновляем информацию о поставщике
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        fabricsCount,
        // lastParsedCount: fabrics.length, // Временно отключено до перегенерации Prisma Client
        lastUpdatedAt: new Date(),
        status: 'active',
        errorMessage: null,
      },
    })

    return NextResponse.json({
      success: true,
      fabricsCount: fabrics.length,
      updatedCount: updatedCount,
      message: `Парсер нашел ${fabrics.length} тканей, обновлено/создано: ${updatedCount}`,
    })
  } catch (error: any) {
    console.error('Error parsing supplier:', error)
    
    // Обновляем статус поставщика при ошибке
    await prisma.supplier.update({
      where: { id: params.id },
      data: {
        status: 'error',
        errorMessage: error.message || 'Unknown error',
      },
    })

    return NextResponse.json(
      { error: error.message || 'Failed to parse supplier' },
      { status: 500 }
    )
  }
}

