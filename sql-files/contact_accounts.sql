-- =================================================================
-- CONTACT_ACCOUNTS TABLE - Contact-Account Association Management
-- =================================================================

-- This junction table tracks which email accounts have interacted with which contacts
-- Enables proper cleanup of contacts when email accounts are disconnected
-- Prevents orphaned contacts and maintains data hygiene across multiple accounts

CREATE TABLE contact_accounts (
    -- Reference to the contact
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,

    -- Reference to the email account that knows this contact
    account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE NOT NULL,

    -- Composite primary key ensures one record per contact-account pair
    PRIMARY KEY (contact_id, account_id)
);

-- =============================================================
-- ORPHANED CONTACT CLEANUP
-- =============================================================

-- Function to delete contacts that no longer have any account associations
CREATE OR REPLACE FUNCTION cleanup_orphaned_contacts()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete contacts that have no remaining account associations
    DELETE FROM contacts
    WHERE id = OLD.contact_id
    AND NOT EXISTS (
        SELECT 1 FROM contact_accounts
        WHERE contact_id = OLD.contact_id
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger that fires after any deletion from contact_accounts
CREATE TRIGGER cleanup_contacts_after_account_delete
AFTER DELETE ON contact_accounts
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_contacts();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE contact_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see relationships for their own accounts
CREATE POLICY "Users can view their own contact-account relationships"
ON contact_accounts
FOR ALL
USING (
    account_id IN (
        SELECT id FROM email_accounts
        WHERE user_id = auth.uid()
    )
);

-- =============================================================
-- UPDATES
-- =============================================================

-- Update 2025-01-19: Fixed trigger to properly delete orphaned contacts
-- The trigger wasn't working because it was checking for existence AFTER the row was deleted
-- Need to use a different approach with explicit count or deferred checking

-- Drop old trigger and function
DROP TRIGGER IF EXISTS cleanup_contacts_after_account_delete ON contact_accounts;
DROP FUNCTION IF EXISTS cleanup_orphaned_contacts();

-- Create improved cleanup function with better logic
CREATE OR REPLACE FUNCTION cleanup_orphaned_contacts()
RETURNS TRIGGER AS $$
DECLARE
    remaining_count INTEGER;
BEGIN
    -- Count remaining associations for this contact
    -- This runs AFTER the DELETE, so if count is 0, the contact is orphaned
    SELECT COUNT(*) INTO remaining_count
    FROM contact_accounts
    WHERE contact_id = OLD.contact_id;

    -- If no associations remain, delete the contact
    IF remaining_count = 0 THEN
        DELETE FROM contacts WHERE id = OLD.contact_id;
        RAISE NOTICE 'Deleted orphaned contact %', OLD.contact_id;
    ELSE
        RAISE NOTICE 'Contact % still has % associations', OLD.contact_id, remaining_count;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with row-level execution
CREATE TRIGGER cleanup_contacts_after_account_delete
AFTER DELETE ON contact_accounts
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_contacts();

-- =============================================================
-- UPDATES 2
-- =============================================================

-- Update 2025-09-19: WORKING simplified trigger that properly handles orphan cleanup
-- The COUNT approach is actually REQUIRED because the trigger runs AFTER delete

-- Drop the broken version
DROP TRIGGER IF EXISTS cleanup_contacts_after_account_delete ON contact_accounts;
DROP FUNCTION IF EXISTS cleanup_orphaned_contacts();

-- Working cleanup function (simplified but correct)
CREATE OR REPLACE FUNCTION cleanup_orphaned_contacts()
RETURNS TRIGGER AS $$
DECLARE
    remaining INTEGER;
BEGIN
    -- Count how many associations remain AFTER this delete
    SELECT COUNT(*) INTO remaining
    FROM contact_accounts
    WHERE contact_id = OLD.contact_id;

    -- If zero associations remain, delete the orphaned contact
    IF remaining = 0 THEN
        DELETE FROM contacts WHERE id = OLD.contact_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER cleanup_contacts_after_account_delete
AFTER DELETE ON contact_accounts
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_contacts();