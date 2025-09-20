export interface ContactProcessingResult {
  success: boolean
  saved: number
  errors: string[]
}

export interface ProcessedContact {
  email: string
  name: string
  lastEmailAt?: string
  isRead?: boolean
}

export interface ContactWithEmailData {
  email: string
  name: string
  lastEmailAt: string | null
}