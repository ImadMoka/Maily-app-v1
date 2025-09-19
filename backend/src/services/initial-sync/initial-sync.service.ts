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
        200 // Initial sync gets 200 emails
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

      // 2. Extract and save contacts first
      const contacts = this.contactService.extractContactsFromEmails(emails, new Map())

      if (contacts.length > 0) {
        const contactResult = await this.contactService.saveContactsWithRelationships(
          userClient,
          userId,
          accountId,  // Pass accountId to link contacts to this account
          contacts
        )
        
        contactsProcessed = contactResult.saved
        errors.push(...contactResult.errors)
      }

      // 3. Save emails with automatic contact linking
      const emailSaveResult = await this.emailService.saveEmails(
        userClient,
        accountId,
        userId,
        emails
      )

      emailsProcessed = emailSaveResult.saved + emailSaveResult.skipped
      errors.push(...emailSaveResult.errors)

      // 4. Fetch and save email bodies for saved emails
      if (emailSaveResult.savedEmails && emailSaveResult.savedEmails.length > 0) {
        try {
          console.log(`📨 Fetching bodies for ${emailSaveResult.savedEmails.length} emails...`)

          // Check which emails don't have bodies yet
          const emailIds = emailSaveResult.savedEmails.map(e => e.id)
          const { data: existingBodies } = await userClient
            .from('email_body')
            .select('email_id')
            .in('email_id', emailIds)

          const emailsNeedingBodies = emailSaveResult.savedEmails.filter(
            e => !existingBodies?.find(b => b.email_id === e.id)
          )

          if (emailsNeedingBodies.length > 0) {
            // Prepare email info for body fetching
            const emailInfo = emailsNeedingBodies.map(e => ({
              uid: e.uid,
              messageId: e.message_id,
              emailId: e.id
            }))

            // Fetch bodies from IMAP
            const bodiesWithMetadata = await this.imapService.fetchEmailBodies(
              imapConfig,
              emailInfo
            )

            // Save bodies to database
            await this.emailService.saveEmailBodies(userClient, bodiesWithMetadata)
            console.log(`💾 Saved ${bodiesWithMetadata.size} email bodies`)
          }
        } catch (error) {
          console.error('❌ Error fetching email bodies:', error)
          errors.push(`Body fetch error: ${error instanceof Error ? error.message : 'Unknown'}`)
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