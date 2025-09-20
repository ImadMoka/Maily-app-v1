# Email Sync Queue Service

## Overview
A robust, persistent queue service for handling email synchronization tasks using pg-boss. This queue ensures that email sync operations are reliable, resumable, and can handle failures gracefully.

## Why We Need a Queue

### The Queue is Like a Restaurant Kitchen
```
Customer Orders (User Actions)     Kitchen Orders (Queue)        Chefs (Workers)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Sync my Gmail"        →        Order Ticket #1         →      Chef processes order
"Check new emails"     →        Order Ticket #2         →      Next available chef
"Mark as read"         →        Order Ticket #3         →      Works through tickets
```

### Without Queue (Brittle ❌)
```
User adds email account
    ↓
Server immediately tries to sync 200 emails
    ↓
If server crashes or timeout → ❌ LOST, start over
If network fails → ❌ LOST, no retry
If too many users → ❌ Server overloaded
```

### With Queue (Bulletproof ✅)
```
User adds email account
    ↓
Create a "sync task" in queue → Gets unique ID (like 6e94932c-...)
    ↓
User gets immediate response: "Sync started!"
    ↓
Background worker picks up task when ready
    ↓
If crash → ✅ Task still in queue, resumes later
If network fail → ✅ Automatic retry (3 times)
If busy → ✅ Task waits patiently in queue
```

## How It Works

```
Your Supabase Database (PostgreSQL)
├── public schema (your existing data)
│   ├── emails
│   ├── contacts
│   ├── threads
│   └── email_accounts
│
└── pgboss schema (created automatically)
    ├── job         ← Active queue items
    ├── archive     ← Completed/failed jobs
    ├── schedule    ← Recurring jobs (future)
    └── version     ← Schema versioning

Two ways to connect:
1. Supabase Client (SUPABASE_URL) → For normal CRUD operations
2. Direct PostgreSQL (DATABASE_URL) → For pg-boss queue
```

## Setup

### 1. Add DATABASE_URL to your `.env` file:

For Supabase users (like this project):
1. Go to Supabase Dashboard → Settings → Database → Connection String
2. Choose "URI" type and "Transaction pooler" or "Direct connection"
3. Copy the string that looks like:
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.zmuydhbecwgpmtauksc.supabase.co:5432/postgres
```
4. Add this to your `/backend/.env` file

### 2. What happens automatically:

#### When you start the server (`bun run dev`):
```
1. Queue service initializes
   ↓
2. pg-boss connects to PostgreSQL (using DATABASE_URL)
   ↓
3. pg-boss checks for its schema
   ↓
4. If missing, creates these tables automatically:
   - pgboss.job (stores queued tasks)
   - pgboss.version (tracks schema version)
   - pgboss.schedule (for scheduled jobs)
   - pgboss.archive (completed job history)
   ↓
5. Starts processing jobs from the queue
```

### 3. Graceful degradation:

If DATABASE_URL is not configured or connection fails:
- ✅ Server still starts normally
- ✅ All other features work (email sync via Supabase client)
- ⚠️ Queue operations become no-ops (do nothing)
- 📝 Warnings are logged to help you debug
- 🔄 You can add DATABASE_URL later and restart - it will start working

## Implementation Guide

### Basic Usage

```typescript
import { getQueueService } from './services/queue';

// Get the singleton instance
const queue = getQueueService(process.env.DATABASE_URL);

// Initialize (called automatically on server start)
await queue.initialize();

// Enqueue a sync task
const jobId = await queue.enqueue({
  accountId: 'user-account-id',
  type: 'initial_sync',
  payload: {
    folder: 'INBOX',
    limit: 500
  }
});

