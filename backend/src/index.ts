import { AccountRoutes } from './api/routes/account.routes'

const accountRoutes = new AccountRoutes()

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Account management routes
    if (url.pathname === '/api/accounts' && req.method === 'POST') {
      return await accountRoutes.handleCreateAccount(req)
    }
    
    if (url.pathname === '/api/accounts' && req.method === 'GET') {
      return await accountRoutes.handleGetAccounts(req)
    }
    
    if (url.pathname.startsWith('/api/accounts/') && url.pathname.endsWith('/status') && req.method === 'PUT') {
      return await accountRoutes.handleUpdateAccountStatus(req)
    }
    
    if (url.pathname.startsWith('/api/accounts/') && req.method === 'DELETE') {
      return await accountRoutes.handleDeleteAccount(req)
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log('🚀 Maily Backend API running on http://localhost:3000');