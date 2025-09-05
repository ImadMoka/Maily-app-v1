import { AccountService, type CreateAccountData } from '@/services/accounts/account.service'
import { AuthUtils } from '@/utils/auth.utils'

export class AccountRoutes {
  private accountService = new AccountService()

  // Create new email account
  async handleCreateAccount(request: Request): Promise<Response> {
    try {
      // 1. Validate user token (admin privileges)
      const authHeader = request.headers.get('authorization')
      const { user, token } = await AuthUtils.validateToken(authHeader)
      
      // 2. Get request data
      const body = await request.json()
      const { email, password, imapHost, imapUsername } = body
      
      if (!email || !password || !imapHost || !imapUsername) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // 3. Create user client (user privileges - RLS enforced)
      const userClient = AuthUtils.createUserClient(token)
      
      // 4. Create account with user permissions
      const account = await this.accountService.createAccount(userClient, {
        email, password, imapHost, imapUsername
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
      return Response.json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 400 })
    }
  }

  // Get user's accounts
  async handleGetAccounts(request: Request): Promise<Response> {
    try {
      // 1. Validate user token
      const authHeader = request.headers.get('authorization')
      const { user, token } = await AuthUtils.validateToken(authHeader)
      
      // 2. Create user client
      const userClient = AuthUtils.createUserClient(token)
      
      // 3. Get accounts with user permissions
      const accounts = await this.accountService.getUserAccounts(userClient)

      return Response.json({
        success: true,
        count: accounts.length,
        accounts: accounts.map(acc => ({
          id: acc.id,
          email: acc.email,
          is_active: acc.is_active,
          created_at: acc.created_at
        }))
      })

    } catch (error) {
      return Response.json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 400 })
    }
  }
}