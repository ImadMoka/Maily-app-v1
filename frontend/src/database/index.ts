import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'

import { schema } from './schema'
import { Contact } from './models/Contact'

// 🆔 UUID GENERATOR: Creates RFC4122 compliant UUIDs for database records
// This ensures compatibility with PostgreSQL UUID columns
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// 🚀 DATABASE INITIALIZATION: Creates the local SQLite database instance
const adapter = new SQLiteAdapter({ 
  schema,                    // The schema defined above
  dbName: 'MailyContactsDB'  // SQLite database file name on device
})

// 🎯 CONFIGURE UUID GENERATION: Set up WatermelonDB to use our UUID generator
// This must be done BEFORE creating the database instance
setGenerator(() => generateUUID())

// 🌍 GLOBAL DATABASE INSTANCE: This is what your app components will use
export const database = new Database({ 
  adapter,                // SQLite adapter with our schema
  modelClasses: [Contact] // Register our Contact model class
})

// ✅ UUID GENERATION: Now WatermelonDB automatically uses our UUID generator
// All new records will get proper UUID format IDs compatible with PostgreSQL

// 💡 HOW IT WORKS:
// 1. SQLiteAdapter creates a local SQLite database file
// 2. Schema defines table structure matching your remote database
// 3. Contact model provides JavaScript interface to database records
// 4. All operations work offline - no internet required!
// 5. Changes are automatically tracked for synchronization