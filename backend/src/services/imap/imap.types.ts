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
  address: string
}

export interface EmailMessage {
  uid: number
  messageId?: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  date: Date
  bodyPreview?: string
  hasAttachments: boolean
  isRead?: boolean
  size: number
  gmailThreadId?: string | null
}


export interface FetchEmailsResult {
  success: boolean
  emails?: EmailMessage[]
  error?: string
  totalCount?: number
}
