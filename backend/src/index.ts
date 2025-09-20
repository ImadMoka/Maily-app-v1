import { AccountRoutes } from './api/routes/account.routes'
import { ImapSyncRoutes } from './api/routes/imap-sync.routes'
import { DebugRoutes } from './api/routes/debug.routes'
import { QueueService, SyncJob } from './services/queue/queue.service'

const accountRoutes = new AccountRoutes()
const imapSyncRoutes = new ImapSyncRoutes()
const debugRoutes = new DebugRoutes()

// Initialize queue service if credentials are available
const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (supabaseUrl && serviceKey) {
  const queue = new QueueService(supabaseUrl, serviceKey)

  // Define the sync processor
  async function processSyncJob(job: SyncJob) {
    console.log(`Processing ${job.type} for account ${job.account_id}`)

    // TODO: Integrate your IMAP service here
    // const account = await getEmailAccount(job.account_id)
    // const imapService = new ImapService(account)
    // await imapService.sync(job)

    // For now, just simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log(`Completed ${job.type} for account ${job.account_id}`)
  }

  queue.start(processSyncJob)
  console.log('✅ Queue service started (polls every 2 seconds)')

  // Graceful shutdown handlers
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, stopping queue...')
    queue.stop()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('SIGINT received, stopping queue...')
    queue.stop()
    process.exit(0)
  })
} else {
  console.log('⚠️ Queue service disabled (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
}

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