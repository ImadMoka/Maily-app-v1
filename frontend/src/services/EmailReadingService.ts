import { database } from '../database'
import { Email } from '../database/models/Email'
import { syncNow } from '../database/sync'
import { imapSyncService } from './ImapSyncService'

/**
 * Mark an email as read locally and queue IMAP sync
 */
export const markEmailAsRead = async (email: Email) => {
  // Update local database
  await database.write(async () => {
    await email.update(() => {
      email.isRead = true
    })
  })

  // Queue IMAP sync if email has remote ID
  if (email.imapUid && email.accountId) {
    await imapSyncService.queueMarkAsRead({
      emailId: email.id,
      imapUid: email.imapUid,
      accountId: email.accountId,
      folderName: email.folder || '[Gmail]/Alle Nachrichten'  // Use folder from email or default to Gmail Alle Nachrichten
    })
  }

  // Sync to Supabase
  setTimeout(() => syncNow(), 100)
}
