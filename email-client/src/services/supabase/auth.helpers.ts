import { supabase } from '@/config/supabase.config.ts'

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  
  if (error) {
    throw new Error(`Sign up failed: ${error.message}`)
  }
  
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    throw new Error(`Sign in failed: ${error.message}`)
  }
  
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    throw new Error(`Sign out failed: ${error.message}`)
  }
  
  return true
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    throw new Error(`Get user failed: ${error.message}`)
  }
  
  return user
}