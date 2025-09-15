export interface ContactProcessingResult {
  success: boolean
  saved: number
  errors: string[]
}

export interface ProcessedContact {
  email: string
  name: string
  lastEmailId?: string
  lastEmailPreview?: string
  lastEmailAt?: string
  isRead?: boolean
}

export interface ContactWithEmailData {
  email: string
  name: string
  lastEmailId: string | null
  lastEmailPreview: string | null
  lastEmailAt: string | null
}