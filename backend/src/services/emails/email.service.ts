import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import type { EmailMessage } from '../imap/imap.types'

// Database types from shared schema
type EmailInsert = Database['public']['Tables']['emails']['Insert']

export interface SaveEmailsResult {
  success: boolean
  saved: number
  skipped: number
  errors: string[]
}

export class EmailDatabaseService {

  /**
   * Save/upsert emails to the database from IMAP fetch results
   * Handles deduplication using message_id and account_id
   */
  async saveEmails(
    userClient: SupabaseClient<Database>, 
    accountId: string, 
    emails: EmailMessage[]
  ): Promise<SaveEmailsResult> {
    
    if (emails.length === 0) {
      return {
        success: true,
        saved: 0,
        skipped: 0,
        errors: []
      }
    }

    let saved = 0
    let skipped = 0
    const errors: string[] = []

    for (const email of emails) {
      try {
        // Convert IMAP email to database format
        const dbEmail = this.convertImapEmailToDbFormat(email, accountId)
        
        // Use upsert to handle duplicates gracefully
        const { error } = await userClient
          .from('emails')
          .upsert(dbEmail, {
            onConflict: 'account_id,message_id',
            ignoreDuplicates: true
          })

        if (error) {
          // Check if it's a duplicate conflict (expected)
          if (error.code === '23505' || error.message.includes('duplicate')) {
            skipped++
          } else {
            errors.push(`Email ${email.subject}: ${error.message}`)
          }
        } else {
          saved++
        }

      } catch (error) {
        errors.push(`Email ${email.subject}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      success: errors.length === 0,
      saved,
      skipped,
      errors
    }
  }


  /**
   * Convert IMAP EmailMessage to database insert format
   * Maps between our IMAP types and Supabase schema
   */
  private convertImapEmailToDbFormat(email: EmailMessage, accountId: string): EmailInsert {
    return {
      account_id: accountId,
      imap_uid: email.uid,
      message_id: this.generateMessageId(email),
      subject: email.subject || null,
      from_address: email.from.email,
      from_name: email.from.name || null,
      to_addresses: email.to.map(addr => addr.email),
      cc_addresses: email.cc.map(addr => addr.email),
      date_sent: email.date.toISOString(),
      date_received: new Date().toISOString(),
      preview_text: null,
      size_bytes: email.size,
      has_attachments: email.hasAttachments,
      is_read: email.isRead,
      is_starred: false,
      is_deleted: false,
      folder: 'All Mail',
      gmail_thread_id: email.gmailThreadId ? parseInt(email.gmailThreadId) : null,
      sync_status: 'synced'
    }
  }

  private generateMessageId(email: EmailMessage): string {
    return email.id && email.id.includes('@') ? email.id : 
           `<${email.uid}.${email.date.getTime()}@maily-app.local>`
  }

}