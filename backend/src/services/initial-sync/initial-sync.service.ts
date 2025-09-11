import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import { ImapService } from '../imap/imap.service'
import type { EmailMessage, EmailAddress, ImapConnectionConfig } from '../imap/imap.types'
import type { InitialSyncResult, ProcessedContact } from './initial-sync.types'

// Database types
type EmailInsert = Database['public']['Tables']['emails']['Insert']
type ContactInsert = Database['public']['Tables']['contacts']['Insert']



export class InitialSyncService {
  private imapService = new ImapService()

  /**
   * Perform initial sync for newly created account
   * Single-pass processing: each email handled exactly once
   */
  async performInitialSync(
    userClient: SupabaseClient<Database>,
    userId: string,
    accountId: string,
    imapConfig: ImapConnectionConfig
  ): Promise<InitialSyncResult> {
    const errors: string[] = []
    let emailsProcessed = 0
    let contactsProcessed = 0

    try {
      console.log(`🚀 Starting initial sync for account ${accountId}`)

      // 1. Fetch emails from IMAP (single fetch)
      const emailResult = await this.imapService.fetchRecentEmails(
        imapConfig,
        200, // Initial sync gets 200 emails
        { userId, accountId }
      )

      if (!emailResult.success || !emailResult.emails?.length) {
        console.log(`📭 No emails found for account ${accountId}`)
        return {
          success: true,
          emailsProcessed: 0,
          contactsProcessed: 0,
          errors: []
        }
      }

      const emails = emailResult.emails
      console.log(`📧 Processing ${emails.length} emails in single pass...`)

      // 2. Single-pass processing: each email handled once
      const contactsMap = new Map<string, ProcessedContact>() // email -> contact data
      const savedEmailIds = new Map<string, string>() // messageId -> database UUID

      for (const email of emails) {
        try {
          // A. Save email to database first
          const savedEmailId = await this.saveEmailToDatabase(userClient, accountId, email)
          if (savedEmailId) {
            savedEmailIds.set(email.messageId || '', savedEmailId)
            emailsProcessed++
          }

          // B. Extract contacts from this email and track relationships
          await this.processContactsFromEmail(email, savedEmailId, contactsMap)

        } catch (error) {
          const errorMsg = `Email ${email.subject}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error('❌', errorMsg)
        }
      }

      // 3. Batch save all contacts with email relationships
      if (contactsMap.size > 0) {
        contactsProcessed = await this.saveContactsWithRelationships(
          userClient,
          userId,
          Array.from(contactsMap.values())
        )
      }

      console.log(`✅ Initial sync completed: ${emailsProcessed} emails, ${contactsProcessed} contacts, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        emailsProcessed,
        contactsProcessed,
        errors
      }

    } catch (error) {
      const errorMsg = `Initial sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error('❌', errorMsg)
      
      return {
        success: false,
        emailsProcessed,
        contactsProcessed,
        errors: [errorMsg, ...errors]
      }
    }
  }

  /**
   * Save single email to database and return the database UUID
   */
  private async saveEmailToDatabase(
    userClient: SupabaseClient<Database>,
    accountId: string,
    email: EmailMessage
  ): Promise<string | null> {
    try {
      const dbEmail: EmailInsert = {
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
        folder: 'All Mail',
        gmail_thread_id: email.gmailThreadId ? parseInt(email.gmailThreadId) : null,
        sync_status: 'synced'
      }

      // Insert email and get the database UUID
      const { data, error } = await userClient
        .from('emails')
        .insert(dbEmail)
        .select('id')
        .single()

      if (error) {
        // Check if it's a duplicate (expected)
        if (error.code === '23505' || error.message.includes('duplicate')) {
          // For duplicates, try to get the existing email ID
          const { data: existing } = await userClient
            .from('emails')
            .select('id')
            .eq('account_id', accountId)
            .eq('message_id', dbEmail.message_id)
            .single()
          
          return existing?.id || null
        }
        throw error
      }

      return data.id
    } catch (error) {
      console.error(`Failed to save email ${email.subject}:`, error)
      return null
    }
  }

  /**
   * Extract contacts from single email and track email relationships
   */
  private async processContactsFromEmail(
    email: EmailMessage,
    savedEmailId: string | null,
    contactsMap: Map<string, ProcessedContact>
  ): Promise<void> {
    // Extract all addresses from this email
    const addresses = [
      email.from,
      ...(email.to || []),
      ...(email.cc || [])
    ].filter(Boolean) as EmailAddress[]

    for (const addr of addresses) {
      if (!addr.address) continue

      const emailAddr = addr.address.toLowerCase()
      

      // Check if we already have this contact
      if (!contactsMap.has(emailAddr)) {
        // New contact
        contactsMap.set(emailAddr, {
          email: emailAddr,
          name: addr.name?.trim().substring(0, 100) || '',
          lastEmailId: savedEmailId || undefined,
          lastEmailPreview: this.extractPreview(email.bodyPreview) || undefined,
          lastEmailAt: email.date.toISOString()
        })
      } else {
        // Existing contact - update if this email is more recent
        const existing = contactsMap.get(emailAddr)!
        const existingDate = existing.lastEmailAt ? new Date(existing.lastEmailAt) : new Date(0)
        
        if (email.date > existingDate) {
          // This email is more recent, update the relationship
          existing.lastEmailId = savedEmailId || existing.lastEmailId
          existing.lastEmailPreview = this.extractPreview(email.bodyPreview) || existing.lastEmailPreview
          existing.lastEmailAt = email.date.toISOString()
          
          // Update name if current contact doesn't have one
          if (!existing.name && addr.name) {
            existing.name = addr.name.trim().substring(0, 100)
          }
        }
      }
    }
  }

  /**
   * Batch save all contacts with email relationships
   */
  private async saveContactsWithRelationships(
    userClient: SupabaseClient<Database>,
    userId: string,
    contacts: ProcessedContact[]
  ): Promise<number> {
    try {
      const contactsData: ContactInsert[] = contacts.map(contact => ({
        user_id: userId,
        email: contact.email,
        name: contact.name,
        last_email_id: contact.lastEmailId || null,
        last_email_preview: contact.lastEmailPreview || null,
        last_email_at: contact.lastEmailAt || null,
        is_read: true // Default to read for now
      }))

      const { data, error } = await userClient
        .from('contacts')
        .upsert(contactsData, { onConflict: 'user_id,email', ignoreDuplicates: false })
        .select('id')

      if (error) {
        console.error('Failed to save contacts:', error)
        return 0
      }

      return data?.length || 0
    } catch (error) {
      console.error('Error saving contacts:', error)
      return 0
    }
  }

  // Helper methods
  private generateMessageId(email: EmailMessage): string {
    return email.messageId && email.messageId.includes('@') ? email.messageId : 
           `<${email.uid}.${email.date.getTime()}@maily-app.local>`
  }

  private extractPreview(text: string | null | undefined): string | null {
    if (!text) return null
    return text.trim().substring(0, 150).replace(/\s+/g, ' ')
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255
  }

  private isNoReplyEmail(email: string): boolean {
    return ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster']
      .some(pattern => email.includes(pattern))
  }
}