import { appSchema, tableSchema } from '@nozbe/watermelondb'

// 🏗️ DATABASE SCHEMA: Defines the structure of our SQLite database
// This must match the structure of your remote PostgreSQL table
export const schema = appSchema({
  version: 1,  // Schema version - increment when making changes
  
  tables: [
    tableSchema({
      name: 'contacts',  // Must match Contact.table name
      columns: [
        // Column definitions - these create the actual SQLite table structure
        { name: 'user_id', type: 'string' },    // UUID string for user ownership
        { name: 'name', type: 'string' },       // VARCHAR in SQL
        { name: 'email', type: 'string' },      // VARCHAR in SQL
        { name: 'created_at', type: 'number' }, // INTEGER (Unix timestamp)
        { name: 'updated_at', type: 'number' }, // INTEGER (Unix timestamp)
        
        // 💡 'id' column is automatically created by WatermelonDB as UUID format
        // 💡 Timestamps stored as numbers (Unix time) for efficiency
      ],
    }),
  ],
})