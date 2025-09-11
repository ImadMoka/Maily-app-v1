import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import { ImapService } from '../imap/imap.service'
import { EmailDatabaseService } from '../emails/email.service'
import { ContactService } from '../contacts/contact.service'
import type { ImapConnectionConfig } from '../imap/imap.types'
import type { InitialSyncResult } from './initial-sync.types'



export class InitialSyncService {
  private imapService = new ImapService()
  private emailService = new EmailDatabaseService()
  private contactService = new ContactService()

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

      // 2. Save all emails to database (with ID mapping for contacts)
      const emailSaveResult = await this.emailService.saveEmails(
        userClient,
        accountId,
        emails,
        true // Return ID mapping for contact relationships
      )
      
      emailsProcessed = emailSaveResult.saved + emailSaveResult.skipped
      errors.push(...emailSaveResult.errors)

      // 3. Extract and save contacts with email relationships
      if (emailSaveResult.emailIdMap && emailSaveResult.emailIdMap.size > 0) {
        const contacts = this.contactService.extractContactsFromEmails(emails, emailSaveResult.emailIdMap)
        
        if (contacts.length > 0) {
          const contactResult = await this.contactService.saveContactsWithRelationships(
            userClient,
            userId,
            contacts
          )
          
          contactsProcessed = contactResult.saved
          errors.push(...contactResult.errors)
        }
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

}