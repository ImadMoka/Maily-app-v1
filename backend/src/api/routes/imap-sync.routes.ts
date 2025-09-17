import { ImapService } from '@/services/imap/imap.service'
import { AccountService } from '@/services/accounts/account.service'
import { AuthUtils } from '@/utils/auth.utils'

export class ImapSyncRoutes {
  private imapService = new ImapService()
  private accountService = new AccountService()

  // Simple mark as read endpoint for testing
  async handleMarkAsRead(request: Request): Promise<Response> {
    try {
      // 1. Validate user token
      const authHeader = request.headers.get('Authorization')

      if (!authHeader) {
        return Response.json({ error: 'Authorization header required' }, { status: 401 })
      }

      const { user, token } = await AuthUtils.validateToken(authHeader)
      

      // 2. Get request data
      const body = await request.json() as {
        imapUid: number
        folderName?: string // Optional, defaults to "All Mail"/"Alle Nachrichten"
      }

      const { imapUid, folderName } = body

      if (!imapUid) {
        return Response.json({ error: 'Missing required field: imapUid' }, { status: 400 })
      }

      // 3. Create user client (user privileges - RLS enforced) 
      const userClient = AuthUtils.createUserClient(token)

      // 4. Get account credentials
      const account = await this.accountService.getAccountNewest(userClient, user.id)

      if (!account) {
        return Response.json({ error: 'Account not found' }, { status: 404 })
      }

      // 5. Update flag via IMAP
      const result = await this.imapService.markAsRead({
        host: account.imap_host,
        port: account.imap_port,
        username: account.imap_username,
        password: account.password,
        tls: true
      }, {
        uid: imapUid,
        folderName: folderName || '[Gmail]/Alle Nachrichten' // Use provided folder or default to Gmail Alle Nachrichten
      }, {
        userId: user.id,
        accountId: account.id
      })

      if (!result.success) {
        return Response.json({
          error: result.error || 'Failed to mark as read'
        }, { status: 500 })
      }

      return Response.json({
        success: true,
        message: `Email with UID ${imapUid} marked as read`
      })

    } catch (error) {
      console.error('❌ Error marking email as read:', error)
      return Response.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }
}