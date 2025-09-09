import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from '@/config/supabase.config'
import type { Database } from '@/../../shared/types/database.types'


export const supabaseAdmin = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)