export interface InitialSyncResult {
    success: boolean
    emailsProcessed: number
    contactsProcessed: number
    errors: string[]
  }
  
  export interface ProcessedContact {
    email: string
    name: string
    lastEmailId?: string
    lastEmailPreview?: string
    lastEmailAt?: string
  }