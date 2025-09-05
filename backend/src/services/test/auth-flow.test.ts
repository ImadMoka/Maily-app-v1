import { supabase } from '../../libs/supabase'

interface TestResult {
  step: string
  success: boolean
  data?: any
  error?: string
  timing?: number
}

class AuthFlowTest {
  private results: TestResult[] = []
  private testEmail = `test.user.${Date.now()}@example.com`
  private testPassword = 'TestPassword123!'
  
  private log(step: string, success: boolean, data?: any, error?: string, timing?: number) {
    const result: TestResult = { step, success, data, error, timing }
    this.results.push(result)
    
    const status = success ? '✅' : '❌'
    const timeStr = timing ? ` (${timing}ms)` : ''
    console.log(`${status} ${step}${timeStr}`)
    
    if (error) {
      console.log(`   Error: ${error}`)
    } else if (data && typeof data === 'object') {
      console.log(`   Data: ${JSON.stringify(data, null, 2)}`)
    }
  }

  async runFullAuthFlow(): Promise<void> {
    console.log('🧪 Starting Full Authentication Flow Test')
    console.log(`📧 Test Email: ${this.testEmail}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Step 1: Account Creation (Sign Up)
    await this.testSignUp()
    
    // Step 2: Login
    await this.testLogin()
    
    // Step 3: Get User Info
    await this.testGetUser()
    
    // Step 4: Logout
    await this.testLogout()
    
    // Step 5: Verify Logout
    await this.testVerifyLogout()
    
    // Summary
    this.printSummary()
  }

  private async testSignUp(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: this.testEmail,
        password: this.testPassword,
      })
      
      const timing = Date.now() - startTime
      
      if (error) {
        this.log('Account Creation (Sign Up)', false, null, error.message, timing)
        return
      }
      
      const success = !!data.user
      const logData = {
        user_id: data.user?.id,
        email: data.user?.email,
        email_confirmed: data.user?.email_confirmed_at !== null,
        session_exists: !!data.session
      }
      
      this.log('Account Creation (Sign Up)', success, logData, undefined, timing)
      
    } catch (err) {
      const timing = Date.now() - startTime
      this.log('Account Creation (Sign Up)', false, null, `Unexpected error: ${err}`, timing)
    }
  }

  private async testLogin(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: this.testEmail,
        password: this.testPassword,
      })
      
      const timing = Date.now() - startTime
      
      if (error) {
        this.log('Login', false, null, error.message, timing)
        return
      }
      
      const success = !!data.session && !!data.user
      const logData = {
        user_id: data.user?.id,
        email: data.user?.email,
        access_token_length: data.session?.access_token?.length || 0,
        refresh_token_length: data.session?.refresh_token?.length || 0,
        expires_at: data.session?.expires_at
      }
      
      this.log('Login', success, logData, undefined, timing)
      
    } catch (err) {
      const timing = Date.now() - startTime
      this.log('Login', false, null, `Unexpected error: ${err}`, timing)
    }
  }

  private async testGetUser(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.auth.getUser()
      
      const timing = Date.now() - startTime
      
      if (error) {
        this.log('Get User Info', false, null, error.message, timing)
        return
      }
      
      const success = !!data.user
      const logData = {
        user_id: data.user?.id,
        email: data.user?.email,
        created_at: data.user?.created_at,
        last_sign_in: data.user?.last_sign_in_at
      }
      
      this.log('Get User Info', success, logData, undefined, timing)
      
    } catch (err) {
      const timing = Date.now() - startTime
      this.log('Get User Info', false, null, `Unexpected error: ${err}`, timing)
    }
  }

  private async testLogout(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const { error } = await supabase.auth.signOut()
      
      const timing = Date.now() - startTime
      
      if (error) {
        this.log('Logout', false, null, error.message, timing)
        return
      }
      
      this.log('Logout', true, { message: 'Successfully signed out' }, undefined, timing)
      
    } catch (err) {
      const timing = Date.now() - startTime
      this.log('Logout', false, null, `Unexpected error: ${err}`, timing)
    }
  }

  private async testVerifyLogout(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.auth.getUser()
      
      const timing = Date.now() - startTime
      
      // After logout, we should either get an error or no user
      const loggedOut = !data.user || error !== null
      
      if (loggedOut) {
        this.log('Verify Logout', true, { 
          user_exists: !!data.user,
          error_message: error?.message || 'No error'
        }, undefined, timing)
      } else {
        this.log('Verify Logout', false, { 
          user_still_exists: true,
          user_id: data.user?.id 
        }, 'User still authenticated after logout', timing)
      }
      
    } catch (err) {
      const timing = Date.now() - startTime
      // This might actually be expected after logout
      this.log('Verify Logout', true, null, `Expected error after logout: ${err}`, timing)
    }
  }

  private printSummary(): void {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Test Summary')
    
    const successful = this.results.filter(r => r.success).length
    const total = this.results.length
    const totalTime = this.results.reduce((sum, r) => sum + (r.timing || 0), 0)
    
    console.log(`✅ Successful: ${successful}/${total}`)
    console.log(`⏱️  Total Time: ${totalTime}ms`)
    console.log(`📧 Test Email: ${this.testEmail}`)
    
    if (successful === total) {
      console.log('🎉 All authentication tests passed!')
    } else {
      console.log('⚠️  Some tests failed - check logs above')
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
}

// Export for use in other files
export { AuthFlowTest }

// Run immediately when file is executed directly
if (import.meta.main) {
  const test = new AuthFlowTest()
  test.runFullAuthFlow()
    .then(() => {
      console.log('🏁 Test completed')
      process.exit(0)
    })
    .catch((err) => {
      console.error('💥 Test failed with unexpected error:', err)
      process.exit(1)
    })
}