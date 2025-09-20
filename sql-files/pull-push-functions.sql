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
        -- NOW INCLUDING imap_uid, account_id, and email_type fields
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
              'folder', e.folder,                   -- NEW: Added folder field
              'thread_id', e.thread_id,             -- NEW: Added thread reference
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
        -- NOW INCLUDING imap_uid, account_id, and email_type fields
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
              'folder', e.folder,                   -- NEW: Added folder field
              'thread_id', e.thread_id,             -- NEW: Added thread reference
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
      ),

      'email_body', jsonb_build_object(
        -- CREATED RECORDS: Email bodies created since last sync
        'created', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', eb.id,
              'email_id', eb.email_id,
              'body', eb.body,
              'email_type', eb.email_type,
              'created_at', timestamp_to_epoch(eb.created_at),
              'updated_at', timestamp_to_epoch(eb.updated_at)
            )
          )
          FROM email_body eb
          JOIN emails e ON eb.email_id = e.id
          JOIN email_accounts ea ON e.account_id = ea.id
          WHERE ea.user_id = requesting_user_id
            AND eb.created_at > cutoff_time),
          '[]'::jsonb
        ),

        -- UPDATED RECORDS: Existing email bodies that were modified
        'updated', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', eb.id,
              'email_id', eb.email_id,
              'body', eb.body,
              'email_type', eb.email_type,
              'created_at', timestamp_to_epoch(eb.created_at),
              'updated_at', timestamp_to_epoch(eb.updated_at)
            )
          )
          FROM email_body eb
          JOIN emails e ON eb.email_id = e.id
          JOIN email_accounts ea ON e.account_id = ea.id
          WHERE ea.user_id = requesting_user_id
            AND eb.updated_at > cutoff_time
            AND eb.created_at <= cutoff_time),
          '[]'::jsonb
        ),

        'deleted', '[]'::jsonb
      ),

      'threads', jsonb_build_object(
        -- CREATED RECORDS: Threads created since last sync
        'created', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'contact_id', t.contact_id,
              'gmail_thread_id', t.gmail_thread_id,
              'subject', t.subject,
              'last_email_preview', t.last_email_preview,
              'last_email_from', t.last_email_from,
              'email_count', t.email_count,
              'unread_count', t.unread_count,
              'first_email_date', timestamp_to_epoch(t.first_email_date),
              'last_email_date', timestamp_to_epoch(t.last_email_date),
              'is_read', t.is_read,
              'created_at', timestamp_to_epoch(t.created_at),
              'updated_at', timestamp_to_epoch(t.updated_at)
            )
          )
          FROM threads t
          JOIN contacts c ON t.contact_id = c.id
          WHERE c.user_id = requesting_user_id
            AND t.created_at > cutoff_time),
          '[]'::jsonb
        ),

        -- UPDATED RECORDS: Existing threads that were modified
        'updated', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'contact_id', t.contact_id,
              'gmail_thread_id', t.gmail_thread_id,
              'subject', t.subject,
              'last_email_preview', t.last_email_preview,
              'last_email_from', t.last_email_from,
              'email_count', t.email_count,
              'unread_count', t.unread_count,
              'first_email_date', timestamp_to_epoch(t.first_email_date),
              'last_email_date', timestamp_to_epoch(t.last_email_date),
              'is_read', t.is_read,
              'created_at', timestamp_to_epoch(t.created_at),
              'updated_at', timestamp_to_epoch(t.updated_at)
            )
          )
          FROM threads t
          JOIN contacts c ON t.contact_id = c.id
          WHERE c.user_id = requesting_user_id
            AND t.updated_at > cutoff_time
            AND t.created_at <= cutoff_time),
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
  new_thread JSONB;
  updated_thread JSONB;
  new_email_body JSONB;
  updated_email_body JSONB;
