import { config } from '@/config';

const server = Bun.serve({
  port: config.port,
  fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === '/') {
      return new Response('Email Client API - Running on Bun!');
    }
    
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Email client server running on http://localhost:${server.port}`);