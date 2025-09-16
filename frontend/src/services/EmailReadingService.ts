import { database } from '../database'
import { Email } from '../database/models/Email'
import { syncNow } from '../database/sync'

/**
 * 📧 EMAIL READING SERVICE
 * Simple utilities for managing individual email read status
 */

// Mark an email as read - triggers UI updates via WatermelonDB observables
export const markEmailAsRead = async (email: Email) => {
  await database.write(async () => {
    await email.update(() => {
      email.isRead = true
    })
  })
  
  // Sync changes to Supabase
  setTimeout(() => syncNow(), 100)
}
