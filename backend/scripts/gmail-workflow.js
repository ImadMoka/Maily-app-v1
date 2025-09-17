// test-all-mail-read-state-fixed.js
const Imap = require('imap');

// Function to get All Mail folder name
async function getAllMailFolder(imapConfig) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    
    imap.once('ready', () => {
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end();
          return reject(err);
        }
        
        let allMailPath = null;
        const gmailBoxes = boxes['[Gmail]']?.children || {};
        
        for (const [name, box] of Object.entries(gmailBoxes)) {
          if (box.attribs?.includes('\\All')) {
            allMailPath = `[Gmail]/${name}`;
            break;
          }
        }
        
        imap.end();
        resolve(allMailPath);
      });
    });
    
    imap.once('error', reject);
    imap.connect();
  });
}

// Fixed function to mark emails as read
async function testMarkAsRead(imapConfig, allMailFolder, numberOfEmails = 5) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    const results = {
      totalMessages: 0,
      unreadBefore: [],
      markedAsRead: [],
      unreadAfter: [],
      errors: []
    };
    
    imap.once('ready', () => {
      console.log('   Opening All Mail folder in READ-WRITE mode...');
      
      // CRITICAL: false = read-write mode (not readonly)
      imap.openBox(allMailFolder, false, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }
        
        console.log('   ✅ Folder opened successfully in read-write mode');
        results.totalMessages = box.messages.total;
        
        if (box.messages.total === 0) {
          imap.end();
          return resolve(results);
        }
        
        // Get the last N messages
        const start = Math.max(1, box.messages.total - numberOfEmails + 1);
        const range = `${start}:${box.messages.total}`;
        
        console.log(`   Fetching messages ${range} to check their status...`);
        
        // First, fetch messages to see their current state
        const messages = [];
        const fetch = imap.seq.fetch(range, {
          bodies: '',
          struct: false,
          envelope: true,
          flags: true
        });
        
        fetch.on('message', (msg, seqno) => {
          const messageInfo = { seqno, flags: [], uid: null };
          
          msg.on('attributes', (attrs) => {
            messageInfo.flags = attrs.flags;
            messageInfo.uid = attrs.uid;
            messageInfo.isRead = attrs.flags.includes('\\Seen');
          });
          
          msg.once('end', () => {
            messages.push(messageInfo);
            if (!messageInfo.isRead) {
              results.unreadBefore.push(seqno);
            }
          });
        });
        
        fetch.once('error', (err) => {
          console.error('   Fetch error:', err);
          results.errors.push(err);
          imap.end();
          reject(err);
        });
        
        fetch.once('end', () => {
          console.log(`   Found ${results.unreadBefore.length} unread messages in range`);
          
          if (results.unreadBefore.length === 0) {
            console.log('   All messages are already read. Marking them as unread first for testing...');
            
            // First remove the \Seen flag to make them unread
            imap.seq.delFlags(range, ['\\Seen'], (err) => {
              if (err) {
                console.error('   Error removing Seen flag:', err);
                imap.end();
                return reject(err);
              }
              
              console.log('   Messages marked as unread. Now marking them back as read...');
              
              // Now add the \Seen flag
              setTimeout(() => {
                markAsSeenAndVerify();
              }, 1000);
            });
          } else {
            // Mark unread messages as read
            markAsSeenAndVerify();
          }
          
          function markAsSeenAndVerify() {
            console.log(`   Adding \\Seen flag to messages ${range}...`);
            
            // Use sequence numbers to mark the range as read
            imap.seq.addFlags(range, ['\\Seen'], (err) => {
              if (err) {
                console.error('   Error adding Seen flag:', err);
                results.errors.push(err);
                imap.end();
                return reject(err);
              }
              
              console.log('   ✅ Successfully added \\Seen flag');
              results.markedAsRead = range;
              
              // Wait a bit for Gmail to process, then verify
              setTimeout(() => {
                console.log('   Verifying changes...');
                
                // Fetch again to verify
                const verifyFetch = imap.seq.fetch(range, {
                  bodies: '',
                  struct: false,
                  flags: true
                });
                
                let unreadCount = 0;
                
                verifyFetch.on('message', (msg, seqno) => {
                  msg.on('attributes', (attrs) => {
                    if (!attrs.flags.includes('\\Seen')) {
                      unreadCount++;
                      results.unreadAfter.push(seqno);
                    }
                  });
                });
                
                verifyFetch.once('end', () => {
                  console.log(`   Verification complete: ${unreadCount} messages still unread`);
                  imap.end();
                  resolve(results);
                });
                
                verifyFetch.once('error', (err) => {
                  console.error('   Verification error:', err);
                  imap.end();
                  reject(err);
                });
              }, 2000); // Give Gmail time to process
            });
          }
        });
      });
    });
    
    imap.once('error', (err) => {
      console.error('IMAP connection error:', err);
      reject(err);
    });
    
    imap.connect();
  });
}

