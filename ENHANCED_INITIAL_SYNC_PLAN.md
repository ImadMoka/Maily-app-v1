# Enhanced Initial Sync Implementation Plan

## Current Status: Phase 1.1 ✅ COMPLETE

**Completed**: Persistent Task Queue with pg-boss
**Next**: Connect queue to existing IMAP services (Phase 1.2)
**Location**: `/backend/src/services/queue/`

## Executive Summary
Transform the current limited 200-email sync into a robust, scalable system capable of handling entire email accounts with tens of thousands of emails through an incremental, stability-first approach inspired by Mailspring's architecture.

## Current State Analysis

### Limitations
- Fixed 200 email limit: `/backend/src/services/initial-sync/initial-sync.service.ts:52`
- Sequential processing: `/backend/src/services/initial-sync/initial-sync.service.ts:68-95`
- No pagination support: `/backend/src/services/imap/imap.service.ts:45-120`
- Single IMAP connection per operation: `/backend/src/services/imap/imap.service.ts:22-43`
- No retry mechanism: `/backend/src/services/initial-sync/initial-sync.service.ts:96-106`

## Phase 1: Foundation Enhancement - Incremental Stability (Week 1-2)

### IMPLEMENTATION ORDER 🎯

**Build each layer on solid foundations:**
1. ✅ **COMPLETE**: Task Queue - Foundation for everything else
2. **Second**: Connection Management (Days 4-5) - Reliable IMAP operations
3. **Third**: Error Handling (Days 6-7) - Production readiness
4. **Finally**: Pagination (Days 8-10) - Performance optimization

### 1.1 Persistent Task Queue Implementation ✅ COMPLETED

**What Was Built:**
- **Location**: `/backend/src/services/queue/sync-queue.service.ts`
- **Technology**: pg-boss with PostgreSQL (Supabase)
- **Features Implemented**:
  - ✅ Queue service with graceful degradation
  - ✅ Automatic schema creation (pgboss.* tables)
  - ✅ Job enqueueing with unique IDs
  - ✅ Background worker processing
  - ✅ 3 retries with 1-minute delays
  - ✅ Singleton pattern to prevent duplicate processing
  - ✅ Graceful shutdown on SIGTERM/SIGINT

**How to Use:**
```typescript
import { getQueueService } from './services/queue';

const queue = getQueueService(process.env.DATABASE_URL);
await queue.enqueue({
  accountId: 'abc-123',
  type: 'initial_sync',
  payload: { folder: 'INBOX', limit: 500 }
});
```

**Next Step**: Connect to existing IMAP services in processJob()

### 1.2 Connect Queue to IMAP Services [Days 4-5]
**Primary Goal**: Wire up the queue's processJob() to call existing services

**Step 1 - Update processJob() in sync-queue.service.ts:**
```typescript
private async processJob(job: PgBoss.Job<SyncTask>) {
  const { accountId, type } = job.data;

  // Call existing InitialSyncService
  const syncService = new InitialSyncService();
  await syncService.performInitialSync(accountId);
}
```

**Step 2 - Modify account creation to use queue:**
```typescript
// In AccountRoutes.handleCreateAccount()
const account = await accountService.createAccount(...);
const queue = getQueueService(process.env.DATABASE_URL);
await queue.enqueue({
  accountId: account.id,
  type: 'initial_sync',
  payload: { folder: '[Gmail]/All Mail', limit: 500 }
});
```

**Step 3 - Add connection resilience:**
- Wrap IMAP operations in try-catch
- Add connection timeout (30s operations, 5s auth)
- Implement reconnection logic
- Let queue handle retries via job failures

### 1.3 Enhanced Error Handling & Recovery [Days 6-7]
**Location**: Update `/backend/src/services/initial-sync/initial-sync.service.ts:96-106`
- Implement error classification (network, auth, quota, parsing, timeout)
- Add exponential backoff with jitter (1s, 2s, 4s, 8s, max 30s)
- Create recovery strategies per error type
- Log detailed error context with stack traces
- Implement graceful degradation (partial sync success)
- Add telemetry for error patterns analysis
- **Depends on**: Queue for retry logic, Connection for error context

### 1.4 Basic Pagination Without Parallelism [Days 8-10]
**Location**: Enhance `/backend/src/services/imap/imap.service.ts:45-120`
- Implement UID-based sequential pagination (500 emails per page)
- Add state persistence between pages (last_uid, total_fetched)
- Implement resumable sync from last checkpoint
- Single-threaded processing to ensure stability
- Add progress reporting callback mechanism
- Store folder-specific sync positions
- **Depends on**: Queue for checkpoint storage, Error handling for failures

