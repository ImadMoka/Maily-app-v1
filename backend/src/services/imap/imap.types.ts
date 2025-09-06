export interface ImapConnectionConfig {
  host: string
  port: number
  username: string
  password: string
  tls: boolean
}

export interface ImapVerificationResult {
  success: boolean
  error?: string
  connectionTime?: number
}
