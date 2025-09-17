-- =================================================================
-- THREADS TABLE - Email Thread Management (Application-Controlled)
-- =================================================================

-- Stores pre-computed thread data for instant display when clicking a contact
-- Threads are created and managed by the application layer, not triggers
CREATE TABLE threads (
    -- Primary key
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Thread belongs to a contact
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,

    -- Gmail thread identifier for grouping
    gmail_thread_id BIGINT,

    -- Display fields for thread list
    subject TEXT,
    last_email_preview TEXT,
    last_email_from TEXT, -- "John Doe" or "john@example.com"

    -- Thread metrics
    email_count INTEGER DEFAULT 1 NOT NULL,
    unread_count INTEGER DEFAULT 0 NOT NULL,

    -- Dates for sorting and display
    first_email_date TIMESTAMPTZ NOT NULL,
    last_email_date TIMESTAMPTZ NOT NULL,

    -- Regular boolean column now (not generated)
    is_read BOOLEAN DEFAULT true NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique thread per contact + gmail_thread_id combo
    CONSTRAINT unique_contact_thread UNIQUE(contact_id, gmail_thread_id)
);

-- =================================================================
-- RECREATE INDEXES
-- =================================================================

-- Main query: Get all threads for a contact sorted by date
CREATE INDEX idx_threads_contact_date ON threads(contact_id, last_email_date DESC);

-- Filter unread threads for a contact
CREATE INDEX idx_threads_contact_unread ON threads(contact_id) WHERE unread_count > 0;

-- Find thread by Gmail ID (for adding new emails to existing threads)
CREATE INDEX idx_threads_gmail_id ON threads(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- =================================================================
-- RECREATE FOREIGN KEY from emails table
-- =================================================================

-- Add thread_id column to emails table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='emails' AND column_name='thread_id'
    ) THEN
        ALTER TABLE emails ADD COLUMN thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;
        CREATE INDEX idx_emails_thread_id ON emails(thread_id, date_sent DESC);
    END IF;
END $$;

-- =================================================================
-- AUTO-UPDATE TIMESTAMP
-- =================================================================

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY
-- =================================================================

ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own threads"
    ON threads
    FOR ALL
    USING (
        contact_id IN (
            SELECT id FROM contacts WHERE user_id = auth.uid()
        )
    );