## Phase 2: Core Sync Enhancement (Week 3)

### 2.1 Incremental Sync Strategy
**Location**: Create `/backend/src/services/sync/incremental-sync.ts`
- Implement date-based initial fetch (last 30 days first)
- Add backward pagination for historical emails
- Store highest_uid per folder for new email detection
- Implement change detection using IMAP IDLE when available
- Add sync scheduling based on account activity

### 2.2 Memory-Efficient Processing
**Location**: Refactor `/backend/src/services/initial-sync/initial-sync.service.ts:68-95`
- Process emails in chunks of 100 to limit memory usage
- Implement streaming for email body processing
- Add garbage collection hints between batches
- Monitor heap usage and pause when threshold reached
- Implement disk-based buffering for large operations

### 2.3 Progressive Sync Strategy
**Location**: Create `/backend/src/services/sync/progressive-sync.ts`
- Fetch most recent 1000 emails immediately
- Queue historical email fetch as background task
- Implement user-triggered deep sync for date ranges
- Add predictive prefetching based on user patterns
- Priority sync for starred/important folders

## Phase 3: Database Optimization (Week 4)

### 3.1 Transaction Management
**Location**: Update `/backend/src/services/emails/email.service.ts:85-120`
- Implement savepoint-based nested transactions
- Add batch size optimization based on data volume
- Use advisory locks to prevent concurrent syncs
- Implement deadlock detection and retry
- Add transaction-level error recovery

### 3.2 Bulk Operations
**Location**: Create `/backend/src/services/database/bulk-operations.ts`
- Implement prepared statement caching
- Use COPY for inserts over 1000 records
- Add multi-row upserts with conflict handling
- Implement batch contact deduplication
- Optimize thread computation updates

### 3.3 Sync State Management
**Location**: Create `/backend/src/services/sync/sync-state.ts`
- Track detailed sync progress per folder
- Store sync history with performance metrics
- Implement sync conflict resolution
- Add sync status dashboard data
- Create audit log for sync operations

## Phase 4: Connection Optimization (Week 5)

### 4.1 Connection Pool Implementation (After Proving Stability)
**Location**: Create `/backend/src/services/imap/connection-pool.ts`
- Start with 2 connections per account maximum
- Implement connection lifecycle management
- Add connection health monitoring
- Implement fair scheduling across accounts
- Add connection metrics and alerting

### 4.2 Parallel Processing (Careful Introduction)
**Location**: Update `/backend/src/services/initial-sync/initial-sync.service.ts:68-95`
- Start with 2 parallel streams maximum
- Implement work stealing for load balancing
- Add backpressure handling
- Monitor resource usage per stream
- Implement dynamic parallelism adjustment

### 4.3 Rate Limiting & Throttling
**Location**: Create `/backend/src/middleware/rate-limiter.ts`
- Implement provider-specific limits (Gmail: 250 quota units/user/second)
- Add adaptive throttling based on error rates
- Implement token bucket algorithm
- Add per-account rate tracking
- Create rate limit dashboard

## Phase 5: Performance Monitoring (Week 6)

### 5.1 Metrics Collection
**Location**: Create `/backend/src/monitoring/metrics.ts`
- Track sync duration per account
- Monitor email processing rate
- Measure database operation latency
- Track memory usage patterns
- Record error rates by type

### 5.2 Observability
**Location**: Create `/backend/src/monitoring/tracing.ts`
- Add OpenTelemetry instrumentation
- Implement distributed tracing
- Create performance dashboards
- Add alerting rules
- Implement SLA monitoring

### 5.3 Health Checks
**Location**: Create `/backend/src/health/sync-health.ts`
- Monitor queue depth and processing rate
- Check IMAP connection health
- Validate database connection pool
- Track sync freshness per account
- Implement automated recovery triggers

## Detailed Queue Implementation Guide (Foundation Layer)

### Queue Schema Design
```sql
-- sync_tasks table
CREATE TABLE sync_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES email_accounts(id),
  task_type VARCHAR(50) NOT NULL, -- 'initial_sync', 'incremental_sync', 'folder_sync'
  status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent
  payload JSONB NOT NULL, -- task-specific data
  checkpoint JSONB, -- resumption data (last_uid, progress, etc)
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  error_log JSONB[], -- array of error details
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  next_retry_at TIMESTAMP
);

-- Indexes for efficient queue operations
CREATE INDEX idx_sync_tasks_pending ON sync_tasks(status, priority DESC, created_at)
  WHERE status = 'pending';
CREATE INDEX idx_sync_tasks_account ON sync_tasks(account_id, status);
```

