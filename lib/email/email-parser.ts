import Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/db/prisma'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean // true for SSL/TLS
  user: string
  password: string
  fromEmail?: string // Email address to filter by
  subjectFilter?: string // Subject filter (optional)
  searchUnreadOnly?: boolean // Search only unread emails (default: false)
  searchDays?: number // Number of days to search back (default: 90)
  useAnyLatestAttachment?: boolean // Use any latest attachment (processed or not) instead of only unprocessed (default: false)
}

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
  size?: number
}

export class EmailParser {
  private config: EmailConfig
  private imap: Imap | null = null

  constructor(config: EmailConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.secure,
        tlsOptions: { rejectUnauthorized: false },
      })

      this.imap.once('ready', () => {
        console.log('[EmailParser] Connected to IMAP server')
        resolve()
      })

      this.imap.once('error', (err: Error) => {
        console.error('[EmailParser] IMAP error:', err)
        reject(err)
      })

      this.imap.connect()
    })
  }

  async disconnect(): Promise<void> {
    if (this.imap) {
      this.imap.end()
      this.imap = null
    }
  }

  async fetchNewEmails(supplierId: string, since?: Date): Promise<ParsedMail[]> {
    if (!this.imap) {
      throw new Error('Not connected to IMAP server')
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err)
          return
        }

        console.log(`[EmailParser] Opened INBOX. Total messages: ${box.messages.total}`)

        // Build search criteria
        const searchCriteria: any[] = []
        
        // Only search unread if configured (default: false to search all emails)
        // Changed default to false because emails might be auto-read by email client
        const searchUnreadOnly = this.config.searchUnreadOnly === true
        if (searchUnreadOnly) {
          searchCriteria.push('UNSEEN')
          console.log(`[EmailParser] Searching for UNSEEN emails only`)
        } else {
          console.log(`[EmailParser] Searching for ALL emails (including read)`)
        }

        if (since) {
          searchCriteria.push(['SINCE', since])
          console.log(`[EmailParser] Date filter: since ${since.toISOString()}`)
        }

        if (this.config.fromEmail) {
          searchCriteria.push(['FROM', this.config.fromEmail])
          console.log(`[EmailParser] From filter: ${this.config.fromEmail}`)
        }

        if (this.config.subjectFilter) {
          searchCriteria.push(['SUBJECT', this.config.subjectFilter])
          console.log(`[EmailParser] Subject filter: ${this.config.subjectFilter}`)
        }

        console.log(`[EmailParser] Search criteria:`, JSON.stringify(searchCriteria))

        this.imap!.search(searchCriteria, (err, results) => {
          if (err) {
            console.error(`[EmailParser] Search error:`, err)
            reject(err)
            return
          }

          console.log(`[EmailParser] Search returned ${results?.length || 0} message(s)`)

          if (!results || results.length === 0) {
            console.log(`[EmailParser] No emails found matching criteria`)
            resolve([])
            return
          }

          const fetch = this.imap!.fetch(results, {
            bodies: '',
            struct: true,
          })

          const emails: ParsedMail[] = []
          let emailCount = 0

          fetch.on('message', (msg, seqno) => {
            let emailBuffer = Buffer.alloc(0)

            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                emailBuffer = Buffer.concat([emailBuffer, chunk])
              })
            })

            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(emailBuffer)
                emails.push(parsed)
                emailCount++

                if (emailCount === results.length) {
                  resolve(emails)
                }
              } catch (parseErr) {
                console.error(`[EmailParser] Error parsing email ${seqno}:`, parseErr)
                emailCount++

                if (emailCount === results.length) {
                  resolve(emails)
                }
              }
            })
          })

          fetch.once('error', (err) => {
            reject(err)
          })
        })
      })
    })
  }

  extractExcelAttachments(email: ParsedMail): EmailAttachment[] {
    const excelAttachments: EmailAttachment[] = []

    if (!email.attachments || email.attachments.length === 0) {
      console.log(`[EmailParser] Email has no attachments`)
      return excelAttachments
    }

    console.log(`[EmailParser] Email has ${email.attachments.length} attachment(s)`)

    for (const attachment of email.attachments) {
      const contentType = attachment.contentType || ''
      const filename = attachment.filename || ''
      const size = attachment.size || (attachment.content ? (attachment.content as Buffer).length : 0)

      console.log(`[EmailParser] Checking attachment: "${filename}", contentType: "${contentType}", size: ${size} bytes`)

      // Check if it's an Excel file or ZIP archive
      const isExcel = 
        contentType.includes('spreadsheet') ||
        contentType.includes('excel') ||
        contentType.includes('application/vnd.ms-excel') ||
        contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
        filename.endsWith('.xls') ||
        filename.endsWith('.xlsx') ||
        filename.endsWith('.XLS') ||
        filename.endsWith('.XLSX')
      
      const isZip = 
        contentType.includes('zip') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/x-zip-compressed') ||
        filename.endsWith('.zip') ||
        filename.endsWith('.ZIP')

      if (isExcel || isZip) {
        const fileType = isExcel ? 'Excel' : 'ZIP'
        console.log(`[EmailParser] Found ${fileType} attachment: "${filename}"`)
        excelAttachments.push({
          filename: filename,
          content: attachment.content as Buffer,
          contentType: contentType,
          size: size,
        })
      } else {
        console.log(`[EmailParser] Skipping non-Excel/ZIP attachment: "${filename}"`)
      }
    }

    console.log(`[EmailParser] Total Excel attachments found: ${excelAttachments.length}`)
    return excelAttachments
  }

  async saveAttachment(
    supplierId: string,
    email: ParsedMail,
    attachment: EmailAttachment,
    skipDatabase?: boolean
  ): Promise<string> {
    // Create directory for email attachments
    const attachmentsDir = path.join(process.cwd(), 'data', 'email-attachments', supplierId)
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = path.join(attachmentsDir, `${timestamp}_${safeFilename}`)

    // Save file
    fs.writeFileSync(filePath, attachment.content)

    // Save to database only if not skipped (for validation phase)
    if (!skipDatabase) {
      await prisma.emailAttachment.create({
        data: {
          supplierId,
          messageId: email.messageId || `msg_${timestamp}`,
          subject: email.subject || null,
          fromEmail: email.from?.text || null,
          attachmentName: attachment.filename,
          filePath,
          processed: false,
        },
      })
    }

    console.log(`[EmailParser] Saved attachment: ${filePath}`)
    return filePath
  }

  async markAsProcessed(attachmentId: string): Promise<void> {
    await prisma.emailAttachment.update({
      where: { id: attachmentId },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    })
  }

  async getUnprocessedAttachments(supplierId: string, useAnyLatest?: boolean): Promise<string[]> {
    // If useAnyLatest is true, get the latest attachment regardless of processed status
    // Otherwise, get only unprocessed attachments
    console.log(`[EmailParser] getUnprocessedAttachments called for supplierId: ${supplierId}, useAnyLatest: ${useAnyLatest}`)
    
    // First, check total count of attachments for this supplier
    const totalCount = await prisma.emailAttachment.count({
      where: { supplierId },
    })
    const unprocessedCount = await prisma.emailAttachment.count({
      where: { 
        supplierId,
        processed: false,
      },
    })
    const processedCount = await prisma.emailAttachment.count({
      where: { 
        supplierId,
        processed: true,
      },
    })
    
    console.log(`[EmailParser] Total attachments in DB: ${totalCount}, unprocessed: ${unprocessedCount}, processed: ${processedCount}`)
    
    const whereClause: any = {
      supplierId,
    }

    if (!useAnyLatest) {
      whereClause.processed = false
    }

    const attachments = await prisma.emailAttachment.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      take: useAnyLatest ? 1 : undefined, // If using latest, only get one
      select: {
        id: true,
        filePath: true,
        processed: true,
        createdAt: true,
      },
    })

    console.log(`[EmailParser] Found ${attachments.length} attachment(s) matching criteria`)
    if (attachments.length > 0) {
      attachments.forEach((a, idx) => {
        console.log(`[EmailParser]   ${idx + 1}. ${a.filePath}, processed: ${a.processed}, createdAt: ${a.createdAt}`)
      })
    }

    // Check file existence
    console.log(`[EmailParser] Checking file existence for ${attachments.length} attachment(s)...`)
    const existingFiles = attachments.map((a) => {
      const exists = fs.existsSync(a.filePath)
      console.log(`[EmailParser] Attachment: ${a.filePath}, exists: ${exists}, processed: ${a.processed}, createdAt: ${a.createdAt}`)
      return { path: a.filePath, exists, attachment: a }
    }).filter((item) => {
      if (!item.exists) {
        console.log(`[EmailParser] ⚠️ File not found on disk: ${item.path}`)
      }
      return item.exists
    }).map(item => item.path)
    
    console.log(`[EmailParser] ${existingFiles.length} file(s) exist on disk out of ${attachments.length} attachment(s)`)
    
    if (existingFiles.length === 0 && totalCount > 0) {
      console.log(`[EmailParser] ⚠️ WARNING: Found ${totalCount} attachment(s) in DB, but none exist on disk!`)
      console.log(`[EmailParser] useAnyLatest: ${useAnyLatest}, unprocessed: ${unprocessedCount}, processed: ${processedCount}`)
      
      // Логируем детали о файлах в БД
      const allAttachments = await prisma.emailAttachment.findMany({
        where: { supplierId },
        select: {
          id: true,
          filePath: true,
          processed: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
      
      console.log(`[EmailParser] Sample attachments from DB (first 5):`)
      allAttachments.forEach((att, idx) => {
        const exists = fs.existsSync(att.filePath)
        console.log(`[EmailParser]   ${idx + 1}. ${att.filePath}, exists: ${exists}, processed: ${att.processed}, createdAt: ${att.createdAt}`)
      })
      
      if (useAnyLatest && processedCount > 0) {
        console.log(`[EmailParser] ⚠️ CRITICAL: useAnyLatest=true but no files exist on disk! Files may have been deleted. Need to run /parse-email to fetch new emails.`)
      } else if (!useAnyLatest && unprocessedCount === 0 && processedCount > 0) {
        console.log(`[EmailParser] 💡 Suggestion: All attachments are marked as processed. Consider enabling "Use any latest attachment" or run /parse-email to fetch new emails.`)
      }
    }

    return existingFiles
  }
}

