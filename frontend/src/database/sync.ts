// This file handles SYNCHRONIZATION between your phone's local database and the remote server
// Think of it like keeping two address books in sync - changes on one appear on the other
// "Bidirectional" = changes can flow both ways (phone → server AND server → phone)

// Import WatermelonDB sync functions - these handle the complex sync logic
import { SyncDatabaseChangeSet, synchronize } from '@nozbe/watermelondb/sync' // Built-in sync engine
import { database } from './index' // Our local database connection
import { supabase } from '../lib/supabase' // Connection to remote Supabase database

// This variable prevents multiple sync operations from running at the same time
// Like a "Do Not Disturb" sign - only one sync can happen at a time to avoid conflicts
let isSyncing = false // false = not syncing, true = currently syncing

// Your server has these functions ready to use:
// - pull(requesting_user_id UUID, last_pulled_ms BIGINT) - gets new changes from server
// - push(requesting_user_id UUID, changes JSONB) - sends your changes to server

// The main function that synchronizes data between local device and remote server
// async = this function can wait for network operations to complete
// This runs every 10 seconds automatically, plus whenever remote data changes
async function sync() {
  // Check if sync is already running - if yes, skip this attempt
  if (isSyncing) {
    console.log('⚠️ Sync already in progress, skipping...') // Log message for debugging
    return // Exit function early
  }

  try { // try-catch block to handle any errors during sync
    isSyncing = true // Set flag to prevent other sync attempts
    console.log('Starting contacts sync...') // Log for debugging
    
    // synchronize() is WatermelonDB's built-in function that handles all the complex sync logic
    // It takes care of merging changes, handling conflicts, and updating the local database
    await synchronize({ // await = wait for sync to complete
      database, // Our local database to sync
      
      // PULL CHANGES: Get new data from the server
      // This function asks the server "what's new since last time I checked?"
      pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
        console.log('Calling server to get new changes. Last check was at:', lastPulledAt)
        
        // Get the current logged-in user
        const { data: { user } } = await supabase.auth.getUser() // Check who's logged in
        if (!user) throw new Error('User not authenticated') // Must be logged in to sync
        
        // Call the server's "pull" function to get new changes
        const { data, error } = await supabase.rpc('pull', {
          requesting_user_id: user.id, // Tell server which user is asking
          last_pulled_ms: lastPulledAt || 0 // When did we last check? (0 = never)
        })

        if (error) { // If something went wrong
          console.error('Error getting changes from server:', error)
          throw error // Stop sync and show error
        }

        // Server returns structured data with changes and timestamp
        const { changes, timestamp } = data as {
          changes: SyncDatabaseChangeSet // List of changes in WatermelonDB format
          timestamp: number // When these changes were made (for next sync)
        }

        console.log('Successfully got changes from server:', changes)
        return { changes, timestamp } // Return data to WatermelonDB
      },
      
      // PUSH CHANGES: Send our local changes to the server
      // This function tells the server "here are the changes I made locally"
      pushChanges: async ({ changes, lastPulledAt }) => {
        console.log('Sending our local changes to server:', changes)
        
        // Get the current logged-in user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')
        
        // Call the server's "push" function to save our changes
        const { error } = await supabase.rpc('push', {
          requesting_user_id: user.id, // Tell server which user is sending changes
          changes // All our local changes (created, updated, deleted contacts)
        })

        if (error) { // If something went wrong
          console.error('Error sending changes to server:', error)
          throw error // Stop sync and show error
        }

        console.log('Successfully sent changes to server')
      },
      
      // Configuration: How to handle edge cases
      sendCreatedAsUpdated: false, // Let server decide if something is new or updated
    })
    
    console.log('Contacts sync completed successfully')
    // The UI will automatically update because we're using "observe()" in ContactsList
  } catch (error) {
    console.error('Sync failed with error:', error)
    // App continues working offline even if sync fails!
  } finally {
    // Always release the sync lock, even if sync fails
    isSyncing = false // Allow future sync attempts
  }
}

// AUTO-SYNC ORCHESTRATION: Keeps contact data synchronized automatically
// This function sets up automatic syncing in the background
export function startAutoSync() {
  // Start sync after a small delay to avoid conflicts
  setTimeout(sync, 1000) // First sync 1 second after app starts
  
  // Set up recurring sync every 10 seconds
  // This ensures data stays in sync even if real-time updates fail
  const interval = setInterval(sync, 10000) // Sync every 10 seconds
  
  // TODO: Add real-time sync when ready
  // Real-time sync listens for changes on the server and syncs immediately
  // This is like getting a notification whenever someone else changes data
  /*
  const subscription = supabase
    .channel('contacts') // Create a subscription channel
    .on('postgres_changes', { 
      event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
      schema: 'public', // PostgreSQL schema name
      table: 'contacts' // Table name to monitor
    }, () => {
      console.log('Remote contact change detected, syncing...')
      sync() // Immediately sync when someone else makes changes
    })
    .subscribe() // Activate the subscription
  */
  
  // Return a cleanup function to stop syncing when app closes
  return () => {
    clearInterval(interval) // Stop periodic sync
    // subscription.unsubscribe() // Stop real-time subscription (when implemented)
  }
}

// MANUAL SYNC: For testing and user-triggered sync (like pull-to-refresh)
export function syncNow() {
  return sync() // Just call the main sync function
}

// HOW TO USE THIS FILE:
// 1. In your main App component, call: startAutoSync()
// 2. When app closes, call the returned cleanup function
// 3. For manual refresh buttons, use: syncNow()
// 4. All contact changes will sync automatically in the background!

// WHAT HAPPENS DURING SYNC:
// 1. Check if user is logged in
// 2. Ask server: "what changed since last time?" (PULL)
// 3. Get server's response with new/updated/deleted contacts
// 4. Apply those changes to local database
// 5. Send server our local changes (PUSH)
// 6. Server saves our changes
// 7. UI automatically updates because ContactsList is "observing" the data