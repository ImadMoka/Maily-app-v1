import { SyncQueueService } from '../queue/sync-queue.service';

async function checkQueueStatus() {
  const queueService = new SyncQueueService(process.env.DATABASE_URL);

  try {
    await queueService.initialize();
    const status = await queueService.getStatus();

    if (status) {
      console.log('Queue Status:');
      console.log(`  Pending: ${status.pending}`);
      console.log(`  Active: ${status.active}`);
      console.log(`  Completed: ${status.completed}`);
      console.log(`  Failed: ${status.failed}`);
    } else {
      console.log('Queue not available (DATABASE_URL may not be set)');
    }

    await queueService.shutdown();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkQueueStatus().then(() => process.exit(0));