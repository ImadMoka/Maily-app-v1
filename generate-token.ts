#!/usr/bin/env bun

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  'https://zmuyzdhbecwgpmtauksc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdXl6ZGhiZWN3Z3BtdGF1a3NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk4NTQyMSwiZXhwIjoyMDcyNTYxNDIxfQ.Kkq1Dz_3oQc4qKZgH0kAboRXCs6kPqHq5BTFIWoaCMo'
)

const TEST_EMAIL = `test.${Date.now()}@example.com`
const TEST_PASSWORD = 'testpassword123'

async function generateToken() {
  try {
    // Create user
    console.log('Creating user:', TEST_EMAIL)
    const { data: authData, error: signupError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true
    })
    
    if (signupError) throw signupError

    // Login to get token
    const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
    
    if (loginError) throw loginError
    const accessToken = loginData.session!.access_token
    
    console.log('Bearer', accessToken)
    
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

generateToken()