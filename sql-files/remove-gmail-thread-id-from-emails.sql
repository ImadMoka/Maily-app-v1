-- =================================================================
-- REMOVE REDUNDANT gmail_thread_id FROM EMAILS TABLE
-- =================================================================

-- Since we now have thread_id that references threads table,
-- and threads table contains gmail_thread_id, we don't need
-- to store gmail_thread_id in emails table anymore

-- Drop the column from emails table
ALTER TABLE emails DROP COLUMN IF EXISTS gmail_thread_id;

-- Drop the index that was on gmail_thread_id
DROP INDEX IF EXISTS idx_emails_gmail_thread;