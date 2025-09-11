import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/../../shared/types/database.types'

export interface CreateAccountData {
  email: string
  password: string
  imapHost: string
  imapPort: number
  imapUsername: string
}

export class AccountService {
  
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

}