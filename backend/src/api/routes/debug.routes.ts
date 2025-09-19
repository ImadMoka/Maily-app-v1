import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/../../shared/types/database.types'

export class DebugRoutes {

  // Delete ALL accounts from ALL users (admin operation)
  async handleDeleteAllAccountsAdmin(request: Request): Promise<Response> {
    try {
      console.log('🔧 DEBUG: Admin deletion of ALL accounts initiated')

      // Check for required environment variables
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        console.error('Missing environment variables:')
        console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
        console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing')
        console.error('Using SUPABASE_ANON_KEY as fallback:', process.env.SUPABASE_ANON_KEY ? 'Yes' : 'No')

        return Response.json({
          error: 'Configuration error',
          message: 'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to backend/.env file.',
          details: 'For admin operations, you need the service role key, not just the anon key.'
        }, { status: 500 })
      }

      // Use admin client with service role key (bypasses RLS)
      const adminClient = createClient<Database>(
        supabaseUrl,
        serviceRoleKey
      )

      // Get ALL accounts from ALL users
      const { data: allAccounts, error: fetchError } = await adminClient
        .from('email_accounts')
        .select('*')

      if (fetchError) {
        console.error('Failed to fetch accounts:', fetchError)
        return Response.json({
          error: 'Failed to fetch accounts',
          details: fetchError.message
        }, { status: 500 })
      }

      if (!allAccounts || allAccounts.length === 0) {
        return Response.json({
          success: true,
          message: 'No accounts to delete',
          deletedCount: 0,
          totalAccounts: 0
        })
      }

      console.log(`Found ${allAccounts.length} accounts to delete`)

      // Delete ALL accounts (cascade will handle related data)
      const { error: deleteError } = await adminClient
        .from('email_accounts')
        .delete()
        .not('id', 'is', null) // Delete all records

      if (deleteError) {
        console.error('Failed to delete accounts:', deleteError)
        return Response.json({
          error: 'Failed to delete accounts',
          details: deleteError.message
        }, { status: 500 })
      }

      // Also clear ALL data from related tables for complete cleanup
      console.log('Cleaning up related tables...')

      // Delete all emails
      await adminClient.from('emails').delete().not('id', 'is', null)

      // Delete all email bodies
      await adminClient.from('email_body').delete().not('id', 'is', null)

      // Delete all contacts
      await adminClient.from('contacts').delete().not('id', 'is', null)

      // Delete all threads
      await adminClient.from('threads').delete().not('id', 'is', null)

      console.log(`✅ Successfully deleted ${allAccounts.length} accounts and all related data`)

      return Response.json({
        success: true,
        message: `Deleted ALL ${allAccounts.length} accounts from ALL users`,
        deletedCount: allAccounts.length,
        totalAccounts: allAccounts.length,
        accounts: allAccounts.map(a => ({
          id: a.id,
          email: a.email,
          user_id: a.user_id
        }))
      })

    } catch (error) {
      console.error('DEBUG endpoint error:', error)
      return Response.json({
        error: error instanceof Error ? error.message : 'Unknown error in debug endpoint'
      }, { status: 500 })
    }
  }

  // Get statistics about all accounts (admin operation)
  async handleGetAccountStats(request: Request): Promise<Response> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        return Response.json({
          error: 'Configuration error',
          message: 'SUPABASE_SERVICE_ROLE_KEY is not set'
        }, { status: 500 })
      }

      const adminClient = createClient<Database>(
        supabaseUrl,
        serviceRoleKey
      )

      // Count all accounts
      const { count: accountCount } = await adminClient
        .from('email_accounts')
        .select('*', { count: 'exact', head: true })

      // Count all emails
      const { count: emailCount } = await adminClient
        .from('emails')
        .select('*', { count: 'exact', head: true })

      // Count all contacts
      const { count: contactCount } = await adminClient
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      // Count all threads
      const { count: threadCount } = await adminClient
        .from('threads')
        .select('*', { count: 'exact', head: true })

      return Response.json({
        accounts: accountCount || 0,
        emails: emailCount || 0,
        contacts: contactCount || 0,
        threads: threadCount || 0,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      return Response.json({
        error: 'Failed to get stats'
      }, { status: 500 })
    }
  }
}