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

export interface EmailAddress {
  name?: string
  email: string
}

export interface EmailMessage {
  id: string
  uid: number
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc: EmailAddress[]
  date: Date
  preview: string
  hasAttachments: boolean
  isRead: boolean
  size: number
  gmailThreadId?: string | null
}

export interface EmailBodyResult {
  success: boolean
  uid?: number
  subject?: string
  htmlBody?: string
  error?: string
}

export interface FetchEmailsResult {
  success: boolean
  emails?: EmailMessage[]
  error?: string
  totalCount?: number
}
