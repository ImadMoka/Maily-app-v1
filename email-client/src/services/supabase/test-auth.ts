import { signUp, signIn, signOut, getCurrentUser } from '@/services/supabase/auth.helpers.ts'

async function testAuthentication() {
  const testEmail = 'test' + Date.now() + '@gmail.com'
  const testPassword = 'testpassword123'
  
  try {
    console.log('Testing Supabase authentication...')
    
    console.log('1. Creating test user...')
    const signUpResult = await signUp(testEmail, testPassword)
    console.log('✓ User created:', signUpResult.user?.email)
    
    console.log('2. Signing in...')
    const signInResult = await signIn(testEmail, testPassword)
    console.log('✓ User signed in:', signInResult.user?.email)
    
    console.log('3. Getting current user...')
    const currentUser = await getCurrentUser()
    console.log('✓ Current user:', currentUser?.email)
    
    console.log('4. Signing out...')
    await signOut()
    console.log('✓ User signed out')
    
    console.log('\n🎉 All authentication tests passed!')
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error instanceof Error ? error.message : error)
  }
}

testAuthentication()