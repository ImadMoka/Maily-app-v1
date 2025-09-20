import { Model, Query } from '@nozbe/watermelondb'
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators'
import { type Email } from './Email'

// 📝 CONTACT MODEL: Defines the structure of our Contact items
// This model maps directly to both local SQLite and remote PostgreSQL tables
export class Contact extends Model {
  static table = 'contacts'  // Table name in database
  
  // 🏷️ FIELD DECORATORS: These map JavaScript properties to database columns
  @field('user_id') userId!: string     // User who owns this contact
  @field('name') name!: string          // Contact name - maps to 'name' column
  @field('email') email!: string        // Contact email - maps to 'email' column
  
  // 📧 EMAIL RELATIONSHIP FIELDS: Track latest email communication
  @date('last_email_at') lastEmailAt?: Date            // When last email was sent/received
  @field('is_read') isRead!: boolean                   // Whether contact has unread emails
  
  // 📅 TIMESTAMP FIELDS: Automatically managed by WatermelonDB
  @readonly @date('created_at') createdAt!: Date  // When contact was created (read-only)
  @readonly @date('updated_at') updatedAt!: Date  // When contact was last modified (read-only)
  
  // 📧 RELATIONSHIPS: Link to related emails
  @children('emails') emails!: Query<Email>  // All emails from/to this contact
  
  // 💡 Why @readonly? These timestamps are automatically managed during create/update
  // 💡 Why @date? Converts between JavaScript Date objects and Unix timestamps in SQLite
  // 💡 Why @children? Creates hasMany relationship - contact can have many emails
}