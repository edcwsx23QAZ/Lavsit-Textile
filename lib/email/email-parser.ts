import Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean // true for SSL/TLS
  user: string
  password: string
  fromEmail?: string // Email address to filter by
  subjectFilter?: string // Subject filter (optional)
  searchUnreadOnly?: boolean // Search only unread emails (default: true)
  searchDays?: number // Number of days to search back (default: 7)
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

  async getUnprocessedAttachments(supplierId: string): Promise<string[]> {
    const attachments = await prisma.emailAttachment.findMany({
      where: {
        supplierId,
        processed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return attachments.map((a) => a.filePath).filter((p) => fs.existsSync(p))
  }
}

