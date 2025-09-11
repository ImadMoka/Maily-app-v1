const Imap = require('node-imap')
import { simpleParser } from 'mailparser'
import { type ImapConnectionConfig, type ImapVerificationResult, type FetchEmailsResult, type EmailMessage, type EmailAddress, type EmailBodyResult } from './imap.types'
import { imapConnectionCache } from './imap-connection-cache'

export class ImapService {

  async verifyConnection(config: ImapConnectionConfig, userContext?: { userId: string, accountId: string }): Promise<ImapVerificationResult> {
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
        const connectionTime = Date.now() - startTime
        
        if (userContext?.userId && userContext?.accountId) {
          console.log(`💾 Caching IMAP connection for user:${userContext.userId}, account:${userContext.accountId}`)
          imapConnectionCache.set(userContext.userId, userContext.accountId, imap)
        } else {
          imap.end()
        }
        
        resolve({
          success: true,
          connectionTime
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

  async fetchRecentEmails(config: ImapConnectionConfig, limit: number = 50, userContext?: { userId: string, accountId: string }): Promise<FetchEmailsResult> {
    if (userContext?.userId && userContext?.accountId) {
      const cachedConnection = imapConnectionCache.get(userContext.userId, userContext.accountId)
      
      if (cachedConnection) {
        console.log(`♻️ Using cached IMAP connection for user:${userContext.userId}, account:${userContext.accountId}`)
        return this.doFetchEmails(cachedConnection, limit, true)
      }
    }

    console.log(`🆕 Creating new IMAP connection for ${config.host}`)

    // 2. If no cache, create new connection and do all the actions
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
        this.doFetchEmails(imap, limit, false).then(resolve)
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

  async fetchEmailBody(config: ImapConnectionConfig, uid: number, userContext?: { userId: string, accountId: string }): Promise<EmailBodyResult> {
    if (userContext?.userId && userContext?.accountId) {
      const cachedConnection = imapConnectionCache.get(userContext.userId, userContext.accountId)
      
      if (cachedConnection) {
        console.log(`♻️ Using cached IMAP connection for user:${userContext.userId}, account:${userContext.accountId}`)
        return this.doFetchEmailBody(cachedConnection, uid, true)
      }
    }

    console.log(`🆕 Creating new IMAP connection for ${config.host}`)

    // 2. If no cache, create new connection and do all the actions
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
        this.doFetchEmailBody(imap, uid, false).then(resolve)
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

  private async doFetchEmails(imap: typeof Imap, limit: number, isFromCache: boolean): Promise<FetchEmailsResult> {
    return new Promise((resolve) => {
      if (imap.state !== 'authenticated') {
        resolve({
          success: false,
          error: 'Connection not ready'
        })
        return
      }

      // Try common folders in order
      this.openBestFolder(imap, (err: any, box: any) => {
        if (err) {
          resolve({
            success: false,
            error: this.formatImapError(err)
          })
          return
        }

        this.fetchEmailsFromBox(imap, limit, isFromCache, resolve)
      })
    })
  }

  private openBestFolder(imap: any, callback: (err: any, box: any) => void) {
    const folders = ['[Gmail]/All Mail', 'INBOX', 'All Mail', 'Alle Nachrichten']
    
    const tryFolder = (index: number) => {
      if (index >= folders.length) {
        callback(new Error('Could not open any mailbox folder'), null)
        return
      }
      
      imap.openBox(folders[index], true, (err: any, box: any) => {
        if (err) {
          tryFolder(index + 1)
        } else {
          callback(null, box)
        }
      })
    }
    
    tryFolder(0)
  }

  private fetchEmailsFromBox(imap: any, limit: number, isFromCache: boolean, resolve: any) {
    imap.search(['ALL'], (err: any, results: any) => {
      if (err) {
        resolve({
          success: false,
          error: this.formatImapError(err)
        })
        return
      }

      if (!results || results.length === 0) {
        resolve({
          success: true,
          emails: [],
          totalCount: 0
        })
        return
      }

      const recentUids = results.slice(-limit)
      
      const fetch = imap.fetch(recentUids, {
        bodies: '',
        struct: true,
        envelope: true,
        extensions: ['X-GM-THRID']
      })

      const emails: EmailMessage[] = []
      let processedCount = 0

      fetch.on('message', (msg: any, seqno: number) => {
        let uid = 0
        let envelope: any = null
        let structure: any = null
        let gmailThreadId: string | null = null

        msg.on('attributes', (attrs: any) => {
          uid = attrs.uid
          envelope = attrs.envelope
          structure = attrs.struct
          // Extract Gmail thread ID from X-GM-THRID extension
          gmailThreadId = attrs['x-gm-thrid'] ? String(attrs['x-gm-thrid']) : null
        })

        msg.on('end', () => {
          if (envelope) {
            processedCount++
            
            const fromAddress: EmailAddress = envelope.from?.[0] ? {
              name: envelope.from[0].name || '',
              address: envelope.from[0].mailbox + '@' + envelope.from[0].host
            } : {
              name: '',
              address: 'unknown@unknown.com'
            }

            const toAddresses: EmailAddress[] = envelope.to?.map((addr: any) => ({
              name: addr.name || '',
              address: addr.mailbox + '@' + addr.host
            })) || []

            // Extract CC addresses if available
            const ccAddresses: EmailAddress[] = envelope.cc?.map((addr: any) => ({
              name: addr.name || '',
              address: addr.mailbox + '@' + addr.host
            })) || []

            emails.push({
              uid,
              messageId: envelope.messageId || '',
              subject: envelope.subject || 'No Subject',
              from: fromAddress,
              to: toAddresses,
              cc: ccAddresses,
              date: envelope.date || new Date(),
              hasAttachments: this.hasAttachments(structure),
              bodyPreview: '',
              isRead: false, // Default to unread
              size: this.calculateMessageSize(structure),
              gmailThreadId: gmailThreadId
            })

            if (processedCount === recentUids.length) {
              emails.sort((a, b) => b.uid - a.uid)
              
              if (!isFromCache) {
                imap.end()
              }
              
              resolve({
                success: true,
                emails,
                totalCount: results.length
              })
            }
          }
        })
      })

      fetch.once('error', (err: any) => {
        if (!isFromCache) {
          imap.end()
        }
        resolve({
          success: false,
          error: this.formatImapError(err)
        })
      })

      fetch.once('end', () => {
        if (processedCount === 0) {
          if (!isFromCache) {
            imap.end()
          }
          resolve({
            success: true,
            emails: [],
            totalCount: 0
          })
        }
      })
    })
  }

  private async doFetchEmailBody(imap: typeof Imap, uid: number, isFromCache: boolean): Promise<EmailBodyResult> {
    return new Promise((resolve) => {
      if (imap.state !== 'authenticated') {
        resolve({
          success: false,
          error: 'Connection not ready'
        })
        return
      }

      this.openBestFolder(imap, (err: any, box: any) => {
        if (err) {
          resolve({
            success: false,
            error: this.formatImapError(err)
          })
          return
        }

        const fetch = imap.fetch([uid], {
          bodies: '',
          struct: true
        })

        let rawEmailBuffer = ''
        let processedCount = 0

        fetch.on('message', (msg: any, seqno: number) => {
          msg.on('body', (stream: any, info: any) => {
            stream.on('data', (chunk: any) => {
              rawEmailBuffer += chunk.toString()
            })
          })

          msg.on('end', () => {
            processedCount++
            
            if (processedCount === 1) {
              simpleParser(rawEmailBuffer)
                .then((parsed) => {
                  if (!isFromCache) {
                    imap.end()
                  }
                  
                  resolve({
                    success: true,
                    body: {
                      text: parsed.text || '',
                      html: parsed.html || '',
                      subject: parsed.subject || '',
                      from: parsed.from ? {
                        name: parsed.from.text || '',
                        address: parsed.from.value?.[0]?.address || ''
                      } : { name: '', address: '' },
                      date: parsed.date || new Date(),
                      attachments: parsed.attachments?.map(att => ({
                        filename: att.filename || 'unknown',
                        contentType: att.contentType || 'application/octet-stream',
                        size: att.size || 0
                      })) || []
                    }
                  })
                })
                .catch((parseError) => {
                  if (!isFromCache) {
                    imap.end()
                  }
                  resolve({
                    success: false,
                    error: 'Failed to parse email content'
                  })
                })
            }
          })
        })

        fetch.once('error', (err: any) => {
          if (!isFromCache) {
            imap.end()
          }
          resolve({
            success: false,
            error: this.formatImapError(err)
          })
        })

        fetch.once('end', () => {
          if (processedCount === 0) {
            if (!isFromCache) {
              imap.end()
            }
            resolve({
              success: false,
              error: 'Email not found'
            })
          }
        })
      })
    })
  }

  private hasAttachments(structure: any): boolean {
    if (!structure) return false
    if (Array.isArray(structure)) {
      return structure.some(part => part.disposition && part.disposition.type.toLowerCase() === 'attachment')
    }
    return structure.disposition && structure.disposition.type.toLowerCase() === 'attachment'
  }

  private calculateMessageSize(structure: any): number {
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