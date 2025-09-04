-- =================================================================
-- EMAIL ACCOUNTS TABLE - Core Multi-Tenant Email Management
-- =================================================================

-- This table stores email account configurations for each user
-- Supports multiple email accounts per user with plain text credential storage
-- Designed for IMAP/SMTP protocols (not OAuth) for maximum provider compatibility
-- Simplified for development - passwords stored as plain text
CREATE TABLE email_accounts (
    
    -- =============================================================
    -- IDENTITY AND OWNERSHIP FIELDS
    -- =============================================================
    
    -- Primary identifier using UUID v4 (cryptographically secure random)
    -- UUIDs prevent enumeration attacks and are globally unique across systems
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Links to Supabase's auth.users table with CASCADE delete
    -- When a user deletes their account, all their email configs are automatically removed
    -- This prevents orphaned data and maintains referential integrity
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- The actual email address being managed (e.g., user@gmail.com)
    -- This is what appears in the email client interface
    email TEXT NOT NULL,
    
    -- Human-readable name for this account (e.g., "Work Gmail", "Personal Yahoo")
    -- Helps users distinguish between multiple accounts of the same provider
    display_name TEXT,
    
    -- Email provider type with enforced valid values
    -- CHECK constraint prevents invalid provider types from being stored
    -- Helps with provider-specific optimizations and troubleshooting
    provider_type TEXT CHECK (provider_type IN ('gmail', 'outlook', 'icloud', 'yahoo', 'other')),
    
    -- =============================================================
    -- IMAP CONFIGURATION - For Reading Emails
    -- =============================================================
    
    -- IMAP server hostname (e.g., imap.gmail.com, outlook.office365.com)
    -- Required for establishing connection to read emails
    imap_host TEXT NOT NULL,
    
    -- IMAP port number - defaults to 993 (standard secure IMAP port)
    -- 993 = IMAPS (IMAP over SSL/TLS), 143 = plain IMAP (insecure)
    imap_port INTEGER DEFAULT 993,
    
    -- Username for IMAP authentication (usually the email address)
    -- Sometimes differs from the email address in corporate environments
    imap_username TEXT NOT NULL,
    
    -- Email account password stored in plain text
    -- For development simplicity - consider encryption for production
    -- Used to authenticate with IMAP/SMTP servers
    password TEXT NOT NULL,
    
    -- Whether to use TLS/SSL encryption for IMAP connection
    -- Default true for security - should only be false for testing
    imap_use_tls BOOLEAN DEFAULT true,
    
    -- =============================================================
    -- SMTP CONFIGURATION - For Sending Emails (Future Feature)
    -- =============================================================
    
    -- SMTP server hostname for sending emails
    -- Often different from IMAP host (e.g., smtp.gmail.com vs imap.gmail.com)
    smtp_host TEXT,
    
    -- SMTP port - defaults to 587 (standard STARTTLS port)
    -- 587 = STARTTLS, 465 = SMTPS, 25 = plain (blocked by most ISPs)
    smtp_port INTEGER DEFAULT 587,
    
    -- SMTP username (often same as email, but can differ)
    smtp_username TEXT,
    
    -- Whether to use TLS for SMTP - default true for security
    smtp_use_tls BOOLEAN DEFAULT true,
    
    -- =============================================================
    -- ACCOUNT STATUS AND SYNC MANAGEMENT
    -- =============================================================
    
    -- Whether this email account is actively being synced
    -- Allows users to temporarily disable accounts without deletion
    -- Useful for troubleshooting or when credentials change
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamp of last successful email sync
    -- Used to determine which accounts need syncing and in what order
    -- Critical for background job scheduling and status reporting
    last_sync_at TIMESTAMPTZ,
    
    -- Current synchronization status (idle, syncing, error, etc.)
    -- Helps track which accounts are actively being processed
    -- Useful for UI status indicators and debugging
    sync_status TEXT CHECK (sync_status IN ('idle', 'syncing', 'error', 'success')),

    -- Stores error messages from failed sync attempts
    -- Essential for troubleshooting connection and authentication issues
    -- Helps users understand why their email sync might have failed
    sync_error TEXT,
    
    -- =============================================================
    -- AUDIT TRAIL TIMESTAMPS
    -- =============================================================
    
    -- When this email account configuration was first created
    -- Immutable - never changes after initial INSERT
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- When this configuration was last modified
    -- Automatically updated by trigger on any UPDATE operation
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- DATA INTEGRITY CONSTRAINTS
    -- =============================================================
    
    -- Prevents a user from adding the same email address twice
    -- Composite unique constraint on (user_id, email) allows:
    -- - Same email across different users (multi-tenant)
    -- - Different emails for same user (multiple accounts)
    -- - Prevents duplicate email configs per user (data integrity)
    CONSTRAINT unique_user_email UNIQUE(user_id, email)
);

