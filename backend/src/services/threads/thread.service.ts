import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import type { EmailMessage } from '../imap/imap.types'

type ThreadInsert = Database['public']['Tables']['threads']['Insert']
type ThreadRow = Database['public']['Tables']['threads']['Row']

export class ThreadService {
  /**
   * Find or create a thread for an email
   * Returns the thread ID to be set on the email
   */
  async findOrCreateThread(
    userClient: SupabaseClient<Database>,
    email: EmailMessage,
    contactId: string | null
  ): Promise<string | null> {
    // Skip if no contact (can't have thread without contact)
    if (!contactId) {
      console.log('⚠️ No contact_id, skipping thread creation')
      return null
    }

    const fromDisplay = email.from?.name || email.from?.address || 'Unknown'

    // Try to find existing thread by gmail_thread_id
    if (email.gmailThreadId) {
      const gmailThreadId = parseInt(email.gmailThreadId)

      // Check if thread exists
      const { data: existingThread } = await userClient
        .from('threads')
        .select('id, email_count, unread_count, last_email_date')
        .eq('contact_id', contactId)
        .eq('gmail_thread_id', gmailThreadId)
        .single()

      if (existingThread) {
        // Update existing thread
        console.log(`📧 Updating thread ${existingThread.id} for gmail_thread_id ${gmailThreadId}`)

        await userClient
          .from('threads')
          .update({
            email_count: existingThread.email_count + 1,
            unread_count: existingThread.unread_count + (email.isRead ? 0 : 1),
            last_email_date: email.date.toISOString(),
            last_email_preview: email.bodyPreview || null,
            last_email_from: fromDisplay,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingThread.id)

        return existingThread.id
      }
    }

    // Create new thread
    console.log(`✨ Creating new thread for contact ${contactId}`)

    const newThread: ThreadInsert = {
      contact_id: contactId,
      gmail_thread_id: email.gmailThreadId ? parseInt(email.gmailThreadId) : null,
      subject: email.subject || null,
      last_email_preview: email.bodyPreview || null,
      last_email_from: fromDisplay,
      email_count: 1,
      unread_count: email.isRead ? 0 : 1,
      first_email_date: email.date.toISOString(),
      last_email_date: email.date.toISOString()
    }

    const { data, error } = await userClient
      .from('threads')
      .insert(newThread)
      .select('id')
      .single()

    if (error) {
      console.error('❌ Failed to create thread:', error)
      return null
    }

    return data.id
  }

  /**
   * Update thread read counts when email read status changes
   */
  async updateThreadReadCount(
    userClient: SupabaseClient<Database>,
    threadId: string
  ): Promise<void> {
    // Count unread emails in thread
    const { count } = await userClient
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId)
      .eq('is_read', false)

    // Update thread unread count
    await userClient
      .from('threads')
      .update({
        unread_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
  }

  /**
   * Batch create threads for multiple emails (optimized for initial sync)
   */
  async createThreadsForEmails(
    userClient: SupabaseClient<Database>,
    emailsWithContacts: Array<{ email: EmailMessage, contactId: string | null }>
  ): Promise<Map<string, string>> {
    const emailThreadMap = new Map<string, string>() // email.uid -> thread_id
    const threadsByGmailId = new Map<string, string>() // gmail_thread_id -> thread_id

    for (const { email, contactId } of emailsWithContacts) {
      if (!contactId) continue

      // Check if we've already created a thread for this gmail_thread_id in this batch
      if (email.gmailThreadId && threadsByGmailId.has(email.gmailThreadId)) {
        const threadId = threadsByGmailId.get(email.gmailThreadId)!
        emailThreadMap.set(email.uid.toString(), threadId)

        // Update thread metrics
        await this.updateThreadMetrics(userClient, threadId, email)
        continue
      }

      // Create or find thread
      const threadId = await this.findOrCreateThread(userClient, email, contactId)

      if (threadId) {
        emailThreadMap.set(email.uid.toString(), threadId)
        if (email.gmailThreadId) {
          threadsByGmailId.set(email.gmailThreadId, threadId)
        }
      }
    }

    console.log(`✅ Created/updated threads for ${emailThreadMap.size} emails`)
    return emailThreadMap
  }

  private async updateThreadMetrics(
    userClient: SupabaseClient<Database>,
    threadId: string,
    newEmail: EmailMessage
  ): Promise<void> {
    const { data: thread } = await userClient
      .from('threads')
      .select('email_count, unread_count, last_email_date')
      .eq('id', threadId)
      .single()

    if (thread) {
      const fromDisplay = newEmail.from?.name || newEmail.from?.address || 'Unknown'

      await userClient
        .from('threads')
        .update({
          email_count: thread.email_count + 1,
          unread_count: thread.unread_count + (newEmail.isRead ? 0 : 1),
          last_email_date: newEmail.date.toISOString(),
          last_email_preview: newEmail.bodyPreview || null,
          last_email_from: fromDisplay,
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId)
    }
  }
}