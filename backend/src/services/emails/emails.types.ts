export interface SaveEmailsResult {
    success: boolean
    saved: number
    skipped: number
    errors: string[]
    savedEmails?: any[]
  }
  