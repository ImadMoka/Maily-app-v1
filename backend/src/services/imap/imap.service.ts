const Imap = require('node-imap')
import { simpleParser } from 'mailparser'
import { type ImapConnectionConfig, type ImapVerificationResult, type FetchEmailsResult, type EmailMessage, type EmailAddress } from './imap.types'
import { ContentDetector, type DetectionResult } from '../content/content-detector'

/**
 * Simplified IMAP service - direct and minimal
 * No caching, no complex abstractions, just simple operations
 */
export class ImapService {

  /**
   * Create IMAP connection with standard config
   */
  private createConnection(config: ImapConnectionConfig): any {
    return new Imap({
      user: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      authTimeout: 10000,
      connTimeout: 10000
    })
  }

  /**
   * Verify IMAP credentials work
   */
  async verifyConnection(config: ImapConnectionConfig): Promise<ImapVerificationResult> {
    return new Promise((resolve) => {
      const imap = this.createConnection(config)

      const timeout = setTimeout(() => {
        imap.destroy()
        resolve({ success: false, error: 'Connection timeout' })
      }, 10000)

      imap.once('ready', () => {
        clearTimeout(timeout)
        imap.end()
        resolve({ success: true })
      })

      imap.once('error', (error: Error) => {
        clearTimeout(timeout)
        resolve({ success: false, error: error.message })
      })

      imap.connect()
    })
  }

  /**
   * Fetch recent emails from Gmail
   * Simple approach: just use [Gmail]/All Mail folder
   */
  async fetchRecentEmails(config: ImapConnectionConfig, limit: number = 50): Promise<FetchEmailsResult> {
    return new Promise((resolve) => {
      const imap = this.createConnection(config)
      const emails: EmailMessage[] = []

      imap.once('ready', () => {
        // For Gmail, All Mail contains everything. Try both common paths.
        const tryFolders = ['[Gmail]/All Mail', '[Gmail]/Alle Nachrichten']

        const tryNextFolder = (index: number) => {
          if (index >= tryFolders.length) {
            imap.end()
            resolve({ success: false, error: 'Could not find Gmail All Mail folder' })
            return
          }

          imap.openBox(tryFolders[index], true, (err: any, box: any) => {
            if (err) {
              tryNextFolder(index + 1)
              return
            }

            // Found the folder, fetch emails
            const folderName = tryFolders[index]

            imap.search(['ALL'], (err: any, results: number[]) => {
              if (err || !results || results.length === 0) {
                imap.end()
                resolve({ success: true, emails: [], totalCount: 0 })
                return
              }

              // Get the most recent emails
              const uidsToFetch = results.slice(-limit)
              const fetch = imap.fetch(uidsToFetch, {
                bodies: '',
                envelope: true,
                flags: true,
                struct: true,
                extensions: ['X-GM-THRID']  // Gmail thread ID
              })

              fetch.on('message', (msg: any) => {
                let emailData: any = {}

                msg.on('attributes', (attrs: any) => {
                  emailData = {
                    uid: attrs.uid,
                    envelope: attrs.envelope,
                    flags: attrs.flags || [],
                    struct: attrs.struct,
                    gmailThreadId: attrs['x-gm-thrid'] ? String(attrs['x-gm-thrid']) : null
                  }
                })

                msg.on('end', () => {
                  if (emailData.envelope) {
                    // Simple email object construction
                    emails.push({
                      uid: emailData.uid,
                      messageId: emailData.envelope.messageId || undefined,
                      subject: emailData.envelope.subject || 'No Subject',
                      from: this.extractAddress(emailData.envelope.from?.[0]),
                      to: (emailData.envelope.to || []).map((a: any) => this.extractAddress(a)),
                      cc: (emailData.envelope.cc || []).map((a: any) => this.extractAddress(a)),
                      date: emailData.envelope.date || new Date(),
                      hasAttachments: this.checkAttachments(emailData.struct),
                      bodyPreview: '',
                      isRead: emailData.flags.includes('\\Seen'),
                      size: emailData.struct?.size || 1000,
                      gmailThreadId: emailData.gmailThreadId,
                      folder: folderName
                    })
                  }
                })
              })

              fetch.once('end', () => {
                emails.sort((a, b) => b.uid - a.uid)
                imap.end()
                resolve({
                  success: true,
                  emails,
                  totalCount: results.length
                })
              })

              fetch.once('error', (err: any) => {
                imap.end()
                resolve({ success: false, error: err.message })
              })
            })
          })
        }

        tryNextFolder(0)
      })

      imap.once('error', (error: Error) => {
        resolve({ success: false, error: error.message })
      })

      imap.connect()
    })
  }