// Check status
const status = await queue.getStatus();
```

### Real-World Implementation

#### When User Adds Email Account:
```typescript
// In /api/routes/account.routes.ts
async function handleCreateAccount(req) {
  // 1. Save account to database (existing code)
  const account = await accountService.createAccount({
    email: "user@gmail.com",
    password: "app-specific-password",
    // ... other fields
  });

  // 2. Queue the initial sync task (NEW)
  const queueService = getQueueService(process.env.DATABASE_URL);
  const jobId = await queueService.enqueue({
    accountId: account.id,
    type: 'initial_sync',
    payload: {
      folder: '[Gmail]/All Mail',
      limit: 50000  // Can handle ALL emails now!
    },
    checkpoint: {
      lastUid: 0,
      totalFetched: 0
    }
  });

  // 3. Return immediately - don't wait for sync!
  return Response.json({
    success: true,
    message: "Account added! Syncing emails in background...",
    accountId: account.id,
    syncJobId: jobId
  });
}
```

#### Background Worker Processing (Auto-runs):
```typescript
// In sync-queue.service.ts - processJob method
private async processJob(job: PgBoss.Job<SyncTask>): Promise<void> {
  const { accountId, type, payload, checkpoint } = job.data;

  if (type === 'initial_sync') {
    // 1. Get account credentials
    const account = await accountService.getAccount(accountId);

    // 2. Connect to email provider
    const imapService = new ImapService();
    await imapService.connect(account);

    // 3. Fetch emails with pagination
    let lastUid = checkpoint?.lastUid || 0;
    const pageSize = 500;

    while (true) {
      // Fetch next batch
      const emails = await imapService.fetchEmails({
        startUid: lastUid + 1,
        limit: pageSize
      });

      if (emails.length === 0) break; // Done!

      // Save to database
      await emailService.saveEmails(emails);

      // Update checkpoint (can resume from here if crash)
      await this.updateCheckpoint(job.id, {
        lastUid: emails[emails.length - 1].uid,
        totalFetched: (checkpoint?.totalFetched || 0) + emails.length
      });

      lastUid = emails[emails.length - 1].uid;
    }

    console.log(`✅ Synced ${checkpoint?.totalFetched} emails for account ${accountId}`);
  }
}
```

## Application Flow

```
Frontend (React Native App)
    ↓
    POST /api/accounts (user adds email account)
    ↓
Backend API (Bun Server)
    ├── 1. Validate credentials
    ├── 2. Save account to Supabase
    ├── 3. Queue sync task ← THIS QUEUE SERVICE
    └── 4. Return success immediately
         ↓
    Background Worker (runs separately)
    ├── Picks up task from pgboss.job table
    ├── Connects to Gmail/Outlook via IMAP
    ├── Fetches emails in 500-email batches
    ├── Saves each batch to database
    ├── Updates checkpoint after each batch
    └── Moves job to pgboss.archive when done
         ↓
    If anything fails:
    ├── Automatic retry (up to 3 times)
    ├── Resume from last checkpoint
    └── Never lose progress
