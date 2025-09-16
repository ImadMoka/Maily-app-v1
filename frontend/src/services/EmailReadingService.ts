import { database } from '../database'
import { Email } from '../database/models/Email'
import { syncNow } from '../database/sync'
import { imapSyncQueueService } from './ImapSyncQueueService'

/**
 * 📧 EMAIL READING SERVICE
 * Simple utilities for managing individual email read status
 */

// Mark an email as read - triggers UI updates via WatermelonDB observables
export const markEmailAsRead = async (email: Email) => {
  await database.write(async () => {
    await email.update(() => {
      email.isRead = true
    })
  })

  // Queue IMAP sync if we have the necessary data
  if (email.imapUid && email.accountId) {
    try {
      await imapSyncQueueService.queueMarkAsRead({
        emailId: email.id,
        imapUid: email.imapUid,
        folderName: 'All Mail', // Default folder
        accountId: email.accountId
      })
      console.log(`✅ Queued IMAP sync for email ${email.id}`)
    } catch (error) {
      console.error('Failed to queue IMAP sync:', error)
    }
  } else {
    console.log(`⚠️ Missing IMAP data for email ${email.id} - skipping IMAP sync`)
  }

  // Sync changes to Supabase
  setTimeout(() => syncNow(), 100)
}
