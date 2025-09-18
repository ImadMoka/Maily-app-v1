-- =================================================================
-- EMAIL_BODY TABLE - Email Content Storage
-- =================================================================

-- Stores email body content separately from envelope metadata
-- One-to-one relationship with emails table for performance optimization
CREATE TABLE email_body (

    -- =============================================================
    -- IDENTITY AND RELATIONSHIP FIELDS
    -- =============================================================

    -- Primary identifier using UUID v4
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- One-to-one relationship with emails table
    -- CASCADE delete ensures body is removed when email is deleted
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE UNIQUE NOT NULL,

    -- =============================================================
    -- EMAIL CONTENT
    -- =============================================================

    -- Plain text version of email body
    body_plain TEXT,

    -- HTML version of email body
    body_html TEXT,

    -- =============================================================
    -- SYNC AND AUDIT TRACKING
    -- =============================================================

    -- When this body record was created
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- When this record was last modified
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- =============================================================
    -- DATA INTEGRITY CONSTRAINTS
    -- =============================================================

    -- Ensure at least one body type is present
    CONSTRAINT has_content CHECK (
        body_plain IS NOT NULL OR
        body_html IS NOT NULL
    )
);

-- =================================================================
-- ESSENTIAL INDEXES
-- =================================================================

-- Primary lookup by email ID
CREATE INDEX idx_email_body_email_id ON email_body(email_id);


-- =================================================================
-- AUTOMATIC TIMESTAMP MANAGEMENT
-- =================================================================

-- Update the 'updated_at' column automatically on any UPDATE
CREATE TRIGGER update_email_body_updated_at
    BEFORE UPDATE ON email_body
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY - Multi-Tenant Data Protection
-- =================================================================

-- Enable Row Level Security on the email_body table
ALTER TABLE email_body ENABLE ROW LEVEL SECURITY;

-- Users can only access email bodies for their own emails
CREATE POLICY "Users can access own email bodies"
    ON email_body
    FOR ALL
    USING (
        email_id IN (
            SELECT e.id
            FROM emails e
            JOIN email_accounts ea ON e.account_id = ea.id
            WHERE ea.user_id = auth.uid()
        )
    )
    WITH CHECK (
        email_id IN (
            SELECT e.id
            FROM emails e
            JOIN email_accounts ea ON e.account_id = ea.id
            WHERE ea.user_id = auth.uid()
        )
    );