import { SimpleEmailRoutes } from './api/routes/email.routes';

const emailRoutes = new SimpleEmailRoutes();

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/emails/fetch' && req.method === 'POST') {
      return await emailRoutes.handleEmailFetch(req);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log('🚀 Gmail API running on http://localhost:3000');