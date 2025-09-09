import { AccountRoutes } from './api/routes/account.routes'
import { EmailRoutes } from './api/routes/email.routes'

const accountRoutes = new AccountRoutes()
const emailRoutes = new EmailRoutes()

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/accounts' && req.method === 'POST') {
      return await accountRoutes.handleCreateAccount(req)
    }

    if (url.pathname === '/api/accounts' && req.method === 'GET') {
      return await accountRoutes.handleGetAccounts(req)
    }

    // Email routes
    if (url.pathname === '/api/emails/recent' && req.method === 'GET') {
      return await emailRoutes.handleGetRecentEmails(req)
    }

    // Email body route - matches /api/emails/:uid/body
    if (url.pathname.match(/^\/api\/emails\/\d+\/body$/) && req.method === 'GET') {
      return await emailRoutes.handleGetEmailBody(req)
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});