-- =================================================================
-- PERFORMANCE INDEXES - Query Optimization Strategy
-- =================================================================

-- Primary user lookup index
-- Optimizes: "SELECT * FROM email_accounts WHERE user_id = ?"
-- Used when displaying all email accounts for a specific user
-- This is the most common query pattern in the application
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);

-- Composite index for active accounts per user
-- Optimizes: "SELECT * FROM email_accounts WHERE user_id = ? AND is_active = true"
-- Used when showing only enabled email accounts to users
-- Filters out disabled accounts efficiently
CREATE INDEX idx_email_accounts_user_active ON email_accounts(user_id, is_active);

-- Background sync job optimization index
-- Optimizes: "SELECT * FROM email_accounts WHERE is_active = true ORDER BY last_sync_at ASC"
-- Critical for background workers to identify accounts needing sync
-- Allows efficient queue processing of email synchronization jobs
CREATE INDEX idx_email_accounts_sync ON email_accounts(is_active, last_sync_at);

-- =================================================================
-- AUTOMATIC TIMESTAMP MANAGEMENT - Audit Trail Automation
-- =================================================================

-- Reusable trigger function for automatically updating 'updated_at' timestamps
-- This function runs BEFORE any UPDATE operation on tables that use it
-- PostgreSQL triggers execute in the database, not in application code
-- Ensures 100% reliability - timestamps update even if application code forgets
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the updated_at field to current timestamp whenever row is modified
    -- NEW represents the row after the UPDATE operation
    -- OLD represents the row before the UPDATE (not used here)
    NEW.updated_at = NOW();
    
    -- RETURN NEW tells PostgreSQL to proceed with the UPDATE using modified row
    -- RETURN OLD would cancel the update, RETURN NULL would delete the row
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach the timestamp update trigger to the email_accounts table
-- BEFORE UPDATE ensures updated_at is set before the row is actually modified
-- FOR EACH ROW means this runs once per affected row (not once per statement)
-- This provides accurate audit trails for compliance and debugging
CREATE TRIGGER update_email_accounts_updated_at 
    BEFORE UPDATE ON email_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY - Multi-Tenant Data Protection
-- =================================================================

-- Enable Row Level Security (RLS) on the email_accounts table
-- RLS enforces access control at the database row level, not just table level
-- Without RLS, any authenticated user could potentially see all email accounts
-- With RLS, users can ONLY access rows that match the security policies
-- This is CRITICAL for multi-tenant applications handling sensitive data
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- RLS POLICY - Simplified Multi-Tenant Access Control
-- =================================================================
-- This policy uses auth.uid() which returns the authenticated user's ID
-- Supabase automatically sets this context for each database connection
-- If auth.uid() is NULL (unauthenticated), no rows are accessible

-- COMBINED POLICY: Users can completely manage their own email accounts
-- FOR ALL covers SELECT, INSERT, UPDATE, and DELETE operations
-- USING clause: Controls read access (SELECT) and ownership verification (UPDATE/DELETE)
-- WITH CHECK clause: Validates data being written (INSERT/UPDATE) meets security criteria
-- This single policy replaces four separate policies with identical logic
-- Simpler to maintain while providing the same comprehensive protection
CREATE POLICY "Users can manage own email accounts" 
    ON email_accounts 
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

