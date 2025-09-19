import { database } from '../database'
import { Thread } from '../database/models/Thread'
import { Email } from '../database/models/Email'
import { Contact } from '../database/models/Contact'
import { Q } from '@nozbe/watermelondb'
import { syncNow } from '../database/sync'
import { imapSyncService } from './ImapSyncService'

/**
 * Mark a thread as read by setting unread_count to 0 and is_read to true
 * This happens when user taps on a thread, regardless of individual email read status
 */
export const markThreadAsRead = async (thread: Thread) => {
  // Update local database
  await database.write(async () => {
    await thread.update((t) => {
      t.unreadCount = 0
      t.isRead = true
    })
  })

  // Update contact read status if all threads are now read
  await updateContactReadStatus(thread.contactId)

  console.log('📬 Thread marked as read:', thread.subject)

  // Sync to Supabase after a short delay
  setTimeout(() => syncNow(), 100)
}

/**
 * Update contact read status - MVP implementation
 * Checks if all threads for contact are read, updates Contact.isRead accordingly
 */
const updateContactReadStatus = async (contactId: string) => {
  const hasUnreadThreads = await database.collections
    .get<Thread>('threads')
    .query(Q.where('contact_id', contactId), Q.where('is_read', false))
    .fetchCount()

  const contact = await database.collections
    .get<Contact>('contacts')
    .find(contactId)

  const shouldBeRead = hasUnreadThreads === 0

  if (contact.isRead !== shouldBeRead) {
    await database.write(async () => {
      await contact.update((c) => {
        c.isRead = shouldBeRead
      })
    })
  }
}

/**
 * Mark all emails in a thread as read and queue IMAP sync
 * Called when a thread is opened to mark all its emails as read
 */
export const markAllThreadEmailsAsRead = async (threadId: string) => {
  const emails = await database.collections
    .get<Email>('emails')
    .query(Q.where('thread_id', threadId), Q.where('is_read', false))
    .fetch()

  if (emails.length > 0) {
    // Update local database with batch operation
    await database.write(async () => {
      await database.batch(
        ...emails.map(email =>
          email.prepareUpdate((e) => {
            e.isRead = true
          })
        )
      )
    })

    // Queue IMAP sync for each email that has remote credentials
    for (const email of emails) {
      if (email.imapUid && email.accountId && email.folder) {
        await imapSyncService.queueMarkAsRead({
          emailId: email.id,
          imapUid: email.imapUid,
          accountId: email.accountId,
          folderName: email.folder
        })
      }
    }

    console.log(`📧 Marked ${emails.length} emails as read in thread and queued IMAP sync`)
  }
}