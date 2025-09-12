-- =================================================================
-- CONTACTS TABLE - Core Contact Management System
-- =================================================================

-- This table stores contact information for users
-- Designed for MVP with essential contact fields: name and email
-- Multi-tenant architecture with row-level security
-- Built for email application contact management and integration
CREATE TABLE contacts (
    
    -- =============================================================
    -- IDENTITY AND OWNERSHIP FIELDS
    -- =============================================================
    
    -- Primary identifier using UUID v4 (cryptographically secure random)
    -- UUIDs prevent enumeration attacks and are globally unique across systems
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Links to Supabase's auth.users table with CASCADE delete
    -- When a user deletes their account, all their contacts are automatically removed
    -- This prevents orphaned data and maintains referential integrity
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- =============================================================
    -- CORE CONTACT INFORMATION
    -- =============================================================
    
    -- Contact's full name or display name
    -- Required field for contact identification
    name TEXT NOT NULL,
    
    -- Contact's email address
    -- Required field for email integration and communication
    email TEXT NOT NULL,
    
    -- =============================================================
    -- EMAIL RELATIONSHIP TRACKING
    -- =============================================================
    
    -- Reference to the most recent email from/to this contact
    -- Links to emails table for quick access to latest communication
    last_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    
    -- Preview text from the most recent email
    -- First ~150 characters for contact list previews
    last_email_preview TEXT,
    
    -- Timestamp of the most recent email communication
    -- Used for sorting contacts by recent activity
    last_email_at TIMESTAMPTZ,
    
    -- Whether this contact has unread emails
    -- Will be populated by logic to be implemented later
    is_read BOOLEAN DEFAULT true,
    
    -- =============================================================
    -- AUDIT TRAIL TIMESTAMPS
    -- =============================================================
    
    -- When this contact was first created
    -- Immutable - never changes after initial INSERT
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- When this contact was last modified
    -- Automatically updated by trigger on any UPDATE operation
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================
    -- DATA INTEGRITY CONSTRAINTS
    -- =============================================================
    
    -- Prevents a user from adding the same email address twice
    -- Composite unique constraint on (user_id, email) allows:
    -- - Same email across different users (multi-tenant)
    -- - Different contacts for same user (multiple contacts)
    -- - Prevents duplicate contacts per user (data integrity)
    CONSTRAINT unique_user_contact_email UNIQUE(user_id, email)
);

-- =================================================================
-- PERFORMANCE INDEXES - Query Optimization Strategy
-- =================================================================

-- Primary user lookup index
-- Optimizes: "SELECT * FROM contacts WHERE user_id = ?"
-- Used when displaying all contacts for a specific user
-- This is the most common query pattern in the application
CREATE INDEX idx_contacts_user_id ON contacts(user_id);

-- Email lookup index for contact searching and email integration
-- Optimizes: "SELECT * FROM contacts WHERE user_id = ? AND email = ?"
-- Used when searching for specific contacts by email address
CREATE INDEX idx_contacts_user_email ON contacts(user_id, email);

-- Name search index for contact lookup
-- Optimizes: "SELECT * FROM contacts WHERE user_id = ? AND name ILIKE ?"
-- Used when users search contacts by name
CREATE INDEX idx_contacts_user_name ON contacts(user_id, name);

-- Last email activity index for recent contacts sorting
-- Optimizes: "SELECT * FROM contacts WHERE user_id = ? ORDER BY last_email_at DESC"
-- Used when displaying contacts sorted by recent activity
CREATE INDEX idx_contacts_user_last_email_at ON contacts(user_id, last_email_at DESC);

-- Unread contacts index for filtering
-- Optimizes: "SELECT * FROM contacts WHERE user_id = ? AND is_read = false"
-- Used when showing only contacts with unread emails
CREATE INDEX idx_contacts_user_unread ON contacts(user_id, is_read);

-- =================================================================
-- AUTOMATIC TIMESTAMP MANAGEMENT - Audit Trail Automation
-- =================================================================

-- The update_updated_at_column() function is already defined in email_accounts.sql
-- Attach the timestamp update trigger to the contacts table
-- BEFORE UPDATE ensures updated_at is set before the row is actually modified
-- FOR EACH ROW means this runs once per affected row (not once per statement)
-- This provides accurate audit trails for compliance and debugging
CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW LEVEL SECURITY - Multi-Tenant Data Protection
-- =================================================================

-- Enable Row Level Security (RLS) on the contacts table
-- RLS enforces access control at the database row level, not just table level
-- Without RLS, any authenticated user could potentially see all contacts
-- With RLS, users can ONLY access rows that match the security policies
-- This is CRITICAL for multi-tenant applications handling sensitive data
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- RLS POLICY - Multi-Tenant Access Control
-- =================================================================

