import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Simple types - no separate file needed
export interface SyncJob {
  id: string
  account_id: string
  user_id: string
  type: 'initial_sync' | 'incremental_sync' | 'selective_sync'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  payload: Record<string, any>
  checkpoint: Record<string, any>
  attempts: number
  error?: string
  scheduled_for: string
  started_at?: string
}

export class QueueService {
  private supabase: SupabaseClient
  private processor?: (job: SyncJob) => Promise<void>
  private pollInterval?: NodeJS.Timeout
  private isProcessing = false

  constructor(url: string, key: string) {
    this.supabase = createClient(url, key, {
      auth: { persistSession: false }
    })
  }

  // Start polling for jobs
  start(processor: (job: SyncJob) => Promise<void>) {
    this.processor = processor

    // Poll every 2 seconds
    this.pollInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processNext()
      }
    }, 2000)

    // Process any existing jobs immediately
    this.processNext()
  }

  // Stop polling
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }
  }

  // Add a job to the queue
  async enqueue(
    accountId: string,
    userId: string,
    type: SyncJob['type'],
    payload = {}
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .insert({
        account_id: accountId,
        user_id: userId,
        type,
        payload,
        status: 'pending',
        attempts: 0,
        checkpoint: {},
        scheduled_for: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  // Process next available job
  private async processNext() {
    if (this.isProcessing || !this.processor) return

    this.isProcessing = true

    try {
      // Simple atomic job claim using UPDATE with WHERE
      const { data: jobs } = await this.supabase
        .from('sync_jobs')
        .select('*')
        .or('status.eq.pending,and(status.eq.processing,started_at.lt.' +
            new Date(Date.now() - 5 * 60 * 1000).toISOString() + ')')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for')
        .limit(1)

      if (!jobs || jobs.length === 0) {
        return // No jobs available
      }

      const job = jobs[0]

      // Claim the job
      const { error: claimError } = await this.supabase
        .from('sync_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1
        })
        .eq('id', job.id)
        .eq('status', job.status) // Ensure no one else claimed it

      if (claimError) {
        return // Someone else got it
      }

      // Process the job
      try {
        await this.processor({ ...job, status: 'processing', attempts: job.attempts + 1 })

        // Mark as completed
        await this.supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)

      } catch (error) {
        // Handle failure with retry logic
        const message = error instanceof Error ? error.message : 'Unknown error'
        const attempts = job.attempts + 1

        if (attempts >= 3) {
          // Max retries reached
          await this.supabase
            .from('sync_jobs')
            .update({
              status: 'failed',
              error: message,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id)
        } else {
          // Schedule retry with exponential backoff
          const retryMinutes = attempts === 1 ? 1 : attempts === 2 ? 5 : 15
          const scheduledFor = new Date(Date.now() + retryMinutes * 60 * 1000).toISOString()

          await this.supabase
            .from('sync_jobs')
            .update({
              status: 'pending',
              error: message,
              scheduled_for: scheduledFor
            })
            .eq('id', job.id)
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  // Update job progress
  async updateCheckpoint(jobId: string, checkpoint: Record<string, any>) {
    await this.supabase
      .from('sync_jobs')
      .update({ checkpoint })
      .eq('id', jobId)
  }

  // Check if account has active sync
  async hasActiveSync(accountId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('sync_jobs')
      .select('id')
      .eq('account_id', accountId)
      .in('status', ['pending', 'processing'])
      .limit(1)

    return (data?.length ?? 0) > 0
  }
}