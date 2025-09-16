import { Model, Relation } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'
import { Contact } from './Contact'

export class Email extends Model {
  static table = 'emails'
  
  // Core fields only - everything else can be added later when needed
  @field('message_id') messageId!: string
  @field('contact_id') contactId?: string
  @relation('contacts', 'contact_id') contact?: Relation<Contact>
  
  @field('subject') subject?: string
  @field('from_address') fromAddress!: string
  @field('from_name') fromName?: string
  @date('date_sent') dateSent!: Date
  @field('is_read') isRead!: boolean
  @field('gmail_thread_id') gmailThreadId?: number
  
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}