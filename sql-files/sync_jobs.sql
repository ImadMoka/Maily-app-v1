-- Simple sync jobs table for email synchronization
-- No stored procedures, no triggers, no views - just a table with one index

CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Job configuration
    type TEXT NOT NULL CHECK (type IN ('initial_sync', 'incremental_sync', 'selective_sync')),
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payload JSONB DEFAULT '{}' NOT NULL,

    -- Progress tracking
    checkpoint JSONB DEFAULT '{}' NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL CHECK (attempts >= 0),
    error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Single index for finding jobs to process
CREATE INDEX IF NOT EXISTS idx_sync_jobs_queue
ON sync_jobs(scheduled_for)
WHERE status IN ('pending', 'processing');

-- Row Level Security
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "users_view_own" ON sync_jobs
FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "users_create_own" ON sync_jobs
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "service_full_access" ON sync_jobs
FOR ALL TO service_role USING (true);