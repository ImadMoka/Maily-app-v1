import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

// 📝 CONTACT MODEL: Defines the structure of our Contact items
// This model maps directly to both local SQLite and remote PostgreSQL tables
export class Contact extends Model {
  static table = 'contacts'  // Table name in database
  
  // 🏷️ FIELD DECORATORS: These map JavaScript properties to database columns
  @field('user_id') userId!: string     // User who owns this contact
  @field('name') name!: string          // Contact name - maps to 'name' column
  @field('email') email!: string        // Contact email - maps to 'email' column
  
  // 📧 EMAIL RELATIONSHIP FIELDS: Track latest email communication
  @field('last_email_id') lastEmailId?: string        // UUID of most recent email
  @field('last_email_preview') lastEmailPreview?: string  // Preview text from last email
  @date('last_email_at') lastEmailAt?: Date            // When last email was sent/received
  @field('is_read') isRead!: boolean                   // Whether contact has unread emails
  
  // 📅 TIMESTAMP FIELDS: Automatically managed by WatermelonDB
  @readonly @date('created_at') createdAt!: Date  // When contact was created (read-only)
  @readonly @date('updated_at') updatedAt!: Date  // When contact was last modified (read-only)
  
  // 💡 Why @readonly? These timestamps are automatically managed during create/update
  // 💡 Why @date? Converts between JavaScript Date objects and Unix timestamps in SQLite
}