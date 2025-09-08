import { type Session } from '@supabase/supabase-js'

export interface SessionContextType {
  session: Session | null
  loading: boolean
}