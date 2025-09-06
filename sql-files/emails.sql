-- =================================================================
-- EMAILS TABLE - Core Email Message Storage
-- =================================================================

-- This table stores individual email messages synced from IMAP servers
-- Designed to handle millions of emails efficiently with proper indexing
-- Each email belongs to an email_account which belongs to a user
-- Supports full email content, threading, and status management
CREATE TABLE emails (
    
    -- =============================================================
    -- IDENTITY AND OWNERSHIP FIELDS
    -- =============================================================
    
    -- Primary identifier using UUID v4 (cryptographically secure random)
    -- UUIDs prevent enumeration attacks and are globally unique across systems
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Links to email_accounts table with CASCADE delete
    -- When an email account is deleted, all its emails are automatically removed
    -- This maintains referential integrity and prevents orphaned email data
    account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
    
    -- IMAP server's unique identifier for this email
    -- Used for IMAP operations (fetching, marking read, etc.)
    -- Not globally unique - only unique within an account
    imap_uid INTEGER NOT NULL,
    
    -- RFC 2822 Message-ID header (globally unique email identifier)
    -- Used for deduplication and threading across email clients
    -- Format: <unique-string@domain.com>
    message_id TEXT NOT NULL,
    
    -- =============================================================
    -- EMAIL HEADER INFORMATION
    -- =============================================================
    
    -- Email subject line (up to 2000 characters)
    -- Some email systems allow very long subjects
    subject TEXT,
    
    -- Sender information extracted from "From" header
    from_address TEXT NOT NULL,
    from_name TEXT,
    
    -- Reply-To header (if different from sender)
    reply_to_address TEXT,
    reply_to_name TEXT,
    
    -- Primary recipients (To field) stored as JSON array
    -- Format: [{"email": "user@domain.com", "name": "User Name"}, ...]
    -- JSON allows flexible handling of multiple recipients
    to_addresses JSONB DEFAULT '[]'::jsonb,
    
    -- Carbon copy recipients (CC field) stored as JSON array
    cc_addresses JSONB DEFAULT '[]'::jsonb,
    
    -- Blind carbon copy recipients (BCC field) - rarely available via IMAP
    bcc_addresses JSONB DEFAULT '[]'::jsonb,
    
    -- When the email was originally sent (from Date header)
    -- This is the sender's timestamp, not when we received it
    date_sent TIMESTAMPTZ NOT NULL,
    
    -- When we first synced this email from the IMAP server
    -- Used for incremental sync and troubleshooting
    date_received TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- EMAIL CONTENT AND STRUCTURE
    -- =============================================================
    
    -- Plain text version of email body
    -- Always present - either original or converted from HTML
    body_text TEXT,
    
    -- HTML version of email body (if available)
    -- Many modern emails include both text and HTML versions
    body_html TEXT,
    
    -- Email size in bytes (from IMAP server)
    -- Used for storage reporting and sync prioritization
    size_bytes INTEGER DEFAULT 0,
    
    -- Whether this email has file attachments
    -- Determined during IMAP sync by analyzing email structure
    has_attachments BOOLEAN DEFAULT false,
    
    -- Number of attachments (for quick reference)
    attachment_count INTEGER DEFAULT 0,
    
    -- Email priority/importance level
    -- Extracted from X-Priority, Importance, or X-MSMail-Priority headers
    priority TEXT CHECK (priority IN ('low', 'normal', 'high')),
    
    -- =============================================================
    -- EMAIL STATUS AND USER INTERACTION
    -- =============================================================
    
    -- Whether user has read this email
    -- Updated by IMAP sync or user actions
    is_read BOOLEAN DEFAULT false,
    
    -- Whether user has starred/flagged this email
    -- Used for importance marking and filtering
    is_starred BOOLEAN DEFAULT false,
    
    -- Whether email is in trash/deleted state
    -- Soft delete - allows recovery before permanent deletion
    is_deleted BOOLEAN DEFAULT false,
    
    -- Whether this email is spam/junk
    -- Can be set by server-side filters or user actions
    is_spam BOOLEAN DEFAULT false,
    
    -- =============================================================
    -- THREADING AND CONVERSATION GROUPING
    -- =============================================================
    
    -- Thread identifier for conversation grouping
    -- Emails with same thread_id belong to same conversation
    -- Generated from In-Reply-To and References headers
    thread_id TEXT,
    
    -- Position in the conversation thread (0 = original email)
    -- Used for proper conversation ordering
    thread_position INTEGER DEFAULT 0,
    
    -- Whether this email is the root of a conversation thread
    is_thread_root BOOLEAN DEFAULT false,
    
    -- =============================================================
    -- IMAP FOLDER AND LABEL MANAGEMENT
    -- =============================================================
    
    -- IMAP folder/mailbox where email is stored
    -- Examples: "INBOX", "Sent", "Drafts", "Custom Folder"
    folder TEXT DEFAULT 'INBOX',
    
    -- Gmail-style labels stored as JSON array
    -- Format: ["Important", "Work", "Project Alpha"]
    -- Allows multiple categorization per email
    labels JSONB DEFAULT '[]'::jsonb,
    
    -- =============================================================
    -- SYNC STATUS AND ERROR TRACKING
    -- =============================================================
    
    -- Current sync status of this email
    sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'error')) DEFAULT 'synced',
    
    -- Error message if sync failed
    -- Used for troubleshooting and retry logic
    sync_error TEXT,
    
    -- Last time this email's metadata was updated
    -- Used for incremental sync optimization
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- AUDIT TRAIL TIMESTAMPS
    -- =============================================================
    
    -- When this email record was first created in our database
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- When this record was last modified
    -- Automatically updated by trigger on any UPDATE operation
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- DATA INTEGRITY CONSTRAINTS
    -- =============================================================
    
    -- Ensures no duplicate emails per account
    -- Combination of account_id and message_id must be unique
    -- Prevents duplicate syncing of the same email
    CONSTRAINT unique_account_message UNIQUE(account_id, message_id),
    
    -- Alternative uniqueness constraint using IMAP UID
    -- Some email servers reuse message_id, but UID is always unique per account
    CONSTRAINT unique_account_uid UNIQUE(account_id, imap_uid)
);