  /**
   * Mark an email as read - simple and direct
   */
  async markAsRead(
    config: ImapConnectionConfig,
    params: { uid: number, folderName: string }
  ): Promise<{ success: boolean, error?: string }> {
    return new Promise((resolve) => {
      const imap = this.createConnection(config)

      imap.once('ready', () => {
        // Open folder in read-write mode (false = not readonly)
        imap.openBox(params.folderName, false, (err: any) => {
          if (err) {
            imap.end()
            resolve({
              success: false,
              error: `Cannot open folder ${params.folderName}`
            })
            return
          }

          // Mark as read using UID
          imap.addFlags([params.uid], ['\\Seen'], (err: any) => {
            imap.end()

            if (err) {
              resolve({
                success: false,
                error: `Failed to mark as read: ${err.message}`
              })
            } else {
              resolve({ success: true })
            }
          })
        })
      })

      imap.once('error', (error: Error) => {
        resolve({ success: false, error: error.message })
      })

      imap.connect()
    })
  }

  /**
   * Helper to extract email address from envelope
   */
  private extractAddress(addr: any): EmailAddress {
    if (!addr) return { name: '', address: 'unknown@unknown.com' }
    return {
      name: addr.name || '',
      address: `${addr.mailbox}@${addr.host}`
    }
  }

  /**
   * Simple attachment check
   */
  private checkAttachments(struct: any): boolean {
    if (!struct) return false
    if (Array.isArray(struct)) {
      return struct.some(part =>
        part.disposition?.type?.toLowerCase() === 'attachment'
      )
    }
    return struct.disposition?.type?.toLowerCase() === 'attachment'
  }

  /**
   * Fetch email bodies for specific emails
   * Adapts the working logic from imap-fetch-complete-parsed.js
   */
  async fetchEmailBodies(
    config: ImapConnectionConfig,
    emails: Array<{uid: number, messageId: string, emailId: string}>
  ): Promise<Map<string, { content: string; metadata: DetectionResult }>> {
    return new Promise((resolve) => {
      const imap = this.createConnection(config)
      const bodiesWithMetadata = new Map<string, { content: string; metadata: DetectionResult }>()
      const contentDetector = new ContentDetector()

      imap.once('ready', () => {
        // Try both common Gmail folder paths
        const tryFolders = ['[Gmail]/All Mail', '[Gmail]/Alle Nachrichten']

        const tryNextFolder = (index: number) => {
          if (index >= tryFolders.length) {
            imap.end()
            resolve(bodiesWithMetadata) // Return what we got
            return
          }

          imap.openBox(tryFolders[index], true, (err: any) => {
            if (err) {
              tryNextFolder(index + 1)
              return
            }

            // Extract UIDs from the emails array
            const uids = emails.map(e => e.uid)

            if (uids.length === 0) {
              imap.end()
              resolve(bodiesWithMetadata)
              return
            }

            // Fetch complete message bodies using empty string for RFC822
            const fetch = imap.fetch(uids, {
              bodies: '', // This fetches the complete RFC822 message
              struct: false
            })

            const messagePromises: Promise<void>[] = []

            fetch.on('message', (msg: any, seqno: number) => {
              let uid: number
              const chunks: Buffer[] = []

              msg.on('attributes', (attrs: any) => {
                uid = attrs.uid
              })

              msg.on('body', (stream: NodeJS.ReadableStream) => {
                stream.on('data', (chunk: Buffer) => {
                  chunks.push(chunk)
                })
              })

              msg.on('end', () => {
                const emailInfo = emails.find(e => e.uid === uid)
                if (!emailInfo) return

                const messagePromise = (async () => {
                  try {
                    const buffer = Buffer.concat(chunks)
                    // Parse the raw email using mailparser
                    const parsed = await simpleParser(buffer)

                    // Prefer HTML content, fallback to text
                    const content = parsed.html || parsed.text || ''

                    // Detect content type and metadata
                    const mimeType = parsed.html ? 'text/html' : 'text/plain'
                    const metadata = contentDetector.detect(content, mimeType)

                    bodiesWithMetadata.set(emailInfo.emailId, {
                      content,
                      metadata
                    })
                  } catch (error) {
                    console.error(`Error parsing email ${uid}:`, error)
                    // Still add an empty entry so we know we tried
                    bodiesWithMetadata.set(emailInfo.emailId, {
                      content: '',
                      metadata: contentDetector.detect('', 'text/plain')
                    })
                  }
                })()

                messagePromises.push(messagePromise)
              })
            })

            fetch.once('end', async () => {
              // Wait for all parsing to complete
              await Promise.all(messagePromises)
              imap.end()
              resolve(bodiesWithMetadata)
            })

            fetch.once('error', (err: any) => {
              console.error('Fetch error:', err)
              imap.end()
              resolve(bodiesWithMetadata) // Return what we got
            })
          })
        }

        tryNextFolder(0)
      })

      imap.once('error', (error: Error) => {
        console.error('IMAP connection error:', error)
        resolve(bodiesWithMetadata) // Return empty map on error
      })

      imap.connect()
    })
  }
}