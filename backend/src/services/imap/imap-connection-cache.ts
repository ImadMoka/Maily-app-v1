const Imap = require('node-imap')

interface CachedConnection {
  connection: typeof Imap
  expiresAt: number
}

export class ImapConnectionCache {
  private cache = new Map<string, CachedConnection>()
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes

  private cacheKey(userId: string, accountId: string): string {
    return `${userId}::${accountId}`
  }

  get(userId: string, accountId: string): typeof Imap | null {
    const key = this.cacheKey(userId, accountId)
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return cached.connection
  }

  set(userId: string, accountId: string, connection: typeof Imap): void {
    const key = this.cacheKey(userId, accountId)
    
    connection.on('end', () => {
      this.cache.delete(key)
    })

    connection.on('error', () => {
      this.cache.delete(key)
    })

    this.cache.set(key, {
      connection,
      expiresAt: Date.now() + this.TTL_MS
    })
    
    this.cleanupExpired()
  }

  remove(userId: string, accountId: string): void {
    const key = this.cacheKey(userId, accountId)
    const cached = this.cache.get(key)
    
    if (cached) {
      try {
        cached.connection.end()
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    this.cache.delete(key)
  }

  private cleanupExpired(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

export const imapConnectionCache = new ImapConnectionCache()