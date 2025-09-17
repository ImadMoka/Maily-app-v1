import { Model, Relation } from '@nozbe/watermelondb'
import { field, date, readonly, relation, children } from '@nozbe/watermelondb/decorators'
import { Contact } from './Contact'
import { Email } from './Email'

export class Thread extends Model {
  static table = 'threads'

  // Relationships
  @field('contact_id') contactId!: string
  @relation('contacts', 'contact_id') contact!: Relation<Contact>
  @children('emails') emails!: Email[]

  // Thread identification
  @field('gmail_thread_id') gmailThreadId?: number

  // Display fields
  @field('subject') subject?: string
  @field('last_email_preview') lastEmailPreview?: string
  @field('last_email_from') lastEmailFrom?: string

  // Thread metrics
  @field('email_count') emailCount!: number
  @field('unread_count') unreadCount!: number

  // Dates
  @date('first_email_date') firstEmailDate!: Date
  @date('last_email_date') lastEmailDate!: Date

  // Read status
  @field('is_read') isRead!: boolean

  // Timestamps
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date

  // Helper methods
  get hasUnread(): boolean {
    return this.unreadCount > 0
  }

  get formattedEmailCount(): string {
    return this.emailCount === 1 ? '1 email' : `${this.emailCount} emails`
  }
}