import { supabase } from '../../libs/supabase'

class AccountManagementTest {
  private testEmail = `test.user.${Date.now()}@example.com`
  private testPassword = 'TestPassword123!'
  private accessToken: string | null = null
  private createdAccountId: string | null = null

  async runTest(): Promise<void> {
    console.log('📧 Testing Complete Account Management Workflow')
    console.log(`👤 Test User: ${this.testEmail}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Step 1: Setup - Create user and get token
    await this.signupAndGetToken()
    
    // Step 2: Add email account
    await this.testAddAccount()
    
    // Step 3: List accounts
    await this.testListAccounts()
    
    // Step 4: Update account status
    await this.testUpdateAccountStatus()
    
    // Step 5: Delete account
    await this.testDeleteAccount()
    
    // Step 6: Verify account deleted
    await this.testVerifyAccountDeleted()
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 Account management test completed!')
  }

  private async signupAndGetToken(): Promise<void> {
    console.log('1️⃣ Creating test user and getting access token...')
    
    const { data, error } = await supabase.auth.signUp({
      email: this.testEmail,
      password: this.testPassword,
    })

    if (error || !data.session) {
      console.log('❌ Failed to signup:', error?.message)
      return
    }

    this.accessToken = data.session.access_token
    console.log('✅ User created and authenticated')
  }

  private async testAddAccount(): Promise<void> {
    console.log('\n2️⃣ Testing add email account...')
    
    if (!this.accessToken) {
      console.log('❌ No access token available')
      return
    }

    try {
      const response = await fetch('http://localhost:3000/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          email: 'test.gmail@example.com',
          password: 'app-specific-password',
          displayName: 'My Gmail Account',
          providerType: 'gmail',
          imapHost: 'imap.gmail.com',
          imapPort: 993,
          imapUseTls: true,
          imapUsername: 'test.gmail@example.com'
        })
      })

      const result = await response.json()
      
      if (response.status === 200 && result.success) {
        this.createdAccountId = result.account.id
        console.log('✅ Account created successfully')
        console.log(`   Account ID: ${result.account.id}`)
        console.log(`   Email: ${result.account.email}`)
        console.log(`   Display Name: ${result.account.display_name}`)
        console.log(`   Provider: ${result.account.provider_type}`)
      } else {
        console.log('❌ Failed to create account')
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${result.error}`)
      }

    } catch (err) {
      console.log('❌ Network error:', err)
    }
  }

  private async testListAccounts(): Promise<void> {
    console.log('\n3️⃣ Testing list user accounts...')
    
    if (!this.accessToken) {
      console.log('❌ No access token available')
      return
    }

    try {
      const response = await fetch('http://localhost:3000/api/accounts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      const result = await response.json()
      
      if (response.status === 200 && result.success) {
        console.log('✅ Accounts retrieved successfully')
        console.log(`   Account count: ${result.count}`)
        
        if (result.accounts.length > 0) {
          const account = result.accounts[0]
          console.log(`   First account: ${account.email} (${account.provider_type})`)
          console.log(`   Status: ${account.is_active ? 'Active' : 'Inactive'}`)
          console.log(`   IMAP: ${account.imap_host}:${account.imap_port}`)
        }
      } else {
        console.log('❌ Failed to list accounts')
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${result.error}`)
      }

    } catch (err) {
      console.log('❌ Network error:', err)
    }
  }

  private async testUpdateAccountStatus(): Promise<void> {
    console.log('\n4️⃣ Testing update account status...')
    
    if (!this.accessToken || !this.createdAccountId) {
      console.log('❌ Missing access token or account ID')
      return
    }

    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${this.createdAccountId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          is_active: false
        })
      })

      const result = await response.json()
      
      if (response.status === 200 && result.success) {
        console.log('✅ Account status updated successfully')
        console.log(`   Account ID: ${result.account.id}`)
        console.log(`   New Status: ${result.account.is_active ? 'Active' : 'Inactive'}`)
      } else {
        console.log('❌ Failed to update account status')
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${result.error}`)
      }

    } catch (err) {
      console.log('❌ Network error:', err)
    }
  }

  private async testDeleteAccount(): Promise<void> {
    console.log('\n5️⃣ Testing delete account...')
    
    if (!this.accessToken || !this.createdAccountId) {
      console.log('❌ Missing access token or account ID')
      return
    }

    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${this.createdAccountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      const result = await response.json()
      
      if (response.status === 200 && result.success) {
        console.log('✅ Account deleted successfully')
        console.log(`   Message: ${result.message}`)
      } else {
        console.log('❌ Failed to delete account')
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${result.error}`)
      }

    } catch (err) {
      console.log('❌ Network error:', err)
    }
  }

  private async testVerifyAccountDeleted(): Promise<void> {
    console.log('\n6️⃣ Verifying account was deleted...')
    
    if (!this.accessToken) {
      console.log('❌ No access token available')
      return
    }

    try {
      const response = await fetch('http://localhost:3000/api/accounts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      const result = await response.json()
      
      if (response.status === 200 && result.success) {
        console.log('✅ Account list retrieved for verification')
        console.log(`   Remaining account count: ${result.count}`)
        
        if (result.count === 0) {
          console.log('✅ Confirmed: No accounts remain (deletion successful)')
        } else {
          console.log('⚠️  Warning: Accounts still exist after deletion')
        }
      } else {
        console.log('❌ Failed to verify deletion')
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${result.error}`)
      }

    } catch (err) {
      console.log('❌ Network error:', err)
    }
  }
}

// Run test if file is executed directly
if (import.meta.main) {
  console.log('💡 Make sure your server is running: bun run dev')
  console.log('💡 This test requires server to be accessible on http://localhost:3000')
  console.log('')
  
  const test = new AccountManagementTest()
  test.runTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test failed:', err)
      process.exit(1)
    })
}