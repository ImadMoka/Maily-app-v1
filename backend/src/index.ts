import { AccountRoutes } from './api/routes/account.routes'
import { ImapSyncRoutes } from './api/routes/imap-sync.routes'

const accountRoutes = new AccountRoutes()
const imapSyncRoutes = new ImapSyncRoutes()

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/accounts' && req.method === 'POST') {
      return await accountRoutes.handleCreateAccount(req)
    }

    if (url.pathname === '/api/accounts' && req.method === 'GET') {
      return await accountRoutes.handleGetAccounts(req)
    }

    // Delete account endpoint - matches /api/accounts/{id}
    if (url.pathname.startsWith('/api/accounts/') && req.method === 'DELETE') {
      return await accountRoutes.handleDeleteAccount(req)
    }

    // IMAP sync endpoint - mark email as read
    if (url.pathname === '/api/imap/mark-read' && req.method === 'POST') {
      return await imapSyncRoutes.handleMarkAsRead(req)
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});