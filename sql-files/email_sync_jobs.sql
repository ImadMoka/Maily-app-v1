-- =================================================================
-- EMAIL SYNC JOBS TABLE - Background Job Tracking
-- =================================================================

-- This table tracks background email synchronization jobs
-- Supports chunked processing, progress tracking, and resumable operations
-- Critical for handling unlimited email fetching without timeout issues

CREATE TABLE email_sync_jobs (
    
    -- =============================================================
    -- IDENTITY AND OWNERSHIP FIELDS
    -- =============================================================
    
    -- Primary identifier using UUID v4 (cryptographically secure random)
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Links to email_accounts table with CASCADE delete
    -- When an email account is deleted, all its sync jobs are removed
    account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
    
    -- =============================================================
    -- JOB STATUS AND CONFIGURATION
    -- =============================================================
    
    -- Current job status
    status TEXT CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')) DEFAULT 'pending',
    
    -- Job type for different sync operations
    job_type TEXT CHECK (job_type IN ('full_sync', 'incremental_sync', 'folder_sync')) DEFAULT 'full_sync',
    
    -- Target folder to sync (null = all folders)
    target_folder TEXT DEFAULT '[Gmail]/All Mail',
    
    -- Chunk size for processing batches
    chunk_size INTEGER DEFAULT 1000,
    
    -- =============================================================
    -- PROGRESS TRACKING
    -- =============================================================
    
    -- Estimated total number of emails to process
    total_emails_estimated INTEGER DEFAULT 0,
    
    -- Number of emails successfully processed so far
    emails_processed INTEGER DEFAULT 0,
    
    -- Number of emails that failed processing
    emails_failed INTEGER DEFAULT 0,
    
    -- Number of emails skipped (duplicates)
    emails_skipped INTEGER DEFAULT 0,
    
    -- Current progress percentage (0-100)
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Current batch being processed (for chunking)
    current_batch_number INTEGER DEFAULT 0,
    
    -- Total number of batches to process
    total_batches_estimated INTEGER DEFAULT 0,
    
    -- =============================================================
    -- RESUMABLE OPERATIONS
    -- =============================================================
    
    -- Last successfully processed IMAP UID (for resuming)
    last_processed_uid INTEGER,
    
    -- Starting UID for this job (for range tracking)
    start_uid INTEGER,
    
    -- Ending UID for this job (for range tracking)
    end_uid INTEGER,
    
    -- Checkpoint data for resuming (JSON format)
    -- Stores state information needed to resume processing
    checkpoint_data JSONB DEFAULT '{}'::jsonb,
    
    -- =============================================================
    -- TIMING AND PERFORMANCE METRICS
    -- =============================================================
    
    -- When the job was started
    started_at TIMESTAMPTZ,
    
    -- When the job completed (successfully or failed)
    completed_at TIMESTAMPTZ,
    
    -- Estimated time remaining (in seconds)
    estimated_time_remaining INTEGER,
    
    -- Processing rate (emails per second)
    processing_rate DECIMAL(8,2),
    
    -- =============================================================
    -- ERROR HANDLING AND DEBUGGING
    -- =============================================================
    
    -- Error message if job failed
    error_message TEXT,
    
    -- Detailed error stack trace for debugging
    error_details JSONB DEFAULT '{}'::jsonb,
    
    -- Number of retry attempts made
    retry_count INTEGER DEFAULT 0,
    
    -- Maximum retry attempts allowed
    max_retries INTEGER DEFAULT 3,
    
    -- Next retry attempt time (for exponential backoff)
    next_retry_at TIMESTAMPTZ,
    
    -- =============================================================
    -- AUDIT TRAIL TIMESTAMPS
    -- =============================================================
    
    -- When this job record was created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- When this record was last modified
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- PERFORMANCE INDEXES
-- =================================================================

-- Primary account lookup index
CREATE INDEX idx_email_sync_jobs_account_id ON email_sync_jobs(account_id);

-- Job status monitoring index (for background workers)
CREATE INDEX idx_email_sync_jobs_status ON email_sync_jobs(status, created_at);

-- Active jobs index (running and pending jobs)
CREATE INDEX idx_email_sync_jobs_active ON email_sync_jobs(account_id, status) 
    WHERE status IN ('pending', 'running', 'paused');

-- Failed jobs index (for retry processing)
CREATE INDEX idx_email_sync_jobs_failed ON email_sync_jobs(status, next_retry_at) 
    WHERE status = 'failed';

-- Progress monitoring index
CREATE INDEX idx_email_sync_jobs_progress ON email_sync_jobs(account_id, progress_percentage, status);

-- =================================================================
-- AUTOMATIC TIMESTAMP MANAGEMENT
-- =================================================================

-- Attach the timestamp update trigger to the email_sync_jobs table
CREATE TRIGGER update_email_sync_jobs_updated_at 
    BEFORE UPDATE ON email_sync_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY - Multi-Tenant Data Protection
-- =================================================================

-- Enable Row Level Security on the email_sync_jobs table
ALTER TABLE email_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only access sync jobs for their own email accounts
CREATE POLICY "Users can access sync jobs for own accounts" 
    ON email_sync_jobs 
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
-- USEFUL FUNCTIONS FOR JOB MANAGEMENT
-- =================================================================

-- Function to calculate progress percentage
CREATE OR REPLACE FUNCTION calculate_sync_progress(
    emails_processed INTEGER,
    total_emails_estimated INTEGER
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF total_emails_estimated = 0 THEN
        RETURN 0.00;
    END IF;
    
    RETURN LEAST(100.00, (emails_processed::DECIMAL / total_emails_estimated::DECIMAL) * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_sync_job_progress(
    job_id UUID,
    new_emails_processed INTEGER,
    new_emails_failed INTEGER DEFAULT 0,
    new_emails_skipped INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    total_estimated INTEGER;
    current_processed INTEGER;
    new_progress DECIMAL(5,2);
BEGIN
    -- Get current state
    SELECT total_emails_estimated, emails_processed 
    INTO total_estimated, current_processed
    FROM email_sync_jobs 
    WHERE id = job_id;
    
    -- Calculate new totals
    current_processed := current_processed + new_emails_processed;
    new_progress := calculate_sync_progress(current_processed, total_estimated);
    
    -- Update the job
    UPDATE email_sync_jobs SET
        emails_processed = current_processed,
        emails_failed = emails_failed + new_emails_failed,
        emails_skipped = emails_skipped + new_emails_skipped,
        progress_percentage = new_progress,
        updated_at = NOW()
    WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

