import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import type { EmailMessage } from '../imap/imap.types'
import type { SaveEmailsResult } from './emails.types'
import { ThreadService } from '../threads/thread.service'

// Database types from shared schema
type EmailInsert = Database['public']['Tables']['emails']['Insert']
type EmailUpdate = Database['public']['Tables']['emails']['Update']

export class EmailDatabaseService {
  private threadService = new ThreadService()

  /**
   * Save emails to the database with automatic contact linking and thread creation
   * Creates threads for emails with contacts
   */
  async saveEmails(
    userClient: SupabaseClient<Database>,
    accountId: string,
    userId: string,
    emails: EmailMessage[]
  ): Promise<SaveEmailsResult> {

    if (emails.length === 0) {
      return { success: true, saved: 0, skipped: 0, errors: [] }
    }

    let saved = 0
    let skipped = 0
    const errors: string[] = []

    for (const email of emails) {
      try {
        // 1. Convert email and lookup contact
        const dbEmail = await this.convertEmailWithContactLookup(email, accountId, userClient, userId)

        // 2. Create or find thread for this email
        if (dbEmail.contact_id) {
          const threadId = await this.threadService.findOrCreateThread(
            userClient,
            email,
            dbEmail.contact_id
          )

          if (threadId) {
            dbEmail.thread_id = threadId
            console.log(`📎 Email "${email.subject}" assigned to thread ${threadId}`)
          }
        }

        // 3. Save email with thread_id
        const { error } = await userClient
          .from('emails')
          .upsert(dbEmail, { onConflict: 'account_id,message_id' })

        if (error) {
          if (error.code === '23505' || error.message.includes('duplicate')) {
            skipped++
          } else {
            errors.push(`${email.subject || 'Unknown'}: ${error.message}`)
          }
        } else {
          saved++
        }

      } catch (error) {
        errors.push(`${email.subject || 'Unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return { success: errors.length === 0, saved, skipped, errors }
  }


  /**
   * Convert email to database format with direct contact lookup
   * Simple, single-responsibility method
   */
  private async convertEmailWithContactLookup(
    email: EmailMessage, 
    accountId: string, 
    userClient: SupabaseClient<Database>,
    userId: string
  ): Promise<EmailInsert> {
    // Direct contact lookup - simple and clear
    const contactId = await this.findContactIdByEmail(userClient, userId, email.from?.address)
    
    return {
      account_id: accountId,
      imap_uid: email.uid,
      message_id: this.generateMessageId(email),
      subject: email.subject || null,
      from_address: email.from?.address || 'unknown@unknown.com',
      from_name: email.from?.name || null,
      to_addresses: email.to ? email.to.map(addr => addr.address) : [],
      cc_addresses: email.cc ? email.cc.map(addr => addr.address) : [],
      date_sent: email.date.toISOString(),
      date_received: new Date().toISOString(),
      preview_text: email.bodyPreview || null,
      size_bytes: email.size,
      has_attachments: email.hasAttachments,
      is_read: email.isRead || false,
      is_starred: false,
      is_deleted: false,
      folder: email.folder || null,  // Use actual folder from IMAP - no hardcoded defaults
      sync_status: 'synced',
      contact_id: contactId
    }
  }

  /**
   * Find contact ID by email address with case-insensitive matching
   */
  private async findContactIdByEmail(
    userClient: SupabaseClient<Database>,
    userId: string, 
    emailAddress?: string
  ): Promise<string | null> {
    if (!emailAddress) return null
    
    const { data } = await userClient
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .ilike('email', emailAddress) // Case-insensitive match
      .single()
    
    return data?.id || null
  }

  private generateMessageId(email: EmailMessage): string {
    return email.messageId && email.messageId.includes('@') ? email.messageId : 
           `<${email.uid}.${email.date.getTime()}@maily-app.local>`
  }

}