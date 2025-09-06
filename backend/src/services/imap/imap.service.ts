import Imap from 'node-imap'
import { type ImapConnectionConfig, type ImapVerificationResult } from './imap.types'

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