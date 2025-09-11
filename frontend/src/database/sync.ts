// = BIDIRECTIONAL SYNCHRONIZATION ENGINE - Contacts
// This bridges local SQLite and remote PostgreSQL using RPC functions
// Key concept: Changes flow both ways - local to remote AND remote to local

import { SyncDatabaseChangeSet, synchronize } from '@nozbe/watermelondb/sync'
import { database } from './index'
import { supabase } from '../lib/supabase'
// TODO: Import your supabase client when ready
// import { supabase } from '../lib/supabase'

// =🔒 SYNC GUARD: Prevents concurrent synchronization calls
// WatermelonDB throws "Concurrent synchronization is not allowed" if multiple sync calls overlap
let isSyncing = false

// 🎯 READY TO USE: Your PostgreSQL functions are already set up!
// - pull(requesting_user_id UUID, last_pulled_ms BIGINT) ✅
// - push(requesting_user_id UUID, changes JSONB) ✅
// Just uncomment the RPC calls below and import your supabase client

// <� MAIN SYNC FUNCTION: Coordinates bidirectional contact synchronization  
// This function is called every 10 seconds AND when remote changes are detected
async function sync() {
  // =🔒 GUARD: Prevent concurrent sync calls to avoid WatermelonDB errors
  if (isSyncing) {
    console.log('⚠️ Sync already in progress, skipping...')
    return
  }

  try {
    isSyncing = true
    console.log('= Starting contacts sync...')
    
    // =� WATERMELONDB'S SYNCHRONIZE: Built-in sync engine with RPC-based approach
    // This cleaner pattern moves sync logic to database-level stored procedures
    await synchronize({
      database,
      
      // =� PULL CHANGES: Call Supabase RPC function to get incremental changes
      // RPC functions are more efficient and handle complex sync logic server-side
      pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
        console.log('=� Calling contacts pull RPC with lastPulledAt:', lastPulledAt)
        
        // TODO: Implement when supabase client is available
        // =� SUPABASE RPC CALL: Server-side function handles all sync logic
        // This RPC function should return { changes, timestamp } format
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')
        
        const { data, error } = await supabase.rpc('pull', {
          requesting_user_id: user.id,      // Your authenticated user ID
          last_pulled_ms: lastPulledAt || 0 // Send timestamp for incremental sync
        })

        if (error) {
          console.error('L Pull RPC error:', error)
          throw error
        }

        // = TYPED RESPONSE: Supabase RPC returns structured sync data
        const { changes, timestamp } = data as {
          changes: SyncDatabaseChangeSet  // WatermelonDB's expected format
          timestamp: number               // Server timestamp for next sync
        }

        console.log(' Pull RPC successful - changes:', changes)
        return { changes, timestamp }
        
        
        // Temporary MVP implementation - return empty changes
        console.log('=� Pull RPC not implemented yet - working offline')
        return { 
          changes: { contacts: { created: [], updated: [], deleted: [] } }, 
          timestamp: Date.now() 
        }
      },
      
      // =� PUSH CHANGES: Send local changes to Supabase via RPC
      // RPC handles all the complex INSERT/UPDATE/DELETE logic server-side
      pushChanges: async ({ changes, lastPulledAt }) => {
        console.log('=� Calling contacts push RPC with changes:', changes)
        
        // TODO: Implement when supabase client is available
        // =� SUPABASE RPC CALL: Server-side function processes all changes atomically
        // This RPC function should handle created/updated/deleted records in one transaction
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')
        
        const { error } = await supabase.rpc('push', {
          requesting_user_id: user.id,  // Your authenticated user ID
          changes                        // All local changes in WatermelonDB format
        })

        if (error) {
          console.error('L Push RPC error:', error)
          throw error
        }

        console.log(' Push RPC successful')
        
        
        // Temporary MVP implementation - log changes only
        console.log('=� Push RPC not implemented yet - changes logged:', changes)
      },
      
      // � SYNC CONFIGURATION: Handle edge cases
      sendCreatedAsUpdated: true,  // If record exists remotely, treat local "create" as "update"
    })
    
    console.log(' Contacts sync completed successfully')
    // =� WatermelonDB's sync should automatically trigger UI updates via observables
    // If UI doesn't update, the issue is likely in observable configuration, not sync
  } catch (error) {
    console.error('L Contacts sync failed with error:', error)
    // =� App continues working offline even if sync fails!
  } finally {
    // =🔓 RELEASE: Always release the sync lock, even if sync fails
    isSyncing = false
  }
}

// =� AUTO-SYNC ORCHESTRATION: Keeps contact data synchronized automatically
export function startAutoSync() {
  // <� DELAYED INITIAL SYNC: Prevent immediate conflict with interval sync
  // Start sync after a small delay to avoid concurrent calls
  setTimeout(sync, 1000) // Initial sync 1 second after startup
  
  // � PERIODIC SYNC: Fallback to ensure eventual consistency
  // Even if real-time fails, we sync every 10 seconds
  const interval = setInterval(sync, 10000) // Sync every 10 seconds
  
  // TODO: Implement real-time sync when supabase client is available
  // =4 REAL-TIME SYNC: Instant updates when remote data changes
  // This is the magic that makes collaborative editing possible!
  /*
  const subscription = supabase
    .channel('contacts')  // Create a subscription channel
    .on('postgres_changes', { 
      event: '*',           // Listen to all events (INSERT, UPDATE, DELETE)
      schema: 'public',     // PostgreSQL schema name
      table: 'contacts'     // Table name to monitor
    }, () => {
      console.log('= Remote contact change detected, syncing...')
      sync()  // Immediately sync when someone else makes changes
    })
    .subscribe()  // Activate the subscription
  */
  
  // >� CLEANUP FUNCTION: Call this when component unmounts
  return () => {
    clearInterval(interval)      // Stop periodic sync
    // subscription.unsubscribe()   // Stop real-time subscription (when implemented)
  }
}

// <� MANUAL SYNC: For testing and user-triggered sync
export function syncNow() {
  return sync()
}

// =� HOW TO USE:
// 1. Call startAutoSync() in your main App component
// 2. Call the returned cleanup function when app closes
// 3. Use syncNow() for manual refresh buttons
// 4. All contact changes sync automatically in background!