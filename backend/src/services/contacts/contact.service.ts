import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import type { EmailMessage, EmailAddress } from '../imap/imap.types'
import type { ContactProcessingResult, ProcessedContact, ContactWithEmailData } from './contact.types'

// Database types
type ContactInsert = Database['public']['Tables']['contacts']['Insert']

export class ContactService {

  /**
   * Extract contacts from emails and calculate read status
   */
  extractContactsFromEmails(
    emails: EmailMessage[], 
    emailIdMap: Map<string, string>
  ): ProcessedContact[] {
    const contactsMap = new Map<string, ProcessedContact>()
    const contactsWithUnread = new Set<string>() // Track contacts with unread emails

    for (const email of emails) {
      const savedEmailId = emailIdMap.get(email.messageId || '')
      
      // Track which contacts have unread emails
      if (!email.isRead && email.from?.address) {
        contactsWithUnread.add(email.from.address.toLowerCase())
      }
      
      this.processContactsFromEmail(email, savedEmailId || null, contactsMap)
    }

    // Set read status: contact is unread if they have any unread emails
    for (const contact of contactsMap.values()) {
      contact.isRead = !contactsWithUnread.has(contact.email)
    }

    return Array.from(contactsMap.values())
  }

  /**
   * Extract contacts from single email and update contacts map
   * Tracks most recent email relationship for each contact
   */
  private processContactsFromEmail(
    email: EmailMessage,
    savedEmailId: string | null,
    contactsMap: Map<string, ProcessedContact>
  ): void {
    // Extract all addresses from this email
    const addresses = [
      email.from,
      ...(email.to || []),
      ...(email.cc || [])
    ].filter(Boolean) as EmailAddress[]

    for (const addr of addresses) {
      if (!addr.address || !this.isValidEmail(addr.address)) continue

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
          
          // Update name if current contact doesn't have one and this one does
          if (!existing.name && addr.name) {
            existing.name = addr.name.trim().substring(0, 100)
          }
        }
      }
    }
  }

  /**
   * Save/upsert contacts to database with email relationships
   * Uses upsert to handle existing contacts gracefully
   */
  async saveContactsWithRelationships(
    userClient: SupabaseClient<Database>,
    userId: string,
    accountId: string,  // Added accountId parameter
    contacts: ProcessedContact[]
  ): Promise<ContactProcessingResult> {
    if (contacts.length === 0) {
      return {
        success: true,
        saved: 0,
        errors: []
      }
    }

    try {
      const contactsData: ContactInsert[] = contacts.map(contact => ({
        user_id: userId,
        email: contact.email,
        name: contact.name,
        last_email_id: contact.lastEmailId || null,
        last_email_preview: contact.lastEmailPreview || null,
        last_email_at: contact.lastEmailAt || null,
        is_read: contact.isRead ?? true
      }))

      const { data, error } = await userClient
        .from('contacts')
        .upsert(contactsData, { onConflict: 'user_id,email', ignoreDuplicates: false })
        .select('id, email')

      if (error) {
        console.error('Failed to save contacts:', error)
        return {
          success: false,
          saved: 0,
          errors: [error.message]
        }
      }

      // Create contact-account associations
      if (data && data.length > 0) {
        const contactAccountsData = data.map(contact => ({
          contact_id: contact.id,
          account_id: accountId
        }))

        await userClient
          .from('contact_accounts')
          .upsert(contactAccountsData, { onConflict: 'contact_id,account_id', ignoreDuplicates: true })
      }

      return {
        success: true,
        saved: data?.length || 0,
        errors: []
      }
    } catch (error) {
      const errorMsg = `Contact save error: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      
      return {
        success: false,
        saved: 0,
        errors: [errorMsg]
      }
    }
  }


  // Helper methods
  private extractPreview(text: string | null | undefined): string | null {
    if (!text) return null
    return text.trim().substring(0, 150).replace(/\s+/g, ' ')
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255
  }


}