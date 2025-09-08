const Imap = require('node-imap')
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
        
        imap.openBox('[Gmail]/All Mail', true, (err: any, box: any) => {
          if (err) {
            imap.end()
            resolve({
              success: false,
              error: this.formatImapError(err)
            })
            return
          }

          // Search for recent emails
          imap.search(['ALL'], (err: any, results: any) => {
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
              bodies: '',
              struct: true,
              envelope: true,
              extensions: ['X-GM-THRID'] // Gmail thread ID extension
            })

            const emails: EmailMessage[] = []
            let processedCount = 0

            fetch.on('message', (msg: any, seqno: number) => {
              let envelope: any = null
              let structure: any = null
              let gmailThreadId: string | null = null

              msg.once('attributes', (attrs: any) => {
                envelope = attrs.envelope
                structure = attrs.struct
                gmailThreadId = attrs['x-gm-thrid'] || null
              })

              msg.once('end', () => {
                try {
                  const uid = recentUids[processedCount]
                  if (uid !== undefined && envelope) {
                    const email = this.parseEmailFromEnvelope(envelope, structure, seqno, uid, gmailThreadId)
                    if (email) {
                      emails.push(email)
                    }
                  }
                } catch (error) {
                  console.error('Error parsing email from envelope:', error)
                }
                
                processedCount++
                if (processedCount === recentUids.length) {
                  imap.end()
                  
                  emails.sort((a, b) => b.date.getTime() - a.date.getTime())
                  
                  resolve({
                    success: true,
                    emails,
                    totalCount: emails.length
                  })
                }
              })
            })

            fetch.once('error', (err: any) => {
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

  private parseEmailFromEnvelope(envelope: any, structure: any, seqno: number, uid: number, gmailThreadId: string | null = null): EmailMessage | null {
    try {
      const from = this.parseEnvelopeAddress(envelope.from?.[0])
      const to = envelope.to ? envelope.to.map((addr: any) => this.parseEnvelopeAddress(addr)) : []
      const cc = envelope.cc ? envelope.cc.map((addr: any) => this.parseEnvelopeAddress(addr)) : []
      const subject = envelope.subject || '(No Subject)'
      const date = envelope.date ? new Date(envelope.date) : new Date()
      const messageId = envelope.messageId || envelope['message-id'] || `<${uid}.${date.getTime()}@maily-app.local>`
      const hasAttachments = this.hasAttachments(structure)
      const size = this.estimateEmailSizeFromStructure(structure)

      return {
        id: messageId,
        uid,
        subject,
        from,
        to,
        cc,
        date,
        preview: '',
        hasAttachments,
        isRead: false,
        size,
        gmailThreadId
      }
    } catch (error) {
      console.error('Error parsing email from envelope:', error)
      return null
    }
  }


  private parseEnvelopeAddress(envAddr: any): EmailAddress {
    if (!envAddr?.mailbox || !envAddr?.host) {
      return { email: 'unknown@unknown.com' }
    }
    return {
      email: `${envAddr.mailbox}@${envAddr.host}`,
      name: envAddr.name || undefined
    }
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

  private estimateEmailSizeFromStructure(structure: any): number {
    if (!structure) return 1000
    if (structure.size) return structure.size
    if (Array.isArray(structure)) {
      return structure.reduce((total, part) => total + (part.size || 500), 0)
    }
    return 1000
  }


  private formatImapError(error: Error): string {
    const msg = error.message.toLowerCase()
    if (msg.includes('credential') || msg.includes('authentication')) return 'Invalid email or password'
    if (msg.includes('getaddrinfo') || msg.includes('enotfound')) return 'Invalid IMAP server address'
    if (msg.includes('timeout')) return 'Connection timeout'
    if (msg.includes('refused')) return 'Connection refused - check server and port'
    return error.message
  }
}