import { database } from '../database'
import ImapSyncQueue, { OperationType } from '../database/models/ImapSyncQueue'
import { Q } from '@nozbe/watermelondb'

export interface QueueMarkReadParams {
  emailId: string
  imapUid: number
  folderName: string
  accountId: string
}

export class ImapSyncQueueService {

  /**
   * Queue an email to be marked as read in IMAP
   * Called when user clicks on an email
   */
  async queueMarkAsRead(params: QueueMarkReadParams): Promise<void> {
    await database.write(async () => {
      await database.get<ImapSyncQueue>('imap_sync_queue').create(item => {
        item.emailId = params.emailId
        item.imapUid = params.imapUid
        item.operationType = 'mark_read'
        item.folderName = params.folderName || 'All Mail'
        item.accountId = params.accountId
        item.attempts = 0
        item.status = 'pending'
      })
    })

    console.log(`📝 Queued mark-as-read for email UID: ${params.imapUid}`)
  }

  /**
   * Get next batch of pending items to process
   * Background worker calls this every few seconds
   */
  async getNextBatch(limit: number = 5): Promise<ImapSyncQueue[]> {
    const items = await database.get<ImapSyncQueue>('imap_sync_queue')
      .query(
        Q.where('status', 'pending'),
        Q.where('attempts', Q.lt(3)), // Less than 3 attempts
        Q.sortBy('created_at', Q.asc),
        Q.take(limit)
      )
      .fetch()

    // Mark them as processing
    if (items.length > 0) {
      await database.write(async () => {
        for (const item of items) {
          await item.update(record => {
            record.status = 'processing'
          })
        }
      })
    }

    return items
  }

  /**
   * Remove successfully processed item from queue
   */
  async removeFromQueue(item: ImapSyncQueue): Promise<void> {
    await database.write(async () => {
      await item.markAsDeleted()
    })
    console.log(`✅ Removed UID ${item.imapUid} from sync queue`)
  }

  /**
   * Handle failed item - increment attempts or mark as failed
   */
  async handleFailure(item: ImapSyncQueue, error: string): Promise<void> {
    await database.write(async () => {
      await item.update(record => {
        record.attempts = record.attempts + 1
        record.lastError = error

        if (record.attempts < 3) {
          // Reset to pending for retry
          record.status = 'pending'
          console.log(`⚠️ Retry ${record.attempts}/3 for UID ${item.imapUid}`)
        } else {
          // Max attempts reached
          record.status = 'failed'
          console.log(`❌ Failed after 3 attempts: UID ${item.imapUid}`)
        }
      })
    })
  }
}

// Export singleton instance
export const imapSyncQueueService = new ImapSyncQueueService()