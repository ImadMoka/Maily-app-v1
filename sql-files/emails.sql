-- =================================================================
-- EMAILS TABLE - MVP Email Storage (Envelope Data Focus)
-- =================================================================

-- Simplified email storage focused on essential envelope information
-- Designed for MVP with core email functionality and basic user interaction
-- Each email belongs to an email_account which belongs to a user
CREATE TABLE emails (
    
    -- =============================================================
    -- IDENTITY AND OWNERSHIP FIELDS
    -- =============================================================
    
    -- Primary identifier using UUID v4 (cryptographically secure random)
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Links to email_accounts table with CASCADE delete
    -- When an email account is deleted, all its emails are automatically removed
    account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
    
    -- IMAP server's unique identifier for this email
    -- Used for IMAP operations and sync tracking
    imap_uid INTEGER NOT NULL,
    
    -- RFC 2822 Message-ID header (globally unique email identifier)
    -- Used for deduplication across email clients
    message_id TEXT NOT NULL,
    
    -- =============================================================
    -- ENVELOPE INFORMATION (CORE EMAIL METADATA)
    -- =============================================================
    
    -- Email subject line
    subject TEXT,
    
    -- Sender information (From header)
    from_address TEXT NOT NULL,
    from_name TEXT,
    
    -- Primary recipients stored as simple JSON array of email addresses
    -- Format: ["user1@domain.com", "user2@domain.com"]
    -- Simplified for MVP - just email addresses, no names
    to_addresses JSONB DEFAULT '[]'::jsonb,
    
    -- Carbon copy recipients
    cc_addresses JSONB DEFAULT '[]'::jsonb,
    
    -- When the email was originally sent (from Date header)
    date_sent TIMESTAMPTZ NOT NULL,
    
    -- When we first synced this email from the IMAP server
    date_received TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- BASIC EMAIL CONTENT
    -- =============================================================
    
    -- Plain text preview/snippet (first 150 chars of body)
    -- Enough for email list previews without storing full content
    preview_text TEXT,
    
    -- Email size in bytes (from IMAP server)
    size_bytes INTEGER DEFAULT 0,
    
    -- Whether this email has file attachments
    has_attachments BOOLEAN DEFAULT false,
    
    -- =============================================================
    -- USER INTERACTION STATUS
    -- =============================================================
    
    -- Whether user has read this email
    is_read BOOLEAN DEFAULT false,
    
    -- Whether user has starred/flagged this email
    is_starred BOOLEAN DEFAULT false,
    
    -- Whether email is in trash/deleted state
    is_deleted BOOLEAN DEFAULT false,
    
    -- =============================================================
    -- FOLDER MANAGEMENT
    -- =============================================================
    
    -- IMAP folder/mailbox where email is stored
    -- Examples: "[Gmail]/Alle Nachrichten", "[Gmail]/Gesendet", "[Gmail]/Entwürfe"
    folder TEXT DEFAULT NULL,
    
    -- =============================================================
    -- GMAIL SPECIFIC FIELDS
    -- =============================================================
    
    -- Gmail conversation thread ID (X-GM-THRID)
    -- 64-bit integer that groups emails into conversations
    gmail_thread_id BIGINT,
    
    -- =============================================================
    -- SYNC AND AUDIT TRACKING
    -- =============================================================
    
    -- Current sync status of this email
    sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'error')) DEFAULT 'synced',
    
    -- When this email record was created in our database
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- When this record was last modified
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- DATA INTEGRITY CONSTRAINTS
    -- =============================================================
    
    -- Ensures no duplicate emails per account using message_id
    CONSTRAINT unique_account_message UNIQUE(account_id, message_id),
    
    -- Alternative uniqueness constraint using IMAP UID
    CONSTRAINT unique_account_uid UNIQUE(account_id, imap_uid)
);

-- =================================================================
-- ESSENTIAL INDEXES - MVP Query Optimization
-- =================================================================

-- Primary account lookup index
-- Most common query: showing emails for an account
CREATE INDEX idx_emails_account_id ON emails(account_id);

-- Chronological email listing (inbox view)
-- Critical for main email list views
CREATE INDEX idx_emails_account_date ON emails(account_id, date_sent DESC);

-- Unread emails index (for unread badges and filtering)
CREATE INDEX idx_emails_account_unread ON emails(account_id, is_read, date_sent DESC);

-- Folder filtering index (inbox, sent, trash views)
CREATE INDEX idx_emails_account_folder ON emails(account_id, folder, date_sent DESC);

-- Message ID lookup for deduplication during sync
CREATE INDEX idx_emails_message_id ON emails(message_id);

-- Basic search on subject and sender
CREATE INDEX idx_emails_search ON emails USING GIN (to_tsvector('english', subject || ' ' || COALESCE(from_name, '') || ' ' || from_address));

-- Gmail thread grouping index
CREATE INDEX idx_emails_gmail_thread ON emails(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- =================================================================
-- AUTOMATIC TIMESTAMP MANAGEMENT
-- =================================================================

-- Update the 'updated_at' column automatically on any UPDATE
CREATE TRIGGER update_emails_updated_at 
    BEFORE UPDATE ON emails 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY - Multi-Tenant Data Protection
-- =================================================================

-- Enable Row Level Security on the emails table
-- Users can only access emails from their own email accounts
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Users can only access emails from their own email accounts
-- This policy ensures email privacy across users
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
-- UPDATES EMAILS TABLE
-- =================================================================

-- Add thread_id column to emails table to link emails to threads
ALTER TABLE emails ADD COLUMN thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;

-- Index for fast lookup of emails in a thread
CREATE INDEX idx_emails_thread_id ON emails(thread_id, date_sent DESC);

-- Add email_type column to emails table
ALTER TABLE emails ADD COLUMN email_type TEXT;