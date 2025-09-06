import { AccountRoutes } from './api/routes/account.routes'

const accountRoutes = new AccountRoutes()

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/accounts' && req.method === 'POST') {
      return await accountRoutes.handleCreateAccount(req)
    }

    if (url.pathname === '/api/accounts' && req.method === 'GET') {
      return await accountRoutes.handleGetAccounts(req)
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});