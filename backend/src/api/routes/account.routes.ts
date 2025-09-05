import { AccountService, type CreateAccountRequest } from '../../services/accounts/account.service'
import { AuthUtils } from '../../utils/auth.utils'

export class AccountRoutes {
  private accountService = new AccountService()

  async handleCreateAccount(request: Request): Promise<Response> {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const authResult = await AuthUtils.validateToken(authHeader)
    
    if (!authResult.success) {
      return AuthUtils.createUnauthorizedResponse(authResult.error)
    }
    
    const user = authResult.user!

    try {
      const body = await request.json()
      
      // Validate required fields
      if (!body.email || !body.password || !body.imapHost || !body.imapUsername) {
        return Response.json({
          success: false,
          error: 'Missing required fields: email, password, imapHost, imapUsername'
        }, { status: 400 })
      }

      const accountData: CreateAccountRequest = {
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        providerType: body.providerType,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUseTls: body.imapUseTls,
        imapUsername: body.imapUsername
      }

      // Create user client with proper permissions (RLS enforced)
      const token = authHeader!.replace('Bearer ', '')
      const userClient = await AuthUtils.createUserClient(token)
      
      const result = await this.accountService.createAccount(userClient, accountData)

      if (result.success) {
        return Response.json({
          success: true,
          message: 'Account created successfully',
          account: {
            id: result.data!.id,
            email: result.data!.email,
            display_name: result.data!.display_name,
            provider_type: result.data!.provider_type,
            is_active: result.data!.is_active,
            created_at: result.data!.created_at
          }
        })
      } else {
        return Response.json({
          success: false,
          error: result.error
        }, { status: 400 })
      }

    } catch (error) {
      return Response.json({
        success: false,
        error: 'Invalid request format'
      }, { status: 400 })
    }
  }

  async handleGetAccounts(request: Request): Promise<Response> {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const authResult = await AuthUtils.validateToken(authHeader)
    
    if (!authResult.success) {
      return AuthUtils.createUnauthorizedResponse(authResult.error)
    }
    
    const user = authResult.user!

    const result = await this.accountService.getUserAccounts(user.id)

    if (result.success) {
      // Return accounts without passwords for security
      const accounts = result.data!.map(account => ({
        id: account.id,
        email: account.email,
        display_name: account.display_name,
        provider_type: account.provider_type,
        imap_host: account.imap_host,
        imap_port: account.imap_port,
        imap_use_tls: account.imap_use_tls,
        imap_username: account.imap_username,
        is_active: account.is_active,
        sync_status: account.sync_status,
        sync_error: account.sync_error,
        last_sync_at: account.last_sync_at,
        created_at: account.created_at,
        updated_at: account.updated_at
      }))

      return Response.json({
        success: true,
        count: accounts.length,
        accounts: accounts
      })
    } else {
      return Response.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
  }

  async handleDeleteAccount(request: Request): Promise<Response> {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const authResult = await AuthUtils.validateToken(authHeader)
    
    if (!authResult.success) {
      return AuthUtils.createUnauthorizedResponse(authResult.error)
    }
    
    const user = authResult.user!

    // Extract account ID from URL
    const url = new URL(request.url)
    const accountId = url.pathname.split('/').pop()

    if (!accountId) {
      return Response.json({
        success: false,
        error: 'Account ID required'
      }, { status: 400 })
    }

    const result = await this.accountService.deleteAccount(user.id, accountId)

    if (result.success) {
      return Response.json({
        success: true,
        message: 'Account deleted successfully'
      })
    } else {
      return Response.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
  }

  async handleUpdateAccountStatus(request: Request): Promise<Response> {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const authResult = await AuthUtils.validateToken(authHeader)
    
    if (!authResult.success) {
      return AuthUtils.createUnauthorizedResponse(authResult.error)
    }
    
    const user = authResult.user!

    // Extract account ID from URL
    const url = new URL(request.url)
    const accountId = url.pathname.split('/')[3] // /api/accounts/:id/status

    if (!accountId) {
      return Response.json({
        success: false,
        error: 'Account ID required'
      }, { status: 400 })
    }

    try {
      const body = await request.json()
      
      if (typeof body.is_active !== 'boolean') {
        return Response.json({
          success: false,
          error: 'is_active field required and must be boolean'
        }, { status: 400 })
      }

      const result = await this.accountService.updateAccountStatus(user.id, accountId, body.is_active)

      if (result.success) {
        return Response.json({
          success: true,
          message: 'Account status updated successfully',
          account: {
            id: result.data!.id,
            is_active: result.data!.is_active,
            updated_at: result.data!.updated_at
          }
        })
      } else {
        return Response.json({
          success: false,
          error: result.error
        }, { status: 400 })
      }

    } catch (error) {
      return Response.json({
        success: false,
        error: 'Invalid request format'
      }, { status: 400 })
    }
  }
}