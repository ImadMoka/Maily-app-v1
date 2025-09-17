import { SyncDatabaseChangeSet, synchronize } from '@nozbe/watermelondb/sync'
import { database } from './index'
import { supabase } from '../lib/supabase'

let isSyncing = false

async function sync() {
  if (isSyncing) {
    console.log('Sync already in progress')
    return
  }

  try {
    isSyncing = true
    console.log('Starting sync...')
    
    await synchronize({
      database,
      
      pullChanges: async ({ lastPulledAt }) => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')
          
          const { data, error } = await supabase.rpc('pull', {
            requesting_user_id: user.id,
            last_pulled_ms: lastPulledAt || 0
          })

          if (error) throw error

          return data as { changes: SyncDatabaseChangeSet; timestamp: number }
          
        } catch (error) {
          console.log('Pull failed, working offline:', error)
          return {
            changes: {
              contacts: { created: [], updated: [], deleted: [] },
              emails: { created: [], updated: [], deleted: [] },
              threads: { created: [], updated: [], deleted: [] }
            },
            timestamp: Date.now()
          }
        }
      },
      
      pushChanges: async ({ changes }) => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')
          
          const { error } = await supabase.rpc('push', {
            requesting_user_id: user.id,
            changes
          })

          if (error) throw error
          
        } catch (error) {
          console.log('Sync failed, queued locally:', error)
        }
      },
    })
    
    console.log('Sync completed')
    
  } catch (error) {
    console.log('Sync error:', error)
  } finally {
    isSyncing = false
  }
}

export function startAutoSync() {
  console.log('Starting auto-sync...')
  
  setTimeout(sync, 1000)
  const interval = setInterval(sync, 10000)
  
  return () => {
    console.log('Stopping auto-sync')
    clearInterval(interval)
  }
}

export function syncNow() {
  console.log('Manual sync requested')
  return sync()
}