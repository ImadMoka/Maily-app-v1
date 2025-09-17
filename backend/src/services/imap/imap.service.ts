const Imap = require('node-imap')
import { type ImapConnectionConfig, type ImapVerificationResult, type FetchEmailsResult, type EmailMessage, type EmailAddress } from './imap.types'

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
                      messageId: emailData.envelope.messageId || '',
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
}