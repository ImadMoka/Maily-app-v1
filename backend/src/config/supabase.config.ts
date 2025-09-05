import 'dotenv/config'

export const supabaseConfig = {
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  options: {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
}

if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  throw new Error('Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY')
}

if (!supabaseConfig.serviceKey) {
  console.warn('Warning: SUPABASE_SERVICE_KEY not found. Admin operations will be limited.')
}