-- =================================================================
-- PERFORMANCE INDEXES - Query Optimization Strategy
-- =================================================================

-- Primary account lookup index
-- Optimizes: "SELECT * FROM emails WHERE account_id = ?"
-- This is the most common query pattern - showing emails for an account
CREATE INDEX idx_emails_account_id ON emails(account_id);

-- Chronological listing index (most common email view)
-- Optimizes: "SELECT * FROM emails WHERE account_id = ? ORDER BY date_sent DESC"
-- Critical for inbox, sent, and folder views
CREATE INDEX idx_emails_account_date ON emails(account_id, date_sent DESC);

-- Unread emails index (for unread count and filtering)
-- Optimizes: "SELECT * FROM emails WHERE account_id = ? AND is_read = false"
-- Used for unread badges and notifications
CREATE INDEX idx_emails_account_unread ON emails(account_id, is_read, date_sent DESC);

-- Thread conversation index
-- Optimizes: "SELECT * FROM emails WHERE thread_id = ? ORDER BY thread_position"
-- Used for displaying email conversations
CREATE INDEX idx_emails_thread ON emails(thread_id, thread_position);

-- Folder/label filtering index
-- Optimizes: "SELECT * FROM emails WHERE account_id = ? AND folder = ?"
-- Used for folder-based email organization
CREATE INDEX idx_emails_account_folder ON emails(account_id, folder, date_sent DESC);

