-- =================================================================
-- MIGRATION: Add imap_uid and account_id to sync functions
-- =================================================================
-- This migration updates the pull and push functions to include
-- imap_uid and account_id fields for proper IMAP synchronization

-- =================================================================
-- UPDATE PULL FUNCTION - Include IMAP fields in sync
-- =================================================================

CREATE OR REPLACE FUNCTION pull(
  requesting_user_id UUID,
  last_pulled_ms BIGINT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_time TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Convert JavaScript milliseconds to PostgreSQL timestamp
  cutoff_time := to_timestamp(last_pulled_ms / 1000.0);

  -- Build WatermelonDB sync response
  SELECT jsonb_build_object(
    'changes', jsonb_build_object(
      'contacts', jsonb_build_object(
        -- CREATED RECORDS: Contacts created since last sync
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
          WHERE user_id = requesting_user_id
            AND created_at > cutoff_time),
          '[]'::jsonb
        ),

        -- UPDATED RECORDS: Existing contacts that were modified
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
          WHERE user_id = requesting_user_id
            AND updated_at > cutoff_time
            AND created_at <= cutoff_time),
          '[]'::jsonb
        ),

        'deleted', '[]'::jsonb
      ),

      'emails', jsonb_build_object(
        -- CREATED RECORDS: Emails created since last sync
        -- NOW INCLUDING imap_uid and account_id fields
        'created', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'contact_id', e.contact_id,
              'message_id', e.message_id,
              'subject', e.subject,
              'from_address', e.from_address,
              'from_name', e.from_name,
              'date_sent', timestamp_to_epoch(e.date_sent),
              'is_read', e.is_read,
              'gmail_thread_id', e.gmail_thread_id,
              'imap_uid', e.imap_uid,              -- NEW: Added IMAP UID
              'account_id', e.account_id,          -- NEW: Added account ID
              'created_at', timestamp_to_epoch(e.created_at),
              'updated_at', timestamp_to_epoch(e.updated_at)
            )
          )
          FROM emails e
          JOIN email_accounts ea ON e.account_id = ea.id
          WHERE ea.user_id = requesting_user_id
            AND e.created_at > cutoff_time),
          '[]'::jsonb
        ),

        -- UPDATED RECORDS: Existing emails that were modified
        -- NOW INCLUDING imap_uid and account_id fields
        'updated', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'contact_id', e.contact_id,
              'message_id', e.message_id,
              'subject', e.subject,
              'from_address', e.from_address,
              'from_name', e.from_name,
              'date_sent', timestamp_to_epoch(e.date_sent),
              'is_read', e.is_read,
              'gmail_thread_id', e.gmail_thread_id,
              'imap_uid', e.imap_uid,              -- NEW: Added IMAP UID
              'account_id', e.account_id,          -- NEW: Added account ID
              'created_at', timestamp_to_epoch(e.created_at),
              'updated_at', timestamp_to_epoch(e.updated_at)
            )
          )
          FROM emails e
          JOIN email_accounts ea ON e.account_id = ea.id
          WHERE ea.user_id = requesting_user_id
            AND e.updated_at > cutoff_time
            AND e.created_at <= cutoff_time),
          '[]'::jsonb
        ),

        'deleted', '[]'::jsonb
      )
    ),
    'timestamp', timestamp_to_epoch(NOW())
  ) INTO result;

  RETURN result;
END;
$$;

-- =================================================================
-- UPDATE PUSH FUNCTION - Handle IMAP fields in uploads
-- =================================================================

CREATE OR REPLACE FUNCTION push(
  requesting_user_id UUID,
  changes JSONB
) RETURNS VOID AS $$
DECLARE
  new_contact JSONB;
  updated_contact JSONB;
  new_email JSONB;
  updated_email JSONB;
