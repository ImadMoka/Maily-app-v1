import { AccountService, type CreateAccountData } from '@/services/accounts/account.service'
import { ImapService } from '@/services/imap/imap.service'
import { AuthUtils } from '@/utils/auth.utils'

export class AccountRoutes {
  private accountService = new AccountService()
  private imapService = new ImapService()

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

      // 3. Verify IMAP connection before creating account
      const verificationResult = await this.imapService.verifyConnection({
        host: imapHost,
        port: imapPort,
        username: imapUsername,
        password: password,
        tls: true
      })

      if (!verificationResult.success) {
        return Response.json({ 
          error: `IMAP verification failed: ${verificationResult.error}` 
        }, { status: 400 })
      }

      // 4. Create user client (user privileges - RLS enforced)
      const userClient = AuthUtils.createUserClient(token)
      
      // 5. Create account with user permissions (only after successful IMAP verification)
      const account = await this.accountService.createAccount(userClient, {
        email, password, imapHost, imapUsername, imapPort
      }, user.id)

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
}
