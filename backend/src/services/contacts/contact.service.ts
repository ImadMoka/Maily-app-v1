import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../../shared/types/database.types'
import type { EmailMessage, EmailAddress } from '../imap/imap.types'

type ContactInsert = Database['public']['Tables']['contacts']['Insert']

export interface ExtractContactsResult {
  newContacts: number
  totalProcessed: number
}

export class ContactService {
  async extractAndSaveContacts(
    userClient: SupabaseClient<Database>,
    userId: string,
    emails: EmailMessage[]
  ): Promise<ExtractContactsResult> {
    if (emails.length === 0) {
      return { newContacts: 0, totalProcessed: 0 }
    }

    // Extract all email addresses
    const allEmails = new Set<string>()
    const emailToName = new Map<string, string>()

    for (const email of emails) {
      this.extractEmailAddresses([email.from, ...(email.to || []), ...(email.cc || [])], allEmails, emailToName)
    }

    // Filter valid emails
    const validEmails = Array.from(allEmails).filter(email => 
      this.isValidEmail(email) && !this.isNoReplyEmail(email)
    )

    // Get the most recent email for preview and relationship data
    const mostRecentEmail = emails.length > 0 ? emails[0] : null
    
    // Save contacts with conflict handling and email relationship data
    const { data } = await userClient
      .from('contacts')
      .upsert(
        validEmails.map(email => ({
          user_id: userId,
          email,
          name: emailToName.get(email) || '',
          // Set email relationship fields for contacts that appear in the most recent email
          last_email_id: mostRecentEmail && this.emailContainsAddress(mostRecentEmail, email) ? mostRecentEmail.id : null,
          last_email_preview: mostRecentEmail && this.emailContainsAddress(mostRecentEmail, email) ? this.extractPreview(mostRecentEmail.preview_text) : null,
          last_email_at: mostRecentEmail && this.emailContainsAddress(mostRecentEmail, email) ? mostRecentEmail.date_sent : null,
          is_read: true  // Default to read for now, will implement logic later
        })),
        { onConflict: 'user_id,email', ignoreDuplicates: false }
      )
      .select('id')

    return {
      newContacts: data?.length || 0,
      totalProcessed: validEmails.length
    }
  }

  private extractEmailAddresses(
    addresses: EmailAddress[], 
    emailSet: Set<string>, 
    nameMap: Map<string, string>
  ): void {
    for (const addr of addresses) {
      if (addr?.address) {
        const email = addr.address.toLowerCase()
        emailSet.add(email)
        if (addr.name && !nameMap.has(email)) {
          nameMap.set(email, addr.name.trim().substring(0, 100))
        }
      }
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255
  }

  private isNoReplyEmail(email: string): boolean {
    return ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster']
      .some(pattern => email.includes(pattern))
  }

  private emailContainsAddress(email: EmailMessage, address: string): boolean {
    const allAddresses = [
      email.from?.address,
      ...(email.to || []).map(addr => addr.address),
      ...(email.cc || []).map(addr => addr.address)
    ].filter(Boolean)
    
    return allAddresses.some(addr => addr?.toLowerCase() === address.toLowerCase())
  }

  private extractPreview(text: string | null | undefined): string | null {
    if (!text) return null
    // Extract first 150 characters, removing extra whitespace
    return text.trim().substring(0, 150).replace(/\s+/g, ' ')
  }
}