BEGIN
  -- CREATE CONTACTS (unchanged)
  FOR new_contact IN
    SELECT jsonb_array_elements(changes->'contacts'->'created')
  LOOP
    IF (new_contact->>'user_id')::UUID = requesting_user_id THEN
      PERFORM create_contact(
        (new_contact->>'id')::UUID,
        requesting_user_id,
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

  -- UPDATE CONTACTS (unchanged)
  FOR updated_contact IN
    SELECT jsonb_array_elements(changes->'contacts'->'updated')
  LOOP
    UPDATE contacts SET
      name = updated_contact->>'name',
      email = updated_contact->>'email',
      last_email_id = (updated_contact->>'last_email_id')::UUID,
      last_email_preview = updated_contact->>'last_email_preview',
      last_email_at = epoch_to_timestamp((updated_contact->>'last_email_at')::BIGINT),
      is_read = (updated_contact->>'is_read')::BOOLEAN,
      updated_at = epoch_to_timestamp((updated_contact->>'updated_at')::BIGINT)
    WHERE id = (updated_contact->>'id')::UUID
      AND user_id = requesting_user_id;
  END LOOP;

  -- DELETE CONTACTS (unchanged)
  WITH deleted_contacts AS (
    SELECT jsonb_array_elements_text(changes->'contacts'->'deleted')::UUID AS deleted_id
  )
  DELETE FROM contacts
  WHERE contacts.id IN (SELECT deleted_id FROM deleted_contacts)
    AND contacts.user_id = requesting_user_id;

  -- CREATE EMAILS - NOW INCLUDING imap_uid and account_id
  FOR new_email IN
    SELECT jsonb_array_elements(changes->'emails'->'created')
  LOOP
    -- Only allow creating emails for user's own accounts
    INSERT INTO emails (
      id, contact_id, message_id, subject, from_address, from_name,
      date_sent, is_read, gmail_thread_id,
      imap_uid, account_id,  -- NEW: Added IMAP fields
      created_at, updated_at
    )
    VALUES (
      (new_email->>'id')::UUID,
      NULLIF(new_email->>'contact_id', '')::UUID,
      new_email->>'message_id',
      new_email->>'subject',
      new_email->>'from_address',
      new_email->>'from_name',
      epoch_to_timestamp((new_email->>'date_sent')::BIGINT),
      (new_email->>'is_read')::BOOLEAN,
      NULLIF(new_email->>'gmail_thread_id', '')::BIGINT,
      NULLIF(new_email->>'imap_uid', '')::INTEGER,        -- NEW: Handle IMAP UID
      NULLIF(new_email->>'account_id', '')::UUID,        -- NEW: Handle account ID
      epoch_to_timestamp((new_email->>'created_at')::BIGINT),
      epoch_to_timestamp((new_email->>'updated_at')::BIGINT)
    )
    ON CONFLICT (id) DO UPDATE SET
      contact_id = EXCLUDED.contact_id,
      subject = EXCLUDED.subject,
      from_address = EXCLUDED.from_address,
      from_name = EXCLUDED.from_name,
      date_sent = EXCLUDED.date_sent,
      is_read = EXCLUDED.is_read,
      gmail_thread_id = EXCLUDED.gmail_thread_id,
      imap_uid = EXCLUDED.imap_uid,                       -- NEW: Update IMAP UID
      account_id = EXCLUDED.account_id,                   -- NEW: Update account ID
      updated_at = EXCLUDED.updated_at
    WHERE EXISTS (
      SELECT 1 FROM email_accounts
      WHERE id = EXCLUDED.account_id
      AND user_id = requesting_user_id
    );
  END LOOP;

  -- UPDATE EMAILS - NOW INCLUDING imap_uid and account_id
  FOR updated_email IN
    SELECT jsonb_array_elements(changes->'emails'->'updated')
  LOOP
    UPDATE emails SET
      contact_id = NULLIF(updated_email->>'contact_id', '')::UUID,
      subject = updated_email->>'subject',
      from_address = updated_email->>'from_address',
      from_name = updated_email->>'from_name',
      date_sent = epoch_to_timestamp((updated_email->>'date_sent')::BIGINT),
      is_read = (updated_email->>'is_read')::BOOLEAN,
      gmail_thread_id = NULLIF(updated_email->>'gmail_thread_id', '')::BIGINT,
      imap_uid = NULLIF(updated_email->>'imap_uid', '')::INTEGER,     -- NEW: Update IMAP UID
      account_id = NULLIF(updated_email->>'account_id', '')::UUID,   -- NEW: Update account ID
      updated_at = epoch_to_timestamp((updated_email->>'updated_at')::BIGINT)
    WHERE id = (updated_email->>'id')::UUID
      AND EXISTS (
        SELECT 1 FROM email_accounts ea
        WHERE ea.id = emails.account_id
        AND ea.user_id = requesting_user_id
      );
  END LOOP;

  -- DELETE EMAILS (with ownership check)
  WITH deleted_emails AS (
    SELECT jsonb_array_elements_text(changes->'emails'->'deleted')::UUID AS deleted_id
  )
  DELETE FROM emails
  WHERE emails.id IN (SELECT deleted_id FROM deleted_emails)
    AND EXISTS (
      SELECT 1 FROM email_accounts ea
      WHERE ea.id = emails.account_id
      AND ea.user_id = requesting_user_id
    );
END;
$$ LANGUAGE plpgsql;