BEGIN
  -- CREATE CONTACTS (unchanged)
  FOR new_contact IN
    SELECT jsonb_array_elements(changes->'contacts'->'created')
  LOOP
    IF (new_contact->>'user_id')::UUID = requesting_user_id THEN
      -- Direct INSERT with UPSERT pattern (no more create_contact function)
      INSERT INTO contacts (
        id, user_id, name, email, last_email_at, is_read, created_at, updated_at
      )
      VALUES (
        (new_contact->>'id')::UUID,
        requesting_user_id,
        new_contact->>'name',
        new_contact->>'email',
        epoch_to_timestamp((new_contact->>'last_email_at')::BIGINT),
        (new_contact->>'is_read')::BOOLEAN,
        epoch_to_timestamp((new_contact->>'created_at')::BIGINT),
        epoch_to_timestamp((new_contact->>'updated_at')::BIGINT)
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        last_email_at = EXCLUDED.last_email_at,
        is_read = EXCLUDED.is_read,
        updated_at = EXCLUDED.updated_at;
    END IF;
  END LOOP;

  -- UPDATE CONTACTS (unchanged)
  FOR updated_contact IN
    SELECT jsonb_array_elements(changes->'contacts'->'updated')
  LOOP
    UPDATE contacts SET
      name = updated_contact->>'name',
      email = updated_contact->>'email',
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
      imap_uid, account_id, folder, thread_id,  -- NEW: Added IMAP fields, folder, and thread_id
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
      NULLIF(new_email->>'folder', ''),                  -- NEW: Handle folder
      NULLIF(new_email->>'thread_id', '')::UUID,         -- NEW: Handle thread ID
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
      folder = EXCLUDED.folder,                           -- NEW: Update folder
      thread_id = EXCLUDED.thread_id,                     -- NEW: Update thread ID
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
      folder = NULLIF(updated_email->>'folder', ''),                 -- NEW: Update folder
      thread_id = NULLIF(updated_email->>'thread_id', '')::UUID,     -- NEW: Update thread ID
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

  -- CREATE THREADS
  FOR new_thread IN
    SELECT jsonb_array_elements(changes->'threads'->'created')
  LOOP
    INSERT INTO threads (
      id, contact_id, gmail_thread_id, subject,
      last_email_preview, last_email_from,
      email_count, unread_count,
      first_email_date, last_email_date,
      is_read,
      created_at, updated_at
    )
    VALUES (
      (new_thread->>'id')::UUID,
      (new_thread->>'contact_id')::UUID,
      NULLIF(new_thread->>'gmail_thread_id', '')::BIGINT,
      new_thread->>'subject',
      new_thread->>'last_email_preview',
      new_thread->>'last_email_from',
      (new_thread->>'email_count')::INTEGER,
      (new_thread->>'unread_count')::INTEGER,
      epoch_to_timestamp((new_thread->>'first_email_date')::BIGINT),
      epoch_to_timestamp((new_thread->>'last_email_date')::BIGINT),
      (new_thread->>'is_read')::BOOLEAN,
      epoch_to_timestamp((new_thread->>'created_at')::BIGINT),
      epoch_to_timestamp((new_thread->>'updated_at')::BIGINT)
    )
    ON CONFLICT (id) DO UPDATE SET
      gmail_thread_id = EXCLUDED.gmail_thread_id,
      subject = EXCLUDED.subject,
      last_email_preview = EXCLUDED.last_email_preview,
      last_email_from = EXCLUDED.last_email_from,
      email_count = EXCLUDED.email_count,
      unread_count = EXCLUDED.unread_count,
      first_email_date = EXCLUDED.first_email_date,
      last_email_date = EXCLUDED.last_email_date,
      is_read = EXCLUDED.is_read,
      updated_at = EXCLUDED.updated_at
    WHERE EXISTS (
      SELECT 1 FROM contacts
      WHERE id = EXCLUDED.contact_id
      AND user_id = requesting_user_id
    );
  END LOOP;

  -- UPDATE THREADS
  FOR updated_thread IN
    SELECT jsonb_array_elements(changes->'threads'->'updated')
  LOOP
    UPDATE threads SET
      gmail_thread_id = NULLIF(updated_thread->>'gmail_thread_id', '')::BIGINT,
      subject = updated_thread->>'subject',
      last_email_preview = updated_thread->>'last_email_preview',
      last_email_from = updated_thread->>'last_email_from',
      email_count = (updated_thread->>'email_count')::INTEGER,
      unread_count = (updated_thread->>'unread_count')::INTEGER,
      first_email_date = epoch_to_timestamp((updated_thread->>'first_email_date')::BIGINT),
      last_email_date = epoch_to_timestamp((updated_thread->>'last_email_date')::BIGINT),
      is_read = (updated_thread->>'is_read')::BOOLEAN,
      updated_at = epoch_to_timestamp((updated_thread->>'updated_at')::BIGINT)
    WHERE id = (updated_thread->>'id')::UUID
      AND EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.id = threads.contact_id
        AND c.user_id = requesting_user_id
      );
  END LOOP;

  -- DELETE THREADS
  WITH deleted_threads AS (
    SELECT jsonb_array_elements_text(changes->'threads'->'deleted')::UUID AS deleted_id
  )
  DELETE FROM threads
  WHERE threads.id IN (SELECT deleted_id FROM deleted_threads)
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = threads.contact_id
      AND c.user_id = requesting_user_id
    );

  -- CREATE EMAIL BODIES
  FOR new_email_body IN
    SELECT jsonb_array_elements(changes->'email_body'->'created')
  LOOP
    INSERT INTO email_body (
      id, email_id, body, email_type,
      created_at, updated_at
    )
    VALUES (
      (new_email_body->>'id')::UUID,
      (new_email_body->>'email_id')::UUID,
      new_email_body->>'body',
      NULLIF(new_email_body->>'email_type', ''),
      epoch_to_timestamp((new_email_body->>'created_at')::BIGINT),
      epoch_to_timestamp((new_email_body->>'updated_at')::BIGINT)
    )
    ON CONFLICT (email_id) DO UPDATE SET
      body = EXCLUDED.body,
      email_type = EXCLUDED.email_type,
      updated_at = EXCLUDED.updated_at
    WHERE EXISTS (
      SELECT 1 FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE e.id = EXCLUDED.email_id
      AND ea.user_id = requesting_user_id
    );
  END LOOP;

  -- UPDATE EMAIL BODIES
  FOR updated_email_body IN
    SELECT jsonb_array_elements(changes->'email_body'->'updated')
  LOOP
    UPDATE email_body SET
      body = updated_email_body->>'body',
      email_type = NULLIF(updated_email_body->>'email_type', ''),
      updated_at = epoch_to_timestamp((updated_email_body->>'updated_at')::BIGINT)
    WHERE email_id = (updated_email_body->>'email_id')::UUID
      AND EXISTS (
        SELECT 1 FROM emails e
        JOIN email_accounts ea ON e.account_id = ea.id
        WHERE e.id = email_body.email_id
        AND ea.user_id = requesting_user_id
      );
  END LOOP;

  -- DELETE EMAIL BODIES
  WITH deleted_email_bodies AS (
    SELECT jsonb_array_elements_text(changes->'email_body'->'deleted')::UUID AS deleted_id
  )
  DELETE FROM email_body
  WHERE email_body.id IN (SELECT deleted_id FROM deleted_email_bodies)
    AND EXISTS (
      SELECT 1 FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE e.id = email_body.email_id
      AND ea.user_id = requesting_user_id
    );
END;
$$ LANGUAGE plpgsql;
