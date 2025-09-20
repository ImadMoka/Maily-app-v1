// pg-boss is a job queue library that uses PostgreSQL for storage
// It handles background tasks, retries, and ensures tasks survive server crashes
import PgBoss from 'pg-boss';

// =================================================================
// TYPE DEFINITIONS
// =================================================================
// These TypeScript types define the structure of data we pass to queue tasks

// SyncTask represents a background email sync job
export interface SyncTask {
  // Which email account to sync (references email_accounts.id in database)
  accountId: string;

  // What type of sync to perform
  // 'initial_sync' = first time syncing all emails for new account
  // 'incremental_sync' = fetch only new emails since last sync
  type: 'initial_sync' | 'incremental_sync';

  // Additional data needed for the sync operation
  payload: {
    folder?: string;    // Which email folder to sync (e.g., 'INBOX', '[Gmail]/All Mail')
    limit?: number;     // Maximum number of emails to fetch in this batch
  };

  // Checkpoint data for resuming if the sync is interrupted
  // This allows us to continue from where we left off if server crashes
  checkpoint?: {
    lastUid?: number;        // Last email UID we processed (for pagination)
    totalFetched?: number;   // Total emails fetched so far
    lastError?: string;      // Last error message if sync failed
  };
}

// =================================================================
// SYNC QUEUE SERVICE CLASS
// =================================================================
// This class manages the email sync queue using pg-boss
// It handles enqueueing tasks, processing them, and tracking progress

export class SyncQueueService {
  // pg-boss instance - handles all queue operations
  private boss: PgBoss | null = null;

  // Name of the queue - shows up in pgboss.queue table
  // We use a constant to avoid typos
  private readonly QUEUE_NAME = 'email-sync';

  // Constructor takes the PostgreSQL connection string
  // databaseUrl is optional - if not provided, queue runs in disabled mode
  constructor(private databaseUrl?: string) {
    // DATABASE_URL is optional - we'll handle missing gracefully
    // This allows the app to run even without queue functionality
  }

  // =================================================================
  // INITIALIZATION
  // =================================================================
  // Sets up the queue system when server starts
  // Called from index.ts during server startup

  async initialize(): Promise<void> {
    // If no DATABASE_URL provided, queue features are disabled
    // App continues to work, just without background sync
    if (!this.databaseUrl) {
      console.warn('SyncQueueService: No DATABASE_URL provided, queue disabled');
      return;
    }

    try {
      // Initialize pg-boss with production config
      this.boss = new PgBoss({
        // PostgreSQL connection string (e.g., postgresql://user:pass@host/db)
        connectionString: this.databaseUrl,

        // After a job completes, wait 1 hour before moving to archive table
        // This keeps job table smaller for better performance
        archiveCompletedAfterSeconds: 60 * 60,

        // Delete archived jobs after 7 days to prevent database bloat
        deleteAfterDays: 7,

        // Disable scheduling feature for now (we don't use recurring jobs yet)
        // Can enable later for "check email every 5 minutes" features
        noScheduling: true,
      });

      // Start pg-boss - this does several things:
      // 1. Connects to PostgreSQL
      // 2. Creates pgboss schema if it doesn't exist
      // 3. Creates all required tables (job, archive, queue, etc.)
      // 4. Starts maintenance processes (archiving, deletion)
      await this.boss.start();

      // IMPORTANT: In pg-boss v10, queues must be created before use!
      // This is a breaking change from v9 where queues were created automatically
      try {
        await this.boss.createQueue(this.QUEUE_NAME);
        console.log(`SyncQueueService: Queue '${this.QUEUE_NAME}' created/verified`);
      } catch (error) {
        // Queue might already exist from a previous run, which is fine
        // pg-boss throws error if queue exists, but we can ignore it
        console.log(`SyncQueueService: Queue '${this.QUEUE_NAME}' already exists (this is normal)`);
      }

      // Register a worker function to process jobs from this queue
      // This runs in the background and picks up jobs automatically
      //
      // How it works:
      // 1. pg-boss checks for pending jobs in the queue
      // 2. When found, it calls this function with the job data
      // 3. We process the job (sync emails)
      // 4. If we return normally, job is marked complete
      // 5. If we throw an error, job is retried (up to 3 times)
      this.boss.work(this.QUEUE_NAME, async (jobs) => {
        // v10 always passes an array of jobs (even if just one)
        for (const job of jobs) {
          await this.processJob(job);
        }
      });

      console.log('SyncQueueService: Queue initialized successfully');
    } catch (error) {
      console.error('SyncQueueService: Failed to initialize:', error);
      // Don't crash the app if queue fails to start
      // Set boss to null so enqueue() knows queue is unavailable
      this.boss = null;
    }
  }

  // =================================================================
  // ENQUEUE - ADD TASKS TO QUEUE
  // =================================================================
  // Called when we need to sync an email account
  // Returns a job ID that can be used to track progress

