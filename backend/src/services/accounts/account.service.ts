import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/../../shared/types/database.types'
import { ImapService, type ImapConnectionConfig } from '../imap/imap.service'
import { ContactService, type ExtractContactsResult } from '../contacts/contact.service'

export interface CreateAccountData {
  email: string
  password: string
  imapHost: string
  imapPort: number
  imapUsername: string
}

export class AccountService {
  private imapService = new ImapService()
  private contactService = new ContactService()
  
  // Create email account using user client (RLS enforced)
  async createAccount(userClient: SupabaseClient<Database>, data: CreateAccountData, userId: string) {
    // Insert account - RLS automatically ensures user can only create for themselves
    const { data: account, error } = await userClient
      .from('email_accounts')
      .insert({
        user_id: userId,
        email: data.email,
        password: data.password,
        imap_host: data.imapHost,
        imap_username: data.imapUsername,
        imap_port: data.imapPort,
        imap_use_tls: true,
        is_active: true,
        sync_status: 'idle'
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create account: ${error.message}`)
    return account
  }

  // Get user's accounts using user client (RLS enforced)
  async getUserAccounts(userClient: SupabaseClient<Database>, userId: string) {
    const { data: accounts, error } = await userClient
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch accounts: ${error.message}`)
    return accounts
  }

  // Get specific account by ID (RLS enforced - user can only access their own accounts)
  async getAccountNewest(userClient: SupabaseClient<Database>, userId: string) {
    const { data: account, error } = await userClient
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Account not found or access denied')
      }
      throw new Error(`Failed to fetch account: ${error.message}`)
    }
    return account
  }

  // Delete account by ID (RLS enforced - user can only delete their own accounts)
  async deleteAccount(userClient: SupabaseClient<Database>, accountId: string, userId: string) {
    const { error } = await userClient
      .from('email_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to delete account: ${error.message}`)
  }

  // Initialize contacts for a newly created account
  async initializeContactsAsync(
    userClient: SupabaseClient<Database>,
    userId: string,
    account: { id: string; email: string },
    imapConfig: ImapConnectionConfig
  ): Promise<void> {
    try {
      const result = await this.fetchContactsForNewAccount(userClient, userId, account, imapConfig)
      console.log(`Contact initialization completed for account ${account.id}: ${result.newContacts} new contacts from ${result.totalProcessed} processed`)
    } catch (error) {
      console.error(`Contact initialization failed for account ${account.id}:`, error)
      // Don't throw - we don't want contact extraction failures to affect account creation
    }
  }

  private async fetchContactsForNewAccount(
    userClient: SupabaseClient<Database>,
    userId: string,
    account: { id: string; email: string },
    imapConfig: ImapConnectionConfig
  ): Promise<ExtractContactsResult> {
    const emailResult = await this.imapService.fetchRecentEmails(
      imapConfig, 
      200,
      { userId, accountId: account.id }
    )

    if (!emailResult.success || !emailResult.emails?.length) {
      return { newContacts: 0, totalProcessed: 0 }
    }

    return await this.contactService.extractAndSaveContacts(
      userClient,
      userId,
      emailResult.emails
    )
  }
}