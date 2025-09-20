import { SyncQueueService, type SyncTask } from '../queue/sync-queue.service';

// Test to verify queue service is working
async function testQueue() {
  console.log('Testing Queue Service\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not configured - queue will run in disabled mode');
  }

  // Create queue service
  const queueService = new SyncQueueService(databaseUrl);

  try {
    // Initialize the queue
    console.log('Initializing queue...');
    await queueService.initialize();
    console.log('✅ Queue initialized\n');

    // Create a test task
    const testTask: SyncTask = {
      accountId: 'test-account-123',
      type: 'initial_sync',
      payload: {
        folder: 'INBOX',
        limit: 10
      },
      checkpoint: {
        lastUid: 0,
        totalFetched: 0
      }
    };

    // Enqueue a test task
    console.log('Enqueueing test task...');
    const jobId = await queueService.enqueue(testTask);

    if (jobId) {
      console.log(`✅ Task enqueued with ID: ${jobId}\n`);
    } else {
      console.log('⚠️  Task not enqueued (queue may be disabled)\n');
    }

    // Check queue status
    const status = await queueService.getStatus();
    if (status) {
      console.log('Queue status:', JSON.stringify(status, null, 2));
    }

    // Wait for processing
    if (jobId) {
      console.log('\nWaiting 3 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const finalStatus = await queueService.getStatus();
      if (finalStatus) {
        console.log('Final status:', JSON.stringify(finalStatus, null, 2));
      }
    }

    // Cleanup
    await queueService.shutdown();
    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    await queueService.shutdown();
    process.exit(1);
  }
}

// Run the test
testQueue().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});