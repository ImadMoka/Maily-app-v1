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

      // 5. Fetch emails using account's IMAP config
      const result = await this.imapService.fetchRecentEmails(imapConfig, limit)

      if (!result.success) {
        return Response.json(
          { 
            error: result.error || 'Failed to fetch emails',
            success: false
          }, 
          { status: 500 }
        )
      }

      // 6. Save emails to Supabase database for caching and search
      let saveResult = null
      if (result.emails && result.emails.length > 0) {
        try {
          saveResult = await this.emailDbService.saveEmails(userClient, account.id, result.emails)
          console.log(`Email save result: ${saveResult.saved} saved, ${saveResult.skipped} skipped, ${saveResult.errors.length} errors`)
        } catch (error) {
          console.error('Failed to save emails to database:', error)
          // Continue anyway - don't fail the entire request if database save fails
        }
      }

      return Response.json({
        success: true,
        emails: result.emails || [],
        totalCount: result.totalCount || 0,
        limit,
        accountEmail: account.email,
        // Include database save stats for debugging
        database: saveResult ? {
          saved: saveResult.saved,
          skipped: saveResult.skipped,
          errors: saveResult.errors
        } : null
      })

    } catch (error) {
      console.error('Error in handleGetRecentEmails:', error)
      
      // Handle specific auth errors
      if (error instanceof Error) {
        if (error.message.includes('Authorization header required') || 
            error.message.includes('Invalid token') ||
            error.message.includes('access denied')) {
          return Response.json(
            { 
              error: error.message,
              success: false
            }, 
            { status: 401 }
          )
        }

        if (error.message.includes('Account not found')) {
          return Response.json(
            { 
              error: error.message,
              success: false
            }, 
            { status: 404 }
          )
        }
      }

      return Response.json(
        { 
          error: 'Internal server error',
          success: false
        }, 
        { status: 500 }
      )
    }
  }

}