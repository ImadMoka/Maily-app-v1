import Imap from 'node-imap'
import { type ImapConnectionConfig, type ImapVerificationResult, type FetchEmailsResult, type EmailMessage, type EmailAddress } from './imap.types'

export class ImapService {
  
  async verifyConnection(config: ImapConnectionConfig): Promise<ImapVerificationResult> {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        authTimeout: 10000,
        connTimeout: 10000
      })

      const timeout = setTimeout(() => {
        imap.destroy()
        resolve({
          success: false,
          error: 'Connection timeout after 10 seconds'
        })
      }, 10000)

      imap.once('ready', () => {
        clearTimeout(timeout)
        imap.end()
        resolve({
          success: true,
          connectionTime: Date.now() - startTime
        })
      })

      imap.once('error', (error: Error) => {
        clearTimeout(timeout)
        resolve({
          success: false,
          error: this.formatImapError(error)
        })
      })

      try {
        imap.connect()
      } catch (error) {
        clearTimeout(timeout)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown connection error'
        })
      }
    })
  }

  async fetchRecentEmails(config: ImapConnectionConfig, limit: number = 50): Promise<FetchEmailsResult> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        authTimeout: 15000,
        connTimeout: 15000
      })

      const timeout = setTimeout(() => {
        imap.destroy()
        resolve({
          success: false,
          error: 'Connection timeout after 15 seconds'
        })
      }, 15000)

      imap.once('ready', () => {
        clearTimeout(timeout)
        
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            imap.end()
            resolve({
              success: false,
              error: this.formatImapError(err)
            })
            return
          }

          // Search for recent emails
          imap.search(['ALL'], (err, results) => {
            if (err) {
              imap.end()
              resolve({
                success: false,
                error: this.formatImapError(err)
              })
              return
            }

            if (!results || results.length === 0) {
              imap.end()
              resolve({
                success: true,
                emails: [],
                totalCount: 0
              })
              return
            }

            // Get the most recent emails by taking the last N UIDs
            const recentUids = results.slice(-limit)
            
            const fetch = imap.fetch(recentUids, {
              bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
              struct: true
            })

            const emails: EmailMessage[] = []
            let processedCount = 0

            fetch.on('message', (msg, seqno) => {
              let headers: any = {}
              let structure: any = null

              msg.on('body', (stream, info) => {
                let buffer = ''
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('ascii')
                })
                stream.once('end', () => {
                  headers = Imap.parseHeader(buffer)
                })
              })

              msg.once('attributes', (attrs) => {
                structure = attrs.struct
              })

              msg.once('end', () => {
                try {
                  const email = this.parseEmailFromHeaders(headers, structure, seqno, recentUids[processedCount])
                  if (email) {
                    emails.push(email)
                  }
                } catch (error) {
                  console.error('Error parsing email:', error)
                }
                
                processedCount++
                if (processedCount === recentUids.length) {
                  imap.end()
                  
                  // Sort by date (newest first)
                  emails.sort((a, b) => b.date.getTime() - a.date.getTime())
                  
                  resolve({
                    success: true,
                    emails,
                    totalCount: emails.length
                  })
                }
              })
            })

            fetch.once('error', (err) => {
              imap.end()
              resolve({
                success: false,
                error: this.formatImapError(err)
              })
            })

            fetch.once('end', () => {
              if (processedCount === 0) {
                imap.end()
                resolve({
                  success: true,
                  emails: [],
                  totalCount: 0
                })
              }
            })
          })
        })
      })

      imap.once('error', (error: Error) => {
        clearTimeout(timeout)
        resolve({
          success: false,
          error: this.formatImapError(error)
        })
      })

      try {
        imap.connect()
      } catch (error) {
        clearTimeout(timeout)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown connection error'
        })
      }
    })
  }

  private parseEmailFromHeaders(headers: any, structure: any, seqno: number, uid: number): EmailMessage | null {
    try {
      const from = this.parseEmailAddress(headers.from?.[0] || '')
      const to = headers.to ? headers.to.map((addr: string) => this.parseEmailAddress(addr)) : []
      const subject = headers.subject?.[0] || '(No Subject)'
      const dateStr = headers.date?.[0] || ''
      const date = dateStr ? new Date(dateStr) : new Date()

      // Generate a simple preview (we'll enhance this later)
      const preview = `Email from ${from.name || from.email} - ${subject.substring(0, 100)}`
      
      // Check for attachments in structure
      const hasAttachments = this.hasAttachments(structure)
      
      // Calculate approximate size (we don't have actual size from headers)
      const size = this.estimateEmailSize(headers, structure)

      return {
        id: `${uid}-${seqno}`,
        uid,
        subject,
        from,
        to,
        date,
        preview,
        hasAttachments,
        isRead: false, // We'll assume unread for now since we're reading readonly
        size
      }
    } catch (error) {
      console.error('Error parsing email headers:', error)
      return null
    }
  }

  private parseEmailAddress(addressStr: string): EmailAddress {
    // Simple email address parsing
    const match = addressStr.match(/^(.*?)\s*<(.+)>$/)
    if (match) {
      return {
        name: match[1].replace(/"/g, '').trim(),
        email: match[2].trim()
      }
    }
    
    // Just an email address
    const emailMatch = addressStr.match(/([^\s]+@[^\s]+)/)
    if (emailMatch) {
      return {
        email: emailMatch[1]
      }
    }
    
    return { email: addressStr.trim() }
  }

  private hasAttachments(structure: any): boolean {
    if (!structure) return false
    
    // Check if structure indicates attachments
    if (Array.isArray(structure)) {
      return structure.some(part => 
        part.disposition && 
        (part.disposition.type === 'attachment' || part.disposition.type === 'inline')
      )
    }
    
    return structure.disposition && 
           (structure.disposition.type === 'attachment' || structure.disposition.type === 'inline')
  }

  private estimateEmailSize(headers: any, structure: any): number {
    // Simple size estimation based on headers and structure
    let size = 0
    
    // Add header sizes
    Object.values(headers).forEach((value: any) => {
      if (Array.isArray(value)) {
        value.forEach(v => size += (v ? v.toString().length : 0))
      } else {
        size += (value ? value.toString().length : 0)
      }
    })
    
    // Add estimated body size (rough approximation)
    size += 1000 // Base body size assumption
    
    return size
  }

  private formatImapError(error: Error): string {
    const message = error.message.toLowerCase()
    
    if (message.includes('invalid credentials') || message.includes('authentication failed')) {
      return 'Invalid email or password'
    }
    if (message.includes('getaddrinfo') || message.includes('enotfound')) {
      return 'Invalid IMAP server address'
    }
    if (message.includes('timeout')) {
      return 'Connection timeout - server may be unavailable'
    }
    if (message.includes('connection refused')) {
      return 'Connection refused - check IMAP server and port'
    }
    
    return error.message
  }
}