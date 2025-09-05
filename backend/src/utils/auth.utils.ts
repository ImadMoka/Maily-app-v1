import { supabaseAdmin } from '@/libs/supabase/client'
import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from '@/config/supabase.config'
import type { Database } from '../../../shared/types/database.types'

export class AuthUtils {
  
  // Validate token using admin client, return user
  static async validateToken(authHeader?: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      throw new Error('Invalid token')
    }

    return { user, token }
  }

  // Create user client for secure operations (RLS enforced)
  static createUserClient(token: string) {
    // Create client with user's token in authorization header
    const userClient = createClient<Database>(
      supabaseConfig.url,
      supabaseConfig.anonKey,
      {
        ...supabaseConfig.options,
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    return userClient
  }
}