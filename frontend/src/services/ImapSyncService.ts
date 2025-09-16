import { database } from '../database'
import ImapSyncQueue from '../database/models/ImapSyncQueue'
import { Q } from '@nozbe/watermelondb'
import { supabase } from '../lib/supabase'

/**
 * Simple IMAP sync service that handles email synchronization with the server
 * Combines queue management and background processing in one place
 */
class ImapSyncService {
  private intervalId: NodeJS.Timeout | null = null
  private isProcessing = false

  /**
   * Queue an email to be marked as read on the IMAP server
   */
  async queueMarkAsRead(params: {
    emailId: string
    imapUid: number
    folderName?: string
    accountId: string
  }): Promise<void> {
    await database.write(async () => {
      await database.get<ImapSyncQueue>('imap_sync_queue').create(item => {
        item.emailId = params.emailId
        item.imapUid = params.imapUid
        item.operationType = 'mark_read'
        item.folderName = params.folderName || 'INBOX'
        item.accountId = params.accountId
        item.attempts = 0
        item.status = 'pending'
      })
    })
  }

  /**
   * Start background processing of the queue
   * Processes pending items every 5 seconds
   */
  startBackgroundSync(): void {
    if (this.intervalId) return

    // Process immediately, then every 5 seconds
    this.processQueue()
    this.intervalId = setInterval(() => this.processQueue(), 5000)
  }

  /**
   * Stop background processing
   */
  stopBackgroundSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Process pending items in the queue
   * Can also be called manually for immediate processing
   */
  async processQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    this.isProcessing = true
    const stats = { processed: 0, succeeded: 0, failed: 0 }

    try {
      // Get up to 5 pending items
      const items = await database.get<ImapSyncQueue>('imap_sync_queue')
        .query(
          Q.where('status', 'pending'),
          Q.where('attempts', Q.lt(3)),
          Q.sortBy('created_at', Q.asc),
          Q.take(5)
        )
        .fetch()

      if (items.length === 0) return stats

      // Mark items as processing
      await database.write(async () => {
        for (const item of items) {
          await item.update(record => {
            record.status = 'processing'
          })
        }
      })

      // Process each item
      for (const item of items) {
        stats.processed++

        try {
          await this.syncWithImap(item)

          // Success - remove from queue
          await database.write(async () => {
            await item.markAsDeleted()
          })

          stats.succeeded++
        } catch (error) {
          stats.failed++

          // Handle failure - increment attempts
          await database.write(async () => {
            await item.update(record => {
              record.attempts += 1
              record.lastError = error instanceof Error ? error.message : 'Unknown error'
              record.status = record.attempts < 3 ? 'pending' : 'failed'
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
   * Sync a single item with the IMAP server
   */
  private async syncWithImap(item: ImapSyncQueue): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No authentication session')

    // Create fetch with 10 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch('http://localhost:3000/api/imap/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          imapUid: item.imapUid,
          folderName: item.folderName
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}`)
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Clear all items from the queue (for debugging)
   */
  async clearQueue(): Promise<void> {
    const items = await database.get<ImapSyncQueue>('imap_sync_queue').query().fetch()
    await database.write(async () => {
      for (const item of items) {
        await item.markAsDeleted()
      }
    })
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<{
    pending: number
    processing: number
    failed: number
    isRunning: boolean
  }> {
    const [pending, processing, failed] = await Promise.all([
      database.get<ImapSyncQueue>('imap_sync_queue')
        .query(Q.where('status', 'pending'))
        .fetchCount(),
      database.get<ImapSyncQueue>('imap_sync_queue')
        .query(Q.where('status', 'processing'))
        .fetchCount(),
      database.get<ImapSyncQueue>('imap_sync_queue')
        .query(Q.where('status', 'failed'))
        .fetchCount()
    ])

    return {
      pending,
      processing,
      failed,
      isRunning: this.intervalId !== null
    }
  }
}

// Export singleton instance
export const imapSyncService = new ImapSyncService()