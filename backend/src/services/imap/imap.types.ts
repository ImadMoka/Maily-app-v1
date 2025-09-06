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

export class ImapError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'ImapError'
  }
}