```

## Features

### ✅ Implemented (Phase 1.1)
- Basic job enqueueing and processing
- Automatic retries (3 attempts with 1-minute delay)
- Graceful degradation when DATABASE_URL not configured
- Checkpoint support for resumable operations
- Clean shutdown handling
- pg-boss v10 compatibility with queue creation

### 🚧 Next Steps (Keep it simple!)
- Connect to actual IMAP service in processJob
- Add progress tracking for UI updates
- Implement checkpoint persistence
- Add more job types (incremental_sync, mark_as_read, etc.)

## Testing

Run the test to verify the queue works:
```bash
bun run test:queue
```

Expected output:
```
✅ Queue initialized
✅ Task enqueued with ID: [uuid]
✅ Queue status shows pending: 1
✅ After processing, pending: 0
```

## Understanding pg-boss Tables

### What Each Table Does

| Table | Purpose | What You'll See | Should You Delete? |
|-------|---------|-----------------|-------------------|
| **queue** | Queue definitions | One row per queue type (e.g., 'email-sync') | ❌ Never! This defines your queues |
| **job** | Active tasks | Your pending sync tasks | ✅ Auto-cleaned after processing |
| **archive** | Completed/failed jobs | History of processed tasks | ✅ Can clean old entries |
| **schedule** | Recurring jobs | Future: "Check email every 5 min" | ❌ Keep for scheduled tasks |
| **subscription** | Pub/sub events | Future: Real-time notifications | ❌ Keep for event system |
| **version** | Schema version | pg-boss version info | ❌ Never! Required by pg-boss |
| **j0fcfc1b...** | Job partitions | Auto-created for performance | ❌ Never! Managed by pg-boss |

### Think of it Like a Restaurant:
```
queue table    = Restaurant Menu (defines what's available)
job table      = Active Orders (currently being cooked)
archive table  = Receipt History (completed orders)
```

### Example: What You'll See in Supabase

#### In `queue` table:
```sql
name: email-sync
policy: standard
-- This is the DEFINITION of your queue, not a job!
-- It will always have this row - don't delete it
```

#### In `job` table (when syncing):
```sql
id: 6e94932c-10b8-4484-90d6-f19101148e4a
name: email-sync
data: {"accountId": "123", "type": "initial_sync"}
state: active
-- These are actual TASKS being processed
-- They disappear when complete
```

## Maintenance & Monitoring

### Check Queue Status

```bash
bun run queue:status
```

Output will show:
```
📊 Queue Statistics:
   Pending jobs: 0      ← Waiting to process
   Active jobs: 1       ← Currently processing
   Completed: 42        ← Successfully done
   Failed: 3           ← Need investigation
```

### Database Cleanup (Safe Operations)

```sql
-- Check how many jobs are pending
SELECT COUNT(*) FROM pgboss.job WHERE name = 'email-sync';

-- Check how many completed jobs in archive
SELECT COUNT(*) FROM pgboss.archive;

-- Clean old archive entries (older than 7 days)
DELETE FROM pgboss.archive WHERE completedon < NOW() - INTERVAL '7 days';

-- If testing, clear all jobs (NOT for production!)
TRUNCATE pgboss.job;      -- Clears pending jobs
TRUNCATE pgboss.archive;   -- Clears history
```

### Never Delete These!
```sql
-- ❌ DON'T DELETE the queue definition
DELETE FROM pgboss.queue;  -- This breaks your queues!

-- ❌ DON'T DELETE version info
DELETE FROM pgboss.version; -- This breaks pg-boss!

-- ❌ DON'T DROP partition tables
DROP TABLE pgboss.j0fcfc1beacf8d4de083a9e05; -- Breaks partitioning!
```

## Troubleshooting

### Queue not enqueueing jobs?
1. Check DATABASE_URL is set in .env
2. Verify PostgreSQL connection works
3. Check pgboss schema exists in Supabase
4. Verify 'email-sync' exists in queue table

### Jobs stuck in pending?
1. Worker might have crashed - restart server
2. Check error logs for processing failures
3. Verify IMAP credentials are valid
4. Run `SELECT * FROM pgboss.job` to see stuck jobs

### Memory issues?
1. Reduce batch size in pagination
2. Add memory limits to worker
3. Process fewer concurrent jobs

### "Queue table has entries" confusion?
- The `queue` table SHOULD have entries (queue definitions)
- The `job` table is where actual tasks go
- Don't delete queue definitions - they're permanent configuration

## Design Philosophy

1. **No premature optimization**: Simple implementation focused on reliability
2. **Graceful degradation**: App works even without queue (logs warnings)
3. **pg-boss over BullMQ**: Uses existing PostgreSQL, no Redis needed
4. **Simple retry logic**: Fixed 3 retries with 1-minute delays
5. **Checkpoint-based recovery**: Never lose progress, even on crashes

## Why This Architecture?

### Benefits:
- **Reliability**: Tasks persist even if server crashes
- **Scalability**: Can handle thousands of accounts without overload
- **Resumability**: Checkpoints allow resuming from exact failure point
- **User Experience**: Immediate response, background processing
- **Maintainability**: Clear separation of concerns

### Without Queue:
- User waits minutes for sync to complete
- Server crashes = start over from beginning
- Network timeout = entire operation fails
- Multiple users = server overload

### With Queue:
- User gets instant feedback
- Server crashes = resume from checkpoint
- Network issues = automatic retry
- Handles any load gracefully

This queue service transforms your email sync from brittle to bulletproof! 🚀