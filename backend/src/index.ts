import { AccountRoutes } from './api/routes/account.routes'
import { ImapSyncRoutes } from './api/routes/imap-sync.routes'
import { DebugRoutes } from './api/routes/debug.routes'

const accountRoutes = new AccountRoutes()
const imapSyncRoutes = new ImapSyncRoutes()
const debugRoutes = new DebugRoutes()

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/accounts' && req.method === 'POST') {
      return await accountRoutes.handleCreateAccount(req)
    }

    if (url.pathname === '/api/accounts' && req.method === 'GET') {
      return await accountRoutes.handleGetAccounts(req)
    }

    // Delete ALL accounts endpoint - DELETE /api/accounts
    if (url.pathname === '/api/accounts' && req.method === 'DELETE') {
      return await accountRoutes.handleDeleteAllAccounts(req)
    }

    // Delete single account endpoint - matches /api/accounts/{id}
    if (url.pathname.startsWith('/api/accounts/') && req.method === 'DELETE') {
      return await accountRoutes.handleDeleteAccount(req)
    }

    // IMAP sync endpoint - mark email as read
    if (url.pathname === '/api/imap/mark-read' && req.method === 'POST') {
      return await imapSyncRoutes.handleMarkAsRead(req)
    }

    // DEBUG ENDPOINTS (No auth required - uses admin client)
    // Delete ALL accounts from ALL users
    if (url.pathname === '/api/debug/delete-all-accounts' && req.method === 'DELETE') {
      return await debugRoutes.handleDeleteAllAccountsAdmin(req)
    }

    // Get database statistics
    if (url.pathname === '/api/debug/stats' && req.method === 'GET') {
      return await debugRoutes.handleGetAccountStats(req)
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});