  async enqueue(task: SyncTask): Promise<string | null> {
    // If queue not initialized, return null (graceful degradation)
    if (!this.boss) {
      console.warn('SyncQueueService: Queue not available, skipping task');
      return null;
    }

    try {
      // Send job to queue with retry configuration
      // pg-boss stores this in pgboss.job table
      const jobId = await this.boss.send(
        this.QUEUE_NAME,    // Which queue to add to
        task,               // The task data (accountId, type, etc.)
        {
          retryLimit: 3,    // Try up to 3 times if job fails
          retryDelay: 60,   // Wait 1 minute between retries
        }
      );

      console.log(`SyncQueueService: Enqueued task ${jobId} for account ${task.accountId}`);
      return jobId;
    } catch (error) {
      console.error('SyncQueueService: Failed to enqueue task:', error);
      return null;
    }
  }

  // =================================================================
  // PROCESS JOB - WORKER FUNCTION
  // =================================================================
  // This is called automatically by pg-boss when a job needs processing
  // It runs in the background, separate from HTTP requests

  private async processJob(job: PgBoss.Job<SyncTask>): Promise<void> {
    // Extract the task data we stored when enqueueing
    const { accountId, type, payload, checkpoint } = job.data;

    console.log(`SyncQueueService: Processing ${type} for account ${accountId}`);

    try {
      // TODO: This is where we'll connect to the actual email sync logic
      // For now, it's a placeholder that just logs
      //
      // In Phase 1.2, this will:
      // 1. Get account credentials from database
      // 2. Connect to email provider (Gmail, Outlook) via IMAP
      // 3. Fetch emails in batches
      // 4. Save to database
      // 5. Update checkpoint for resume capability

      // Placeholder for now
      console.log(`SyncQueueService: Would sync account ${accountId} - not implemented yet`);

      // Job completes successfully by returning normally
      // pg-boss will mark it as complete and move to archive
    } catch (error) {
      // If we throw an error, pg-boss will:
      // 1. Mark job as failed
      // 2. Retry based on retryLimit (3 times)
      // 3. If all retries fail, move to archive with 'failed' state
      console.error(`SyncQueueService: Task ${job.id} failed:`, error);
      throw error;  // Re-throw to trigger retry
    }
  }

  // =================================================================
  // CHECKPOINT UPDATES
  // =================================================================
  // Updates checkpoint data so we can resume from where we left off
  // This is crucial for syncing large mailboxes (50,000+ emails)

  async updateCheckpoint(jobId: string, checkpoint: SyncTask['checkpoint']): Promise<void> {
    if (!this.boss) return;

    try {
      // In a real implementation, we would:
      // 1. Update the job's checkpoint in the database
      // 2. This allows resuming from exact position if interrupted
      console.log(`SyncQueueService: Updating checkpoint for job ${jobId}:`, checkpoint);
      // TODO: Implement actual checkpoint storage
    } catch (error) {
      console.error('SyncQueueService: Failed to update checkpoint:', error);
    }
  }

  // =================================================================
  // QUEUE STATUS
  // =================================================================
  // Returns current queue statistics for monitoring

  async getStatus(): Promise<{ pending: number; active: number; completed: number; failed: number } | null> {
    if (!this.boss) {
      return null;
    }

    try {
      // Get count of jobs waiting to be processed
      const stats = await this.boss.getQueueSize(this.QUEUE_NAME);

      // Get info about currently processing job (if any)
      const active = await this.boss.getJobById(this.QUEUE_NAME);

      return {
        pending: stats || 0,        // Jobs waiting in queue
        active: active ? 1 : 0,      // Currently processing
        completed: 0,                // Would need to query archive table
        failed: 0,                   // Would need to query archive table
      };
    } catch (error) {
      console.error('SyncQueueService: Failed to get status:', error);
      return null;
    }
  }

  // =================================================================
  // GRACEFUL SHUTDOWN
  // =================================================================
  // Called when server is stopping (Ctrl+C or deployment)
  // Ensures jobs don't get stuck in "processing" state

  async shutdown(): Promise<void> {
    if (this.boss) {
      console.log('SyncQueueService: Shutting down queue');
      // This will:
      // 1. Stop accepting new jobs
      // 2. Finish current job if one is processing
      // 3. Close database connections
      await this.boss.stop();
      this.boss = null;
    }
  }
}

// =================================================================
// SINGLETON PATTERN
// =================================================================
// Ensures only one queue service instance exists
// Multiple instances would process jobs multiple times!

// Single instance shared across the app
let queueService: SyncQueueService | null = null;

// Factory function to get the singleton instance
// Called from index.ts and anywhere else that needs the queue
export function getQueueService(databaseUrl?: string): SyncQueueService {
  // Create instance only once
  if (!queueService) {
    queueService = new SyncQueueService(databaseUrl);
  }
  return queueService;
}