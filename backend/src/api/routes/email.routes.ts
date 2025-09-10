import { ImapService } from '../../services/imap/imap.service'
import { AccountService } from '../../services/accounts/account.service'
import { EmailDatabaseService } from '../../services/emails/email.service'
import { AuthUtils } from '../../utils/auth.utils'
import { type ImapConnectionConfig } from '../../services/imap/imap.types'

export class EmailRoutes {
  private imapService: ImapService
  private accountService: AccountService
  private emailDbService: EmailDatabaseService

  constructor() {
    this.imapService = new ImapService()
    this.accountService = new AccountService()
    this.emailDbService = new EmailDatabaseService()
  }

  async handleGetRecentEmails(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100) // Max 100 emails


      // 1. Validate user token
      const authHeader = req.headers.get('Authorization')

      if (!authHeader) {
        return Response.json({ error: 'Authorization header required' }, { status: 401 })
      }
      const { user, token } = await AuthUtils.validateToken(authHeader)

      // 2. Create user client  
      const userClient = AuthUtils.createUserClient(token)

      // 3. Get account from Supabase (RLS enforced)
      const account = await this.accountService.getAccountNewest(userClient, user.id)

      // 4. Build IMAP config from account data
      const imapConfig: ImapConnectionConfig = {
        host: account.imap_host,
        port: account.imap_port,
        username: account.imap_username,
        password: account.password,
        tls: account.imap_use_tls
      }

      // 5. Fetch emails (uses cache automatically if available)
      const result = await this.imapService.fetchRecentEmails(imapConfig, limit, { userId: user.id, accountId: account.id })

      if (!result.success) {
        return Response.json(
          { 
            error: result.error || 'Failed to fetch emails',
            success: false
          }, 
          { status: 500 }
        )
      }

      // Save to database asynchronously (don't wait)
      if (result.emails && result.emails.length > 0) {
        console.log(`📧 Attempting to save ${result.emails.length} emails to database for account ${account.id}`)
        this.emailDbService.saveEmails(userClient, account.id, result.emails)
          .then(saveResult => {
            console.log(`✅ Email save result: saved=${saveResult.saved}, skipped=${saveResult.skipped}, errors=${saveResult.errors.length}`)
            if (saveResult.errors.length > 0) {
              console.error('📧 Email save errors:', saveResult.errors)
            }
          })
          .catch(error => console.error('❌ Failed to save emails:', error))
      } else {
        console.log('📧 No emails to save or emails array is empty')
      }

      return Response.json({
        success: true,
        totalCount: result.emails?.length || 0,
        accountEmail: account.email
      })

    } catch (error) {
      console.error('Error fetching emails:', error)
      
      const message = error instanceof Error ? error.message : 'Internal server error'
      const status = message.includes('token') || message.includes('auth') ? 401 :
                    message.includes('Account not found') ? 404 : 500

      return Response.json({ error: message, success: false }, { status })
    }
  }

  async handleGetEmailBody(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const uid = parseInt(pathParts[3])

      if (isNaN(uid)) {
        return Response.json({ error: 'Invalid UID provided' }, { status: 400 })
      }

      // 1. Validate user token
      const authHeader = req.headers.get('Authorization')

      if (!authHeader) {
        return Response.json({ error: 'Authorization header required' }, { status: 401 })
      }
      const { user, token } = await AuthUtils.validateToken(authHeader)

      // 2. Create user client  
      const userClient = AuthUtils.createUserClient(token)

      // 3. Get account from Supabase (RLS enforced)
      const account = await this.accountService.getAccountNewest(userClient, user.id)

      // 4. Build IMAP config from account data
      const imapConfig: ImapConnectionConfig = {
        host: account.imap_host,
        port: account.imap_port,
        username: account.imap_username,
        password: account.password,
        tls: account.imap_use_tls
      }

      // 5. Fetch email body (uses cache automatically if available)
      const result = await this.imapService.fetchEmailBody(imapConfig, uid, { userId: user.id, accountId: account.id })

      if (!result.success) {
        return Response.json(
          { 
            error: result.error || 'Failed to fetch email body',
            success: false
          }, 
          { status: 500 }
        )
      }

      return Response.json({
        success: true,
        uid: result.uid,
        subject: result.subject,
        htmlBody: result.htmlBody
      })

    } catch (error) {
      console.error('Error fetching email body:', error)
      
      const message = error instanceof Error ? error.message : 'Internal server error'
      const status = message.includes('token') || message.includes('auth') ? 401 :
                    message.includes('Account not found') ? 404 : 500

      return Response.json({ error: message, success: false }, { status })
    }
  }

}