// Function to get message details with better error handling
async function getMessageDetails(imapConfig, allMailFolder, count = 5) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    const messages = [];
    
    imap.once('ready', () => {
      // Open in readonly mode for fetching
      imap.openBox(allMailFolder, true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }
        
        if (box.messages.total === 0) {
          imap.end();
          return resolve(messages);
        }
        
        const start = Math.max(1, box.messages.total - count + 1);
        const range = `${start}:${box.messages.total}`;
        
        const fetch = imap.seq.fetch(range, {
          bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
          struct: false,
          flags: true
        });
        
        fetch.on('message', (msg, seqno) => {
          const message = { seqno, headers: {}, flags: [], uid: null };
          
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', chunk => buffer += chunk.toString('utf8'));
            stream.once('end', () => {
              message.headers = Imap.parseHeader(buffer);
            });
          });
          
          msg.on('attributes', (attrs) => {
            message.flags = attrs.flags;
            message.uid = attrs.uid;
            message.isRead = attrs.flags.includes('\\Seen');
          });
          
          msg.once('end', () => messages.push(message));
        });
        
        fetch.once('end', () => {
          // Sort by sequence number to maintain order
          messages.sort((a, b) => a.seqno - b.seqno);
          imap.end();
          resolve(messages);
        });
        
        fetch.once('error', (err) => {
          imap.end();
          reject(err);
        });
      });
    });
    
    imap.once('error', reject);
    imap.connect();
  });
}

// Alternative: Mark specific UIDs as read (more reliable for Gmail)
async function markSpecificMessagesAsRead(imapConfig, allMailFolder) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    
    imap.once('ready', () => {
      imap.openBox(allMailFolder, false, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }
        
        // Search for UNSEEN messages
        imap.search(['UNSEEN'], (err, uids) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          
          if (uids.length === 0) {
            console.log('   No unread messages found');
            imap.end();
            return resolve({ marked: 0 });
          }
          
          console.log(`   Found ${uids.length} unread messages with UIDs:`, uids.slice(0, 5));
          
          // Mark first 5 unread messages as read using UIDs
          const uidsToMark = uids.slice(0, 5);
          
          imap.addFlags(uidsToMark, ['\\Seen'], (err) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            
            console.log(`   ✅ Marked ${uidsToMark.length} messages as read using UIDs`);
            imap.end();
            resolve({ marked: uidsToMark.length, uids: uidsToMark });
          });
        });
      });
    });
    
    imap.once('error', reject);
    imap.connect();
  });
}

// Main test script
async function runTest() {
  const config = {
    user: 'imadmokadem19@gmail.com',
    password: 'jfjlwpdfoxmfiiew',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };
  
  console.log('========================================');
  console.log('Testing Gmail Mark as Read (FIXED)');
  console.log('========================================\n');
  
  try {
    // Step 1: Find the All Mail folder
    console.log('Step 1: Finding All Mail folder...');
    const allMailFolder = await getAllMailFolder(config);
    
    if (!allMailFolder) {
      throw new Error('Could not find All Mail folder!');
    }
    
    console.log('✅ Found All Mail folder:', allMailFolder);
    
    // Step 2: Get current state
    console.log('\nStep 2: Checking current message state...');
    const messagesBefore = await getMessageDetails(config, allMailFolder, 5);
    
    console.log('Messages BEFORE marking as read:');
    messagesBefore.forEach(msg => {
      const subject = msg.headers.subject?.[0] || 'No subject';
      console.log(`   ${msg.isRead ? '📧' : '📨'} [${msg.seqno}] ${subject.substring(0, 50)} (${msg.isRead ? 'Read' : 'Unread'})`);
    });
    
    // Step 3: Try both methods
    console.log('\nStep 3: Testing mark as read with UIDs (more reliable)...');
    const uidResult = await markSpecificMessagesAsRead(config, allMailFolder);
    
    console.log('\nStep 4: Testing mark as read with sequence numbers...');
    const seqResult = await testMarkAsRead(config, allMailFolder, 5);
    
    // Step 5: Final verification
    console.log('\nStep 5: Final verification...');
    const messagesAfter = await getMessageDetails(config, allMailFolder, 5);
    
    console.log('Messages AFTER marking as read:');
    messagesAfter.forEach(msg => {
      const subject = msg.headers.subject?.[0] || 'No subject';
      console.log(`   ${msg.isRead ? '📧' : '📨'} [${msg.seqno}] ${subject.substring(0, 50)} (${msg.isRead ? 'Read' : 'Unread'})`);
    });
    
    // Check if any changes occurred
    const changedCount = messagesAfter.filter(m => m.isRead).length - 
                        messagesBefore.filter(m => m.isRead).length;
    
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Messages marked with UIDs: ${uidResult.marked}`);
    console.log(`Messages marked with seq numbers: ${seqResult.markedAsRead}`);
    console.log(`Net change in read messages: ${changedCount}`);
    
    if (changedCount > 0 || uidResult.marked > 0) {
      console.log('\n✅ SUCCESS: Messages were marked as read!');
    } else {
      console.log('\n⚠️  WARNING: No changes detected. Possible reasons:');
      console.log('   - All messages were already read');
      console.log('   - Gmail may require different flag format');
      console.log('   - Account permissions may be restricted');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
console.log('Starting fixed test...\n');
runTest().catch(console.error);