-- COMBINED POLICY: Users can completely manage their own contacts
-- FOR ALL covers SELECT, INSERT, UPDATE, and DELETE operations
-- USING clause: Controls read access (SELECT) and ownership verification (UPDATE/DELETE)
-- WITH CHECK clause: Validates data being written (INSERT/UPDATE) meets security criteria
-- This single policy replaces four separate policies with identical logic
-- Simpler to maintain while providing the same comprehensive protection
CREATE POLICY "Users can manage own contacts" 
    ON contacts 
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- SYNC INFRASTRUCTURE - Offline-First Synchronization Support
-- =================================================================

-- =================================================================
-- UTILITY FUNCTIONS - Timestamp Conversion for WatermelonDB/JavaScript
-- =================================================================

-- Convert PostgreSQL timestamp to JavaScript milliseconds (epoch)
-- JavaScript uses milliseconds since Unix epoch, PostgreSQL uses seconds
-- This function ensures consistent timestamp handling across sync operations
CREATE OR REPLACE FUNCTION timestamp_to_epoch(ts TIMESTAMP WITH TIME ZONE)
RETURNS BIGINT AS $$
BEGIN
  -- Extract epoch in seconds, multiply by 1000 to get milliseconds
  -- COALESCE handles NULL timestamps gracefully by returning 0
  RETURN COALESCE(EXTRACT(epoch FROM ts)::BIGINT * 1000, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Convert JavaScript milliseconds back to PostgreSQL timestamp
-- Used when receiving sync data from WatermelonDB clients
-- Handles the reverse conversion for proper database storage
CREATE OR REPLACE FUNCTION epoch_to_timestamp(epoch_ms BIGINT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  -- Divide by 1000 to convert milliseconds to seconds
  -- to_timestamp() creates proper PostgreSQL timestamp with timezone
  RETURN to_timestamp(epoch_ms / 1000.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =================================================================
-- HELPER FUNCTIONS - Clean Code Organization for Sync Operations
-- =================================================================

-- ➕ CREATE CONTACT HELPER: Handles individual contact creation with conflict resolution
-- Uses UPSERT pattern to handle race conditions between multiple devices elegantly
-- This prevents errors when the same contact is created on different devices simultaneously
CREATE OR REPLACE FUNCTION create_contact(
  contact_id UUID,
  contact_user_id UUID,
  contact_name TEXT,
  contact_email TEXT,
  contact_last_email_id UUID,
  contact_last_email_preview TEXT,
  contact_last_email_at TIMESTAMP WITH TIME ZONE,
  contact_is_read BOOLEAN,
  contact_created_at TIMESTAMP WITH TIME ZONE,
  contact_updated_at TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
BEGIN
  -- 💾 UPSERT PATTERN: Insert new or update if exists
  -- ON CONFLICT handles race conditions gracefully
  -- Updates all fields to ensure consistency across devices
  INSERT INTO contacts (id, user_id, name, email, last_email_id, last_email_preview, last_email_at, is_read, created_at, updated_at)
  VALUES (contact_id, contact_user_id, contact_name, contact_email, contact_last_email_id, contact_last_email_preview, contact_last_email_at, contact_is_read, contact_created_at, contact_updated_at)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    last_email_id = EXCLUDED.last_email_id,
    last_email_preview = EXCLUDED.last_email_preview,
    last_email_at = EXCLUDED.last_email_at,
    is_read = EXCLUDED.is_read,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PULL FUNCTION - Download Engine for Incremental Sync
-- =================================================================

-- 📥 PULL FUNCTION: Implements incremental sync for contacts
-- Key concept: Only sends changes since last sync for optimal performance
-- Returns WatermelonDB-compatible JSON structure for offline-first apps
CREATE OR REPLACE FUNCTION pull(
  requesting_user_id UUID,
  last_pulled_ms BIGINT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_time TIMESTAMP WITH TIME ZONE;  -- Sync boundary timestamp
  result JSONB;                          -- Final response structure
BEGIN
  -- 🕒 TIMESTAMP CONVERSION: JavaScript milliseconds → PostgreSQL timestamp
  cutoff_time := to_timestamp(last_pulled_ms / 1000.0);
  
  -- 🏗️ BUILD WATERMELONDB SYNC RESPONSE
  -- Structure: { "changes": { "contacts": { "created": [...], "updated": [...], "deleted": [...] } }, "timestamp": 123456 }
  SELECT jsonb_build_object(
    'changes', jsonb_build_object(
      'contacts', jsonb_build_object(
        -- ➕ CREATED RECORDS: Contacts created since last sync
        'created', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', id,
              'user_id', user_id,
              'name', name,
              'email', email,
              'last_email_id', last_email_id,
              'last_email_preview', last_email_preview,
              'last_email_at', timestamp_to_epoch(last_email_at),
              'is_read', is_read,
              'created_at', timestamp_to_epoch(created_at),
              'updated_at', timestamp_to_epoch(updated_at)
            )
          )
          FROM contacts 
          WHERE user_id = requesting_user_id      -- 🔒 RLS: Only user's contacts
            AND created_at > cutoff_time),        -- 🔍 Only new contacts
          '[]'::jsonb
        ),
        
        -- 📝 UPDATED RECORDS: Existing contacts that were modified
        'updated', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', id,
              'user_id', user_id,
              'name', name,
              'email', email,
              'last_email_id', last_email_id,
              'last_email_preview', last_email_preview,
              'last_email_at', timestamp_to_epoch(last_email_at),
              'is_read', is_read,
              'created_at', timestamp_to_epoch(created_at),
              'updated_at', timestamp_to_epoch(updated_at)
            )
          )
          FROM contacts 
          WHERE user_id = requesting_user_id      -- 🔒 RLS: Only user's contacts
            AND updated_at > cutoff_time          -- 📅 Modified since last sync
            AND created_at <= cutoff_time),       -- 🎯 But existed before last sync
          '[]'::jsonb
        ),
        
        -- 🗑️ DELETED RECORDS: Placeholder for future soft delete implementation
        -- In MVP, we use hard deletes, but this structure supports future soft deletes
        'deleted', '[]'::jsonb
      )
    ),
    -- ⏰ TIMESTAMP: Current server time for next sync boundary
    'timestamp', timestamp_to_epoch(NOW())
  ) INTO result;
  
  RETURN result;