### Queue Service Implementation
```typescript
// /backend/src/services/queue/sync-queue.service.ts
interface SyncTask {
  accountId: string;
  type: 'initial_sync' | 'incremental_sync' | 'folder_sync';
  payload: {
    folder?: string;
    startDate?: Date;
    endDate?: Date;
    pageSize?: number;
  };
  checkpoint?: {
    lastUid?: number;
    totalFetched?: number;
    currentFolder?: string;
  };
}

class SyncQueueService {
  async enqueueSync(task: SyncTask): Promise<string> {
    // Check for duplicate tasks
    // Insert with deduplication logic
    // Return task ID
  }

  async processNext(): Promise<void> {
    // Fetch highest priority pending task
    // Mark as processing
    // Execute with checkpoint updates
    // Handle completion/failure
  }

  async resumeFromCheckpoint(taskId: string): Promise<void> {
    // Load checkpoint data
    // Resume from last position
    // Update progress incrementally
  }
}
```

## Implementation Priority (Updated Dec 2024)

### ✅ Completed
1. Task queue with persistence: `/backend/src/services/queue/sync-queue.service.ts`
   - pg-boss integration complete
   - Background worker running
   - Graceful degradation implemented

### 🚧 In Progress (Week 1-2)
2. Connect queue to IMAP: Integration between queue and existing services
3. Error handling & recovery: `/backend/src/services/initial-sync/initial-sync.service.ts:96-106`
4. Basic pagination: `/backend/src/services/imap/imap.service.ts:45-120`

### High Priority (Week 3-4)
5. Incremental sync: New file `/backend/src/services/sync/incremental-sync.ts`
6. Memory-efficient processing: `/backend/src/services/initial-sync/initial-sync.service.ts:68-95`
7. Transaction management: `/backend/src/services/emails/email.service.ts:85-120`
8. Sync state tracking: New file `/backend/src/services/sync/sync-state.ts`

### Medium Priority (Week 5-6)
9. Connection pooling (after stability): New file `/backend/src/services/imap/connection-pool.ts`
10. Parallel processing (careful): Update existing sync service
11. Monitoring: New directory `/backend/src/monitoring/`
12. Health checks: New directory `/backend/src/health/`

## Success Metrics

### Stability Targets (Phase 1)
- Zero data loss during sync failures
- Successful recovery from interruption within 10 seconds
- Error rate < 1% for network issues
- Memory usage < 512MB for 10,000 emails

### Performance Targets (Later Phases)
- Handle 100,000+ emails per account
- Process 500 emails per minute (Phase 1), 2000 (Phase 4)
- Maintain < 1GB memory footprint
- Support 50 concurrent syncs (Phase 1), 200 (Phase 4)

## Risk Mitigation

### Phase 1 Risks
- **Queue failures**: Implement manual queue management tools
- **Memory leaks**: Add memory profiling and limits
- **Connection drops**: Automatic reconnection with state preservation
- **Data corruption**: Add checksums and validation

### Scaling Risks (Later Phases)
- **Concurrent access**: Use advisory locks and transactions
- **Resource exhaustion**: Implement circuit breakers
- **Provider throttling**: Adaptive rate limiting
- **Database locks**: Query optimization and timeout handling

## Testing Strategy

### Phase 1 Testing
- Unit test error handling scenarios
- Test queue persistence and recovery
- Verify pagination edge cases
- Simulate connection failures

### Integration Testing
- Test with 10,000 emails incrementally
- Verify checkpoint recovery
- Test memory bounds compliance
- Validate error classification

### Production Readiness
- Gradual rollout with feature flags
- A/B testing with selected accounts
- Monitor key metrics for regression
- Maintain rollback capability

## Migration Path

### Step 1: Deploy Queue System
- Deploy task queue alongside existing sync
- Route new syncs through queue
- Monitor queue performance
- Keep fallback to direct sync

### Step 2: Enable Pagination
- Start with 100-email pages
- Gradually increase to 500
- Monitor memory and performance
- Verify checkpoint recovery

### Step 3: Production Rollout
- Enable for new accounts first
- Migrate existing accounts in batches
- Monitor error rates closely
- Provide manual sync triggers

## Documentation Requirements

### Development Documentation
- Queue system architecture and operations
- Error handling decision tree
- Pagination implementation details
- Connection management best practices

### Operations Documentation
- Queue monitoring and management
- Error investigation procedures
- Performance tuning guidelines
- Disaster recovery runbook