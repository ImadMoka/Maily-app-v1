// Import route handlers for different API endpoints
import { AccountRoutes } from './api/routes/account.routes'
import { ImapSyncRoutes } from './api/routes/imap-sync.routes'
import { DebugRoutes } from './api/routes/debug.routes'

// Import the queue service for background email sync processing
import { getQueueService } from './services/queue'

// Create instances of route handlers
// These handle HTTP requests for different parts of the API
const accountRoutes = new AccountRoutes()
const imapSyncRoutes = new ImapSyncRoutes()
const debugRoutes = new DebugRoutes()

// =================================================================
// QUEUE SERVICE INITIALIZATION
// =================================================================
// The queue service handles background tasks like syncing emails.
// It runs separately from HTTP requests, processing jobs in the background.
//
// How it works:
// 1. When a user adds an email account, we don't sync 50,000 emails immediately
// 2. Instead, we add a "sync task" to the queue and return quickly to the user
// 3. The queue service picks up these tasks and processes them in the background
// 4. If the server crashes, the tasks are still in the database and resume later

// Get a singleton instance of the queue service
// DATABASE_URL is the PostgreSQL connection string for pg-boss to use
const queueService = getQueueService(process.env.DATABASE_URL);

// Start the queue service in the background
// This does several things:
// 1. Connects to PostgreSQL using DATABASE_URL
// 2. Creates pg-boss schema and tables if they don't exist
// 3. Creates the 'email-sync' queue if it doesn't exist
// 4. Starts a background worker that processes jobs from the queue
//
// We use .catch() to handle initialization errors without crashing the server
// If the queue fails to start (e.g., DATABASE_URL not set), the server still runs
// but queue features will be disabled
queueService.initialize().catch(error => {
  console.error('Failed to initialize queue service:', error);
  // Continue running even if queue fails to start
  // This is "graceful degradation" - the app works without the queue
});

// =================================================================
// GRACEFUL SHUTDOWN HANDLERS
// =================================================================
// These ensure the queue shuts down cleanly when the server stops
// This prevents jobs from being stuck in "processing" state

// SIGTERM is sent by hosting providers (Heroku, Docker, etc.) to stop the server
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  // Stop accepting new jobs and finish current ones
  await queueService.shutdown();
  process.exit(0);
});

// SIGINT is sent when you press Ctrl+C in the terminal
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  // Stop accepting new jobs and finish current ones
  await queueService.shutdown();
  process.exit(0);
});

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