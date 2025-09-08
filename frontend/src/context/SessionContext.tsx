import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { type Session } from '@supabase/supabase-js'
import { type SessionContextType } from './session.types'


const SessionContext = createContext<SessionContextType>({
  session: null,
  loading: true,
})

export function SessionProvider({ children }: { children: React.ReactNode }) { // children: React... ist ein prop der übergeben wird und dabei ist der typ React.ReactNode also alles was ein react component ist z.b. ein button oder ein text
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SessionContext.Provider value={{ session, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}