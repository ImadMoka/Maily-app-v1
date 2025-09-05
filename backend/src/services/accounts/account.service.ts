import type { Database } from '../../../../shared/types/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

type EmailAccount = Database['public']['Tables']['email_accounts']['Row']
type EmailAccountInsert = Database['public']['Tables']['email_accounts']['Insert']

export interface CreateAccountRequest {
  email: string
  password: string
  displayName?: string
  providerType?: string
  imapHost: string
  imapPort?: number
  imapUseTls?: boolean
  imapUsername: string
}

export interface AccountServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class AccountService {
  
  async createAccount(userClient: SupabaseClient<Database>, accountData: CreateAccountRequest): Promise<AccountServiceResponse<EmailAccount>> {
    try {
      // Get user from the client session
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const insertData: EmailAccountInsert = {
        user_id: user.id,
        email: accountData.email,
        password: accountData.password,
        display_name: accountData.displayName || null,
        provider_type: accountData.providerType || null,
        imap_host: accountData.imapHost,
        imap_port: accountData.imapPort || 993,
        imap_use_tls: accountData.imapUseTls ?? true,
        imap_username: accountData.imapUsername,
        is_active: true,
        sync_status: 'pending'
      }

      const { data, error } = await userClient
        .from('email_accounts')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: `Failed to create account: ${error.message}`
        }
      }

      return {
        success: true,
        data: data
      }

    } catch (err) {
      return {
        success: false,
        error: `Account creation error: ${err}`
      }
    }
  }

  async getUserAccounts(userId: string): Promise<AccountServiceResponse<EmailAccount[]>> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return {
          success: false,
          error: `Failed to fetch accounts: ${error.message}`
        }
      }

      return {
        success: true,
        data: data || []
      }

    } catch (err) {
      return {
        success: false,
        error: `Fetch accounts error: ${err}`
      }
    }
  }

  async deleteAccount(userId: string, accountId: string): Promise<AccountServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', userId) // Ensure user can only delete their own accounts

      if (error) {
        return {
          success: false,
          error: `Failed to delete account: ${error.message}`
        }
      }

      return {
        success: true
      }

    } catch (err) {
      return {
        success: false,
        error: `Delete account error: ${err}`
      }
    }
  }

  async getAccountById(userId: string, accountId: string): Promise<AccountServiceResponse<EmailAccount>> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('user_id', userId) // Ensure user can only access their own accounts
        .single()

      if (error) {
        return {
          success: false,
          error: `Failed to fetch account: ${error.message}`
        }
      }

      return {
        success: true,
        data: data
      }

    } catch (err) {
      return {
        success: false,
        error: `Fetch account error: ${err}`
      }
    }
  }

  async updateAccountStatus(userId: string, accountId: string, isActive: boolean): Promise<AccountServiceResponse<EmailAccount>> {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .update({ 
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: `Failed to update account status: ${error.message}`
        }
      }

      return {
        success: true,
        data: data
      }

    } catch (err) {
      return {
        success: false,
        error: `Update account error: ${err}`
      }
    }
  }
}