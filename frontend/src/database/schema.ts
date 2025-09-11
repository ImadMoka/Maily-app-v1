import { appSchema, tableSchema } from '@nozbe/watermelondb'

// 🏗️ DATABASE SCHEMA: Defines the structure of our SQLite database
// This must match the structure of your remote PostgreSQL table
export const schema = appSchema({
  version: 2,  // Schema version - increment when making changes
  
  tables: [
    tableSchema({
      name: 'contacts',  // Must match Contact.table name
      columns: [
        // Column definitions - these create the actual SQLite table structure
        { name: 'user_id', type: 'string' },    // UUID string for user ownership
        { name: 'name', type: 'string' },       // VARCHAR in SQL
        { name: 'email', type: 'string' },      // VARCHAR in SQL
        
        // Email relationship tracking columns
        { name: 'last_email_id', type: 'string', isOptional: true },    // UUID of last email
        { name: 'last_email_preview', type: 'string', isOptional: true }, // Preview text
        { name: 'last_email_at', type: 'number', isOptional: true },     // Timestamp of last email
        { name: 'is_read', type: 'boolean' },                           // Has unread emails
        
        { name: 'created_at', type: 'number' }, // INTEGER (Unix timestamp)
        { name: 'updated_at', type: 'number' }, // INTEGER (Unix timestamp)
        
        // 💡 'id' column is automatically created by WatermelonDB as UUID format
        // 💡 Timestamps stored as numbers (Unix time) for efficiency
        // 💡 New email relationship fields track latest communication
      ],
    }),
  ],
})