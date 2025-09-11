export interface SaveEmailsResult {
    success: boolean
    saved: number
    skipped: number
    errors: string[]
    emailIdMap?: Map<string, string> // messageId -> database UUID
  }
  