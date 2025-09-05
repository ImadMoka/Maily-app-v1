import 'dotenv/config'

export interface TestEnvironmentConfig {
  supabase: {
    url: string
    anonKey: string
  }
  test: {
    mode: boolean
    cleanup: boolean
    verbose: boolean
    timeout: number
    emailDomain: string
    passwordMinLength: number
  }
  performance: {
    monitoringEnabled: boolean
    slowQueryThreshold: number
  }
  imap?: {
    host: string
    port: number
    user: string
    pass: string
  }
}

function loadTestConfig(): TestEnvironmentConfig {
  // Load test environment if available
  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
    try {
      require('dotenv').config({ path: '.env.test' })
    } catch {
      console.warn('No .env.test file found, using regular environment')
    }
  }

  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  return {
    supabase: {
      url: process.env.SUPABASE_URL!,
      anonKey: process.env.SUPABASE_ANON_KEY!
    },
    test: {
      mode: process.env.TEST_MODE === 'true',
      cleanup: process.env.TEST_CLEANUP !== 'false',
      verbose: process.env.TEST_VERBOSE !== 'false',
      timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
      emailDomain: process.env.TEST_EMAIL_DOMAIN || 'example.com',
      passwordMinLength: parseInt(process.env.TEST_PASSWORD_MIN_LENGTH || '8')
    },
    performance: {
      monitoringEnabled: process.env.PERF_MONITORING_ENABLED === 'true',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000')
    },
    imap: process.env.TEST_IMAP_HOST ? {
      host: process.env.TEST_IMAP_HOST,
      port: parseInt(process.env.TEST_IMAP_PORT || '993'),
      user: process.env.TEST_IMAP_USER || '',
      pass: process.env.TEST_IMAP_PASS || ''
    } : undefined
  }
}

export const testConfig = loadTestConfig()

// Helper to check if we're in test mode
export const isTestMode = () => testConfig.test.mode

// Helper to get test-specific Supabase client configuration
export const getTestSupabaseConfig = () => ({
  url: testConfig.supabase.url,
  anonKey: testConfig.supabase.anonKey,
  options: {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
})

// Helper to log only in verbose mode
export const testLog = (...args: any[]) => {
  if (testConfig.test.verbose) {
    console.log(...args)
  }
}

export default testConfig