import { AccountService  } from '@/services/accounts/account.service'
import { type CreateAccountData } from '@/services/accounts/account.types'
import { ImapService } from '@/services/imap/imap.service'
import { InitialSyncService } from '@/services/initial-sync/initial-sync.service'
import { AuthUtils } from '@/utils/auth.utils'

export class AccountRoutes {
  private accountService = new AccountService()
  private imapService = new ImapService()
  private initialSyncService = new InitialSyncService()

  // Create new email account
  async handleCreateAccount(request: Request): Promise<Response> {
    try {
      // 1. Validate user token (admin privileges)
      const authHeader = request.headers.get('Authorization')

      if (!authHeader) {
        return Response.json({ error: 'Authorization header required' }, { status: 401 })
      }
      const { user, token } = await AuthUtils.validateToken(authHeader)
      
      // 2. Get request data
      const body = await request.json() as CreateAccountData
      const { email, password, imapHost, imapPort, imapUsername } = body
      
      if (!email || !password || !imapHost || !imapUsername || !imapPort) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // 3. Create user client (user privileges - RLS enforced) 
      const userClient = AuthUtils.createUserClient(token)
      
      // 4. Create account with user permissions first to get account ID for caching
      const account = await this.accountService.createAccount(userClient, {
        email, password, imapHost, imapUsername, imapPort
      }, user.id)

      // 5. Verify IMAP connection (will be cached automatically with user context)
      const verificationResult = await this.imapService.verifyConnection({
        host: imapHost,
        port: imapPort,
        username: imapUsername,
        password: password,
        tls: true
      }, { userId: user.id, accountId: account.id })

      if (!verificationResult.success) {
        // If IMAP verification fails, clean up the created account
        await this.accountService.deleteAccount(userClient, account.id, user.id)
        return Response.json({ 
          error: `IMAP verification failed: ${verificationResult.error}` 
        }, { status: 400 })
      }

      // Initialize emails and contacts in background (non-blocking)
      console.log(`🔄 Starting background initial sync for account: ${account.email}`)
      this.initialSyncService.performInitialSync(
        userClient,
        user.id,
        account.id,
        {
          host: imapHost,
          port: imapPort,
          username: imapUsername,
          password: password,
          tls: true
        }
      ).then(syncResult => {
        if (syncResult.success) {
          console.log(`✅ Background sync completed for ${account.email}: ${syncResult.emailsProcessed} emails, ${syncResult.contactsProcessed} contacts`)
        } else {
          console.error(`⚠️ Background sync had errors for ${account.email}: ${syncResult.errors.join(', ')}`)
        }
      }).catch(error => {
        console.error(`❌ Background sync failed for ${account.email}:`, error)
      })

      return Response.json({
        success: true,
        account: {
          id: account.id,
          email: account.email,
          is_active: account.is_active
        }
      })

    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to create account')) {
        return Response.json({ 
          error: 'Database error: Failed to save account' 
        }, { status: 500 })
      }
      
      return Response.json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 400 })
    }
  }


  async handleGetAccounts(request: Request): Promise<Response> {
    try {

      const authHeader = request.headers.get('Authorization')

      if (!authHeader) {
        return Response.json({ error: 'Authorization header required' }, { status: 401 })
      }

      const { user, token } = await AuthUtils.validateToken(authHeader)

      const userClient = AuthUtils.createUserClient(token)


      const accounts = await this.accountService.getUserAccounts(userClient, user.id)

      return Response.json({ accounts })
      
    } catch (error) {
      return Response.json({ error: 'Failed to get accounts' }, { status: 500 })
    }
  }

}

