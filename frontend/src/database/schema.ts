import { appSchema, tableSchema } from '@nozbe/watermelondb'

// 🏗️ DATABASE SCHEMA: Defines the structure of our SQLite database
// This must match the structure of your remote PostgreSQL table
export const schema = appSchema({
  version: 11,  // Schema version - increment when making changes

  tables: [
    tableSchema({
      name: 'contacts',  // Must match Contact.table name
      columns: [
        // Column definitions - these create the actual SQLite table structure
        { name: 'user_id', type: 'string' },    // UUID string for user ownership
        { name: 'name', type: 'string' },       // VARCHAR in SQL
        { name: 'email', type: 'string' },      // VARCHAR in SQL
        
        // Email relationship tracking columns
        { name: 'last_email_at', type: 'number', isOptional: true },     // Timestamp of last email
        { name: 'is_read', type: 'boolean' },                           // Has unread emails
        
        { name: 'created_at', type: 'number' }, // INTEGER (Unix timestamp)
        { name: 'updated_at', type: 'number' }, // INTEGER (Unix timestamp)
        
        // 💡 'id' column is automatically created by WatermelonDB as UUID format
        // 💡 Timestamps stored as numbers (Unix time) for efficiency
        // 💡 New email relationship fields track latest communication
      ],
    }),
    
    tableSchema({
      name: 'emails',
      columns: [
        { name: 'message_id', type: 'string' },
        { name: 'contact_id', type: 'string', isOptional: true },
        { name: 'subject', type: 'string', isOptional: true },
        { name: 'from_address', type: 'string' },
        { name: 'from_name', type: 'string', isOptional: true },
        { name: 'date_sent', type: 'number' },
        { name: 'is_read', type: 'boolean' },
        { name: 'gmail_thread_id', type: 'number', isOptional: true },
        { name: 'imap_uid', type: 'number', isOptional: true },  // Added for IMAP sync
        { name: 'account_id', type: 'string', isOptional: true }, // Added for IMAP sync
        { name: 'folder', type: 'string', isOptional: true },     // Track IMAP folder source
        { name: 'thread_id', type: 'string', isOptional: true },  // Reference to thread
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'threads',
      columns: [
        { name: 'contact_id', type: 'string' },                       // UUID reference to contact
        { name: 'gmail_thread_id', type: 'number', isOptional: true }, // Gmail thread identifier
        { name: 'subject', type: 'string', isOptional: true },        // Thread subject
        { name: 'last_email_preview', type: 'string', isOptional: true }, // Preview of latest email
        { name: 'last_email_from', type: 'string', isOptional: true }, // Sender of latest email
        { name: 'email_count', type: 'number' },                      // Total emails in thread
        { name: 'unread_count', type: 'number' },                     // Count of unread emails
        { name: 'first_email_date', type: 'number' },                 // First email timestamp
        { name: 'last_email_date', type: 'number' },                  // Latest email timestamp
        { name: 'is_read', type: 'boolean' },                         // Quick read status check
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'email_body',
      columns: [
        { name: 'email_id', type: 'string' },                    // Reference to email
        { name: 'body', type: 'string', isOptional: true },      // Unified body field (HTML or plain text)
        { name: 'email_type', type: 'string', isOptional: true }, // Email classification (marketing, personal, etc.)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'imap_sync_queue',
      columns: [
        { name: 'email_id', type: 'string' },                    // Reference to email
        { name: 'imap_uid', type: 'number' },                    // IMAP UID of the email
        { name: 'operation_type', type: 'string' },              // 'mark_read' or 'mark_unread'
        { name: 'folder_name', type: 'string' },                 // Folder like '[Gmail]/Alle Nachrichten'
        { name: 'account_id', type: 'string' },                  // Which email account
        { name: 'attempts', type: 'number' },                    // Retry counter (starts at 0)
        { name: 'last_error', type: 'string', isOptional: true }, // Last error message if failed
        { name: 'status', type: 'string' },                      // 'pending', 'processing', 'failed'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})