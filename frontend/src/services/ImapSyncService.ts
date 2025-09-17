import { database } from '../database'
import ImapSyncQueue from '../database/models/ImapSyncQueue'
import { Q } from '@nozbe/watermelondb'
import { supabase } from '../lib/supabase'

/**
 * Simple IMAP sync queue - just track what needs syncing and process it
 * No retry logic, no batch processing - keep it simple
 */
class ImapSyncService {
  private intervalId: NodeJS.Timeout | null = null
  private isProcessing = false

  /**
   * Queue an email to be marked as read on IMAP
   */
  async queueMarkAsRead(params: {
    emailId: string
    imapUid: number
    folderName: string
    accountId: string
  }): Promise<void> {
    if (!params.folderName) {
      throw new Error('Folder name is required')
    }

    await database.write(async () => {
      await database.get<ImapSyncQueue>('imap_sync_queue').create(item => {
        item.emailId = params.emailId
        item.imapUid = params.imapUid
        item.operationType = 'mark_read'
        item.folderName = params.folderName
        item.accountId = params.accountId
        item.attempts = 0
        item.status = 'pending'
      })
    })
  }

  /**
   * Start background sync - process queue every 5 seconds
   */
  startBackgroundSync(): void {
    if (this.intervalId) return

    this.processQueue()
    this.intervalId = setInterval(() => this.processQueue(), 5000)
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Process pending items in queue
   */
  async processQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    this.isProcessing = true
    const stats = { processed: 0, succeeded: 0, failed: 0 }

    try {
      // Get pending items (max 5)
      const items = await database.get<ImapSyncQueue>('imap_sync_queue')
        .query(
          Q.where('status', 'pending'),
          Q.take(5)
        )
        .fetch()

      if (items.length === 0) return stats

      stats.processed = items.length

      // Process each item
      for (const item of items) {
        try {
          await this.syncWithImap(item)

          // Success - remove from queue
          await database.write(async () => {
            await item.markAsDeleted()
          })
          stats.succeeded++
        } catch (error) {
          // Failed - mark as failed (no retry)
          stats.failed++
          await database.write(async () => {
            await item.update(record => {
              record.status = 'failed'
              record.lastError = error instanceof Error ? error.message : 'Unknown error'
            })
          })
        }
      }

      return stats
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Call backend API to mark email as read on IMAP
   */
  private async syncWithImap(item: ImapSyncQueue): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No authentication session')

    const response = await fetch('http://localhost:3000/api/imap/mark-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        imapUid: item.imapUid,
        folderName: item.folderName
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<{
    pending: number
    failed: number
    isRunning: boolean
  }> {
    const [pending, failed] = await Promise.all([
      database.get<ImapSyncQueue>('imap_sync_queue')
        .query(Q.where('status', 'pending'))
        .fetchCount(),
      database.get<ImapSyncQueue>('imap_sync_queue')
        .query(Q.where('status', 'failed'))
        .fetchCount()
    ])

    return {
      pending,
      failed,
      isRunning: this.intervalId !== null
    }
  }

}

export const imapSyncService = new ImapSyncService()