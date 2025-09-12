import { database } from '../database'
import { Contact } from '../database/models/Contact'

/**
 * 📖 CONTACT READING SERVICE
 * Simple utilities for managing contact read status
 */

// Mark a contact as read - triggers UI updates via WatermelonDB observables
export const markContactAsRead = async (contact: Contact) => {
  await database.write(async () => {
    await contact.update(() => {
      contact.isRead = true
    })
  })
}