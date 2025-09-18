#!/usr/bin/env bun
/**
 * IMAP Body Stream Demonstration
 *
 * This script shows EXACTLY how the 'body' event works in node-imap:
 * - Each requested body section triggers a separate 'body' event
 * - Each event provides a ReadableStream and an info object
 * - The stream must be collected to get the actual content
 *
 * Reference: https://www.npmjs.com/package/node-imap
 */

import Imap from 'node-imap';
import { Readable } from 'stream';

// Configuration
const imapConfig = {
  user: 'imadmokadem19@gmail.com',
  password: 'jfjlwpdfoxmfiiew',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

/**
 * Main function that demonstrates body event handling
 */
async function demonstrateBodyEvent() {
  const imap = new Imap(imapConfig);

  return new Promise((resolve, reject) => {
    const results = {
      messages: []
    };

    imap.once('ready', () => {
      console.log('Connected to IMAP server\n');

      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`Mailbox opened: ${box.messages.total} total messages\n`);

        // Fetch the last message
        const messageNum = box.messages.total;
        console.log(`Fetching message #${messageNum}\n`);
        console.log('=' .repeat(70));
        console.log('DEMONSTRATING THE BODY EVENT');
        console.log('=' .repeat(70) + '\n');

        // Request different body sections
        // Each will trigger a separate 'body' event
        const fetch = imap.seq.fetch(messageNum, {
          bodies: [
            '',           // Complete message (triggers body event #1)
            'HEADER',     // All headers (triggers body event #2)
            'TEXT',       // Body without headers (triggers body event #3)
            '1',          // First MIME part (triggers body event #4)
            '2'           // Second MIME part if exists (triggers body event #5)
          ],
          struct: true    // Get MIME structure
        });

        let currentMessage = {
          seqno: null,
          bodyEvents: [],
          structure: null
        };

        fetch.on('message', (msg, seqno) => {
          console.log(`Processing message #${seqno}\n`);
          currentMessage.seqno = seqno;
          let eventCount = 0;

          // THIS IS THE KEY EVENT - 'body' is emitted for EACH requested section
          msg.on('body', (stream, info) => {
            eventCount++;

            console.log(`📥 BODY EVENT #${eventCount}`);
            console.log(`   Requested section: "${info.which}"`);
            console.log(`   Stream type: ${stream.constructor.name}`);
            console.log(`   Size (if known): ${info.size || 'unknown'}`);

            // Create a container for this body event
            const bodyEvent = {
              eventNumber: eventCount,
              which: info.which,
              size: info.size,
              streamReceived: true,
              content: null,
              bytesCollected: 0
            };

            // The stream is a ReadableStream - we must collect its data
            const chunks = [];

            stream.on('data', (chunk) => {
              chunks.push(chunk);
              bodyEvent.bytesCollected += chunk.length;
              // Show progress
              process.stdout.write(`\r   Collecting stream: ${bodyEvent.bytesCollected} bytes`);
            });

            stream.on('end', () => {
              // Stream is complete - combine chunks into final content
              const fullContent = Buffer.concat(chunks);
              bodyEvent.content = fullContent.toString('utf8');

              console.log(`\r   ✓ Stream collected: ${bodyEvent.bytesCollected} bytes`);
              console.log(`   Content preview: "${bodyEvent.content.substring(0, 100).replace(/\r?\n/g, ' ')}..."\n`);

              currentMessage.bodyEvents.push(bodyEvent);
            });

            stream.on('error', (error) => {
              console.log(`   ❌ Stream error: ${error.message}\n`);
              bodyEvent.error = error.message;
              currentMessage.bodyEvents.push(bodyEvent);
            });
          });

          // Get message structure
          msg.on('attributes', (attrs) => {
            if (attrs.struct) {
              currentMessage.structure = attrs.struct;
              console.log('📋 Message structure received\n');
            }
          });

          msg.once('end', () => {
            console.log('✅ Message processing complete\n');
            results.messages.push(currentMessage);
          });
        });

        fetch.once('error', (err) => {
          console.error('Fetch error:', err);
          reject(err);
        });

        fetch.once('end', () => {
          console.log('=' .repeat(70));
          console.log('BODY EVENT SUMMARY');
          console.log('=' .repeat(70) + '\n');

          // Display summary
          if (results.messages.length > 0) {
            const msg = results.messages[0];
            console.log(`Total body events emitted: ${msg.bodyEvents.length}\n`);

            console.log('Body sections received:');
            msg.bodyEvents.forEach(event => {
              console.log(`  Event #${event.eventNumber}: Section "${event.which}"`);
              console.log(`    - Stream received: ${event.streamReceived ? 'Yes' : 'No'}`);
              console.log(`    - Bytes collected: ${event.bytesCollected}`);
              console.log(`    - Content available: ${event.content ? 'Yes' : 'No'}`);

              // Explain what each section contains
              let explanation = '';
              switch(event.which) {
                case '':
                  explanation = 'Complete RFC822 message (headers + body)';
                  break;
                case 'HEADER':
                  explanation = 'All email headers';
                  break;
                case 'TEXT':
                  explanation = 'Message body without headers';
                  break;
                case '1':
                  explanation = 'First MIME part (usually text/plain)';
                  break;
                case '2':
                  explanation = 'Second MIME part (usually text/html)';
                  break;
                default:
                  explanation = 'MIME part or custom section';
              }
              console.log(`    - Contains: ${explanation}\n`);
            });

            // Show MIME structure
            if (msg.structure) {
              console.log('MIME Structure:');
              displayStructure(msg.structure, '  ');
              console.log();
            }
          }

          imap.end();
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err);
      reject(err);
    });

    imap.once('end', () => {
      console.log('Connection closed');
      resolve(results);
    });

    imap.connect();
  });
}

/**
 * Helper to display MIME structure
 */
function displayStructure(struct, indent = '') {
  if (Array.isArray(struct)) {
    struct.forEach((part, index) => {
      if (typeof part === 'object' && !Array.isArray(part)) {
        console.log(`${indent}Part ${index + 1}: ${part.type}/${part.subtype} (${part.size || 'unknown'} bytes)`);
      } else if (Array.isArray(part)) {
        console.log(`${indent}Multipart ${index + 1}:`);
        displayStructure(part, indent + '  ');
      }
    });
  }
}

/**
 * Save results for inspection
 */
async function saveResults(results) {
  const fs = await import('fs/promises');

  // Prepare output (exclude full content for brevity)
  const output = {
    timestamp: new Date().toISOString(),
    description: 'Demonstration of IMAP body event emission',
    messages: results.messages.map(msg => ({
      seqno: msg.seqno,
      totalBodyEvents: msg.bodyEvents.length,
      bodyEvents: msg.bodyEvents.map(event => ({
        eventNumber: event.eventNumber,
        section: event.which,
        bytesCollected: event.bytesCollected,
        contentPreview: event.content ? event.content.substring(0, 200) : null,
        explanation: getExplanation(event.which)
      })),
      structure: msg.structure
    }))
  };

  await fs.writeFile(
    'imap-body-event-demo.json',
    JSON.stringify(output, null, 2)
  );

  console.log('💾 Results saved to imap-body-event-demo.json\n');
}

/**
 * Get explanation for a body section
 */
function getExplanation(section) {
  const explanations = {
    '': 'Complete RFC822 message including all headers and body',
    'HEADER': 'All message headers',
    'TEXT': 'Message body without headers (includes MIME boundaries)',
    '1': 'First MIME part (often text/plain version)',
    '2': 'Second MIME part (often text/html version)',
    '1.1': 'First sub-part of first MIME part',
    '1.HEADER': 'Headers of first MIME part',
    '1.TEXT': 'Body of first MIME part'
  };
  return explanations[section] || 'Custom body section';
}

// Main execution
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         IMAP BODY EVENT STREAM DEMONSTRATION              ║');
  console.log('║                                                            ║');
  console.log('║  Shows how each requested body section triggers a         ║');
  console.log('║  separate \'body\' event with a ReadableStream              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const results = await demonstrateBodyEvent();
    await saveResults(results);
    console.log('✅ Demonstration complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}