import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import type { EmailMessage } from '../imap/imap.types'

// Database types from shared schema
type EmailRow = Database['public']['Tables']['emails']['Row']
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
   * Get emails from database for an account
   * Used for fast retrieval without IMAP calls
   */
  async getEmails(
    userClient: SupabaseClient<Database>,
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<EmailRow[]> {
    
    const { data: emails, error } = await userClient
      .from('emails')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_deleted', false)
      .order('date_sent', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to fetch emails from database: ${error.message}`)
    }

    return emails || []
  }

  /**
   * Convert IMAP EmailMessage to database insert format
   * Maps between our IMAP types and Supabase schema
   */
  private convertImapEmailToDbFormat(email: EmailMessage, accountId: string): EmailInsert {
    // Generate a unique message ID if not present
    const messageId = this.generateMessageId(email)
    
    // Extract thread ID from subject or message ID
    const threadId = this.extractThreadId(email.subject, messageId)

    return {
      account_id: accountId,
      imap_uid: email.uid,
      message_id: messageId,
      
      // Header information
      subject: email.subject || null,
      from_address: email.from.email,
      from_name: email.from.name || null,
      to_addresses: this.convertAddressesToJson(email.to),
      date_sent: email.date.toISOString(),
      
      // Content (we don't have full body from headers-only fetch)
      body_text: email.preview || null,
      body_html: null,
      
      // Metadata
      size_bytes: email.size,
      has_attachments: email.hasAttachments,
      attachment_count: email.hasAttachments ? 1 : 0, // Estimate
      
      // Status
      is_read: email.isRead,
      is_starred: false,
      is_deleted: false,
      is_spam: false,
      
      // Threading
      thread_id: threadId,
      thread_position: 0,
      is_thread_root: true,
      
      // Folder/labels
      folder: 'INBOX',
      labels: [],
      
      // Sync status
      sync_status: 'synced',
      last_sync_at: new Date().toISOString()
    }
  }

  /**
   * Convert EmailAddress array to JSONB format
   */
  private convertAddressesToJson(addresses: any[]): any {
    return addresses.map(addr => ({
      email: addr.email,
      name: addr.name || null
    }))
  }

  /**
   * Generate or extract message ID
   */
  private generateMessageId(email: EmailMessage): string {
    // If we have a proper message ID, use it
    if (email.id && email.id.includes('@')) {
      return email.id
    }
    
    // Generate one based on UID and date
    const timestamp = email.date.getTime()
    return `<${email.uid}.${timestamp}@maily-app.local>`
  }

  /**
   * Extract thread ID for conversation grouping
   * Simplified threading based on subject
   */
  private extractThreadId(subject: string, messageId: string): string {
    if (!subject) return messageId
    
    // Remove "Re:", "Fwd:", etc. prefixes and normalize
    const cleanSubject = subject
      .replace(/^(re|fwd|fw):\s*/i, '')
      .trim()
      .toLowerCase()
    
    // Use a hash of the clean subject as thread ID
    return `thread_${cleanSubject}`
  }

  /**
   * Simple hash function for thread grouping
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Update email status (read, starred, etc.)
   */
  async updateEmailStatus(
    userClient: SupabaseClient<Database>,
    emailId: string,
    updates: Partial<Pick<EmailRow, 'is_read' | 'is_starred' | 'is_deleted'>>
  ): Promise<boolean> {
    
    const { error } = await userClient
      .from('emails')
      .update(updates)
      .eq('id', emailId)

    if (error) {
      throw new Error(`Failed to update email status: ${error.message}`)
    }

    return true
  }

  /**
   * Get unread email count for an account
   */
  async getUnreadCount(
    userClient: SupabaseClient<Database>,
    accountId: string
  ): Promise<number> {
    
    const { count, error } = await userClient
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('is_read', false)
      .eq('is_deleted', false)

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`)
    }

    return count || 0
  }
}