// =================================================================
// QUEUE MODULE EXPORTS
// =================================================================
// This file is the "public interface" of the queue module.
// Other parts of the app import from here, not directly from sync-queue.service.ts
// This pattern allows us to change internal implementation without breaking imports

// Re-export everything from sync-queue.service.ts that other modules need:
// - SyncQueueService: The main class for queue operations
// - getQueueService: Function to get singleton instance (ensures only one queue)
// - SyncTask: TypeScript type definition for task data structure
export { SyncQueueService, getQueueService, type SyncTask } from './sync-queue.service';

// =================================================================
// LEGACY COMPATIBILITY
// =================================================================
// This empty class is here for backward compatibility
// The original queue service stub had this class, so we keep it
// to avoid breaking any code that might import it
// Will be removed once we're sure nothing uses it

export class QueueService {
  addJob(queue: string, data: any) {
    console.warn('QueueService: Legacy method called, use SyncQueueService instead');
  }

  processJobs(queue: string) {
    console.warn('QueueService: Legacy method called, use SyncQueueService instead');
  }

  getQueueStatus(queue: string) {
    console.warn('QueueService: Legacy method called, use SyncQueueService instead');
  }
}