END;
$$;

-- =================================================================
-- PUSH FUNCTION - Upload Engine for Client Changes
-- =================================================================

-- 📤 PUSH FUNCTION: Receives local changes and applies them to PostgreSQL
-- Handles CREATE, UPDATE, and DELETE operations atomically
-- Ensures data consistency across multiple device synchronization
CREATE OR REPLACE FUNCTION push(
  requesting_user_id UUID,
  changes JSONB
) RETURNS VOID AS $$
DECLARE
  new_contact JSONB;      -- Individual contact being created
  updated_contact JSONB;  -- Individual contact being updated
BEGIN
  -- ➕ SECTION A: CREATE CONTACTS
  -- Process contacts created locally that need server persistence
  FOR new_contact IN 
    SELECT jsonb_array_elements(changes->'contacts'->'created')
  LOOP
    -- 💾 UPSERT with security validation
    -- Ensure user_id matches requesting user for security
    IF (new_contact->>'user_id')::UUID = requesting_user_id THEN
      PERFORM create_contact(
        (new_contact->>'id')::UUID,
        requesting_user_id,  -- Force user_id for security
        new_contact->>'name',
        new_contact->>'email',
        (new_contact->>'last_email_id')::UUID,
        new_contact->>'last_email_preview',
        epoch_to_timestamp((new_contact->>'last_email_at')::BIGINT),
        (new_contact->>'is_read')::BOOLEAN,
        epoch_to_timestamp((new_contact->>'created_at')::BIGINT),
        epoch_to_timestamp((new_contact->>'updated_at')::BIGINT)
      );
    END IF;
  END LOOP;

  -- 📝 SECTION B: UPDATE CONTACTS
  -- Process existing contacts modified locally
  FOR updated_contact IN 
    SELECT jsonb_array_elements(changes->'contacts'->'updated')
  LOOP
    -- 🔧 UPDATE with ownership verification
    UPDATE contacts SET
      name = updated_contact->>'name',
      email = updated_contact->>'email',
      last_email_id = (updated_contact->>'last_email_id')::UUID,
      last_email_preview = updated_contact->>'last_email_preview',
      last_email_at = epoch_to_timestamp((updated_contact->>'last_email_at')::BIGINT),
      is_read = (updated_contact->>'is_read')::BOOLEAN,
      updated_at = epoch_to_timestamp((updated_contact->>'updated_at')::BIGINT)
    WHERE id = (updated_contact->>'id')::UUID
      AND user_id = requesting_user_id;  -- 🔒 Security: Only update own contacts
  END LOOP;

  -- 🗑️ SECTION C: DELETE CONTACTS
  -- Process contacts deleted locally using efficient CTE pattern
  WITH deleted_contacts AS (
    SELECT jsonb_array_elements_text(changes->'contacts'->'deleted')::UUID AS deleted_id
  )
  DELETE FROM contacts 
  WHERE contacts.id IN (SELECT deleted_id FROM deleted_contacts)
    AND contacts.user_id = requesting_user_id;  -- 🔒 Security: Only delete own contacts
    
  -- Note: Using hard DELETE for MVP simplicity
  -- Future versions could implement soft deletes with tombstone records
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- ADDITIONAL SYNC PERFORMANCE INDEXES
-- =================================================================

-- Sync optimization index for pull operations
-- Optimizes queries that filter by user_id and timestamp ranges
-- Critical for efficient incremental sync performance
CREATE INDEX idx_contacts_sync_pull ON contacts(user_id, updated_at, created_at);

-- Batch operation index for push operations
-- Optimizes bulk updates and deletes during sync
CREATE INDEX idx_contacts_sync_push ON contacts(id, user_id);