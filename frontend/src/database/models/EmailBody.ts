import { Model, Relation } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'
import { Email } from './Email'

export class EmailBody extends Model {
  static table = 'email_body'

  // Email relationship
  @field('email_id') emailId!: string
  @relation('emails', 'email_id') email!: Relation<Email>

  // Unified body field - can contain either HTML or plain text
  @field('body') body?: string

  // Email classification (marketing, personal, etc.)
  @field('email_type') emailType?: string

  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}