-- Full-text search index on subject and sender
-- Optimizes: "SELECT * FROM emails WHERE to_tsvector('english', subject || ' ' || from_name) @@ plainto_tsquery(?)"
-- Enables fast email search functionality
CREATE INDEX idx_emails_search ON emails USING GIN (to_tsvector('english', subject || ' ' || COALESCE(from_name, '') || ' ' || from_address));

-- Attachment filtering index
-- Optimizes: "SELECT * FROM emails WHERE account_id = ? AND has_attachments = true"
-- Used for finding emails with attachments
CREATE INDEX idx_emails_account_attachments ON emails(account_id, has_attachments, date_sent DESC);

-- Sync status monitoring index
-- Optimizes background sync jobs and error recovery
-- Used by workers to find emails needing sync or retry
CREATE INDEX idx_emails_sync_status ON emails(account_id, sync_status, last_sync_at);

-- Message ID lookup for deduplication
-- Optimizes: "SELECT * FROM emails WHERE message_id = ?"
-- Critical for preventing duplicate email imports
CREATE INDEX idx_emails_message_id ON emails(message_id);

-- =================================================================
-- AUTOMATIC TIMESTAMP MANAGEMENT
-- =================================================================

-- Reuse the timestamp update trigger function from email_accounts.sql
-- This function automatically updates the 'updated_at' column on any UPDATE

-- Attach the timestamp update trigger to the emails table
CREATE TRIGGER update_emails_updated_at 
    BEFORE UPDATE ON emails 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY - Multi-Tenant Data Protection
-- =================================================================

-- Enable Row Level Security on the emails table
-- Users can only access emails from their own email accounts
-- This is CRITICAL - emails contain highly sensitive personal data
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- RLS POLICY - Secure Email Access Control
-- =================================================================

-- Users can only access emails from their own email accounts
-- This policy joins to email_accounts to verify ownership
-- auth.uid() returns the authenticated user's ID from Supabase
-- The subquery ensures the email's account belongs to the current user
CREATE POLICY "Users can access emails from own accounts" 
    ON emails 
    FOR ALL 
    USING (
        account_id IN (
            SELECT id FROM email_accounts 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        account_id IN (
            SELECT id FROM email_accounts 
            WHERE user_id = auth.uid()
        )
    );

-- =================================================================
-- PERFORMANCE OPTIMIZATION - Table Partitioning (Optional)
-- =================================================================

-- For very large email volumes (millions+ emails), consider partitioning by date
-- This example shows monthly partitioning - uncomment and customize as needed
-- Partitioning can dramatically improve query performance for time-based queries

-- Example partition for January 2024:
-- CREATE TABLE emails_2024_01 PARTITION OF emails
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- =================================================================
-- EMAIL CONTENT SECURITY AND SANITIZATION
-- =================================================================

-- Consider adding a trigger for content sanitization
-- This would strip dangerous HTML, normalize encoding, etc.
-- Implement based on your security requirements

-- Example sanitization trigger (implement as needed):
-- CREATE OR REPLACE FUNCTION sanitize_email_content()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Strip dangerous HTML tags, normalize content
--     NEW.body_html = your_sanitization_function(NEW.body_html);
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER sanitize_email_trigger
--     BEFORE INSERT OR UPDATE ON emails
--     FOR EACH ROW
--     EXECUTE FUNCTION sanitize_email_content();

-- =================================================================
-- USEFUL VIEWS FOR APPLICATION DEVELOPMENT
-- =================================================================

-- View that joins emails with account information
-- Simplifies queries that need both email and account data
CREATE VIEW emails_with_accounts AS
SELECT 
    e.*,
    ea.email as account_email,
    ea.display_name as account_display_name,
    ea.provider_type
FROM emails e
JOIN email_accounts ea ON e.account_id = ea.id;

-- View for unread email counts per account
-- Optimized for dashboard and notification features
CREATE VIEW unread_email_counts AS
SELECT 
    account_id,
    COUNT(*) as unread_count
FROM emails 
WHERE is_read = false AND is_deleted = false
GROUP BY account_id;