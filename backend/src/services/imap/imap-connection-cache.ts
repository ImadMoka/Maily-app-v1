const Imap = require('node-imap')

// This interface defines what we store in each cache entry
interface CachedConnection {
  connection: typeof Imap  // The actual IMAP connection object (TCP socket to email server)
  expiresAt: number       // Unix timestamp when this connection should be considered stale
}

/**
 * IMAP Connection Cache - Stores active email server connections in SERVER MEMORY
 * 
 * WHERE IS DATA STORED?
 * - Location: Server's RAM (not user's device, not disk, not database)
 * - Type: In-memory JavaScript Map (like a dictionary/hash table)
 * - Persistence: Data disappears when server restarts - this is temporary storage only
 * - Size: Only stores connection objects (very small memory footprint)
 * 
 * WHY CACHE CONNECTIONS?
 * - Email servers (Gmail, Outlook, etc.) take 1-2 seconds to establish secure connection
 * - Users often fetch emails multiple times quickly
 * - Instead of reconnecting each time, we reuse the same connection pipe
 * 
 * ANALOGY: Like keeping a phone call on hold instead of hanging up and redialing
 */
export class ImapConnectionCache {
  // This Map stores our cache entries in the server's RAM memory
  // Key: "userId::accountId" (string), Value: CachedConnection object
  private cache = new Map<string, CachedConnection>()
  
  // How long to keep connections alive before throwing them away (5 minutes)
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes

  /**
   * Creates a unique key for each user-account combination
   * Example: user "123" with account "456" becomes "123::456"
   * This ensures User A cannot access User B's connections
   */
  private cacheKey(userId: string, accountId: string): string {
    return `${userId}::${accountId}`
  }

  /**
   * RETRIEVES a cached connection from server memory
   * 
   * FLOW:
   * 1. Look up connection in memory using userId::accountId key
   * 2. If not found → return null (caller will create new connection)
   * 3. If found but expired → delete from memory and return null
   * 4. If found and still fresh → return the live connection
   * 
   * PERFORMANCE: This lookup happens in server's RAM - extremely fast (< 1ms)
   */
  get(userId: string, accountId: string): typeof Imap | null {
    const key = this.cacheKey(userId, accountId) // Create lookup key: "123::456"
    const cached = this.cache.get(key)          // Search server's memory for this key
    
    // CACHE MISS: No connection found in memory for this user+account
    if (!cached) {
      return null // Caller will need to create new connection to email server
    }

    // CACHE EXPIRY CHECK: Connection exists but might be too old to trust
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key) // Remove stale connection from memory
      return null            // Caller will create fresh connection
    }
    
    // CACHE HIT: Found fresh connection in memory - reuse it!
    return cached.connection
  }

  /**
   * STORES a new connection in server memory for future reuse
   * 
   * WHAT GETS STORED:
   * - The actual TCP socket connection to email server (Gmail, Outlook, etc.)
   * - Expiration timestamp (current time + 5 minutes)
   * - Stored in server's RAM using key "userId::accountId"
   * 
   * AUTO-CLEANUP LISTENERS:
   * - If email server closes connection → automatically remove from cache
   * - If connection errors occur → automatically remove from cache  
   * - This prevents storing broken connections
   */
  set(userId: string, accountId: string, connection: typeof Imap): void {
    const key = this.cacheKey(userId, accountId) // Create storage key: "123::456"
    
    // LISTENER 1: If email server closes the connection, remove from our cache
    connection.on('end', () => {
      this.cache.delete(key) // Remove from server memory immediately
    })

    // LISTENER 2: If connection breaks/errors, remove from our cache
    connection.on('error', () => {
      this.cache.delete(key) // Remove broken connection from server memory
    })

    // STORE IN MEMORY: Save connection object in server's RAM
    this.cache.set(key, {
      connection,                        // The live TCP connection to email server
      expiresAt: Date.now() + this.TTL_MS // Set expiry time (now + 5 minutes)
    })
    
    // HOUSEKEEPING: Clean up any old expired connections while we're here
    this.cleanupExpired()
  }

  /**
   * MANUALLY REMOVES a connection from cache (rarely used)
   * 
   * USE CASES:
   * - User logs out → force remove their cached connections
   * - Account deleted → cleanup associated connections
   * - Manual cache invalidation for troubleshooting
   */
  remove(userId: string, accountId: string): void {
    const key = this.cacheKey(userId, accountId)  // Find the cache entry
    const cached = this.cache.get(key)           // Get it from server memory
    
    // GRACEFUL CLEANUP: Try to properly close the email server connection
    if (cached) {
      try {
        cached.connection.end() // Tell email server we're disconnecting
      } catch (error) {
        // Ignore cleanup errors - connection might already be dead
      }
    }
    
    // REMOVE FROM MEMORY: Delete the entry from server's RAM
    this.cache.delete(key)
  }

  /**
   * BACKGROUND CLEANUP: Removes expired connections from server memory
   * 
   * WHEN IT RUNS:
   * - Called automatically every time we store a new connection
   * - Prevents memory leaks by cleaning up old connections
   * - Runs in background - user never sees this happening
   * 
   * HOW IT WORKS:
   * - Loops through all cached connections in server memory
   * - Checks if each one is past its expiry time (older than 5 minutes)
   * - Deletes expired ones to free up server RAM
   */
  private cleanupExpired(): void {
    const now = Date.now()  // Get current timestamp
    
    // Loop through every connection stored in server memory
    for (const [key, cached] of this.cache.entries()) {
      // If this connection is older than 5 minutes, delete it
      if (now > cached.expiresAt) {
        this.cache.delete(key) // Free up server memory
      }
    }
  }
}

// SINGLETON INSTANCE: One shared cache for the entire server application
// This gets imported and used by email routes to store/retrieve connections
export const imapConnectionCache = new ImapConnectionCache()