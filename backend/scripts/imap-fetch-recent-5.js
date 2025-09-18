#!/usr/bin/env bun
/**
 * IMAP Fetch Recent 5 Messages
 *
 * Fetches the 5 most recent messages from the inbox
 * and saves all their body content to files
 */

import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const imapConfig = {
  user: 'imadmokadem@gmail.com',
  password: 'milgfuagvhxnalte',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

/**
 * Collect stream data into a buffer
 */
function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Fetch the 5 most recent messages
 */
async function fetchRecent5Messages() {
  const imap = new Imap(imapConfig);

  return new Promise((resolve, reject) => {
    const messages = new Map(); // Use Map to organize messages by seqno

    imap.once('ready', () => {
      console.log('✅ Connected to IMAP server\n');

      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📬 Mailbox opened: ${box.messages.total} total messages`);

        // Calculate range for last 5 messages
        const total = box.messages.total;
        const start = Math.max(1, total - 4); // Get last 5 messages
        const fetchRange = `${start}:${total}`;

        console.log(`📥 Fetching messages: ${fetchRange} (5 most recent)\n`);
        console.log('═'.repeat(70) + '\n');

        // Fetch messages with all body sections
        const fetch = imap.seq.fetch(fetchRange, {
          bodies: [
            '',        // Complete message
            'HEADER',  // Headers only
            'TEXT',    // Body without headers
            '1',       // First MIME part (usually plain text)
            '2',       // Second MIME part (usually HTML)
          ],
          envelope: true,
          struct: true,
          flags: true,
          size: true
        });

        let messageCount = 0;

        fetch.on('message', (msg, seqno) => {
          messageCount++;
          console.log(`📧 Processing message #${seqno} (${messageCount}/5)`);

          // Initialize message data structure
          if (!messages.has(seqno)) {
            messages.set(seqno, {
              seqno,
              bodies: {},
              attributes: null,
              parsedMessage: null,
              processingComplete: false
            });
          }

          const currentMessage = messages.get(seqno);
          let bodyCount = 0;
          let bodiesProcessed = 0;
          const expectedBodies = 5; // We're requesting 5 body sections

          msg.on('body', async (stream, info) => {
            bodyCount++;
            const bodyLabel = `[${seqno}] Body ${bodyCount}/${expectedBodies}: ${info.which || 'unknown'}`;

            process.stdout.write(`   📄 ${bodyLabel} (${info.size || '?'} bytes)...`);

            try {
              const buffer = await collectStream(stream);
              currentMessage.bodies[info.which] = {
                size: buffer.length,
                content: buffer
              };

              // Parse full message if this is the complete RFC822 message
              if (info.which === '') {
                try {
                  currentMessage.parsedMessage = await simpleParser(buffer);
                  process.stdout.write(' ✓ (parsed)');
                } catch (parseErr) {
                  process.stdout.write(' ⚠️ (parse failed)');
                }
              }

              process.stdout.write(' ✓\n');
              bodiesProcessed++;

              // Check if all bodies are processed
              if (bodiesProcessed === expectedBodies) {
                console.log(`   ✅ All bodies collected for message #${seqno}\n`);
              }
            } catch (streamErr) {
              process.stdout.write(` ❌ Error: ${streamErr.message}\n`);
              bodiesProcessed++;
            }
          });

          msg.on('attributes', (attrs) => {
            currentMessage.attributes = attrs;
            console.log(`   📋 Attributes received for message #${seqno}`);
          });

          msg.once('end', () => {
            currentMessage.processingComplete = true;
            console.log(`   ✅ Message #${seqno} complete\n`);
          });
        });

        fetch.once('error', (err) => {
          console.error('Fetch error:', err);
          reject(err);
        });

        fetch.once('end', () => {
          console.log('═'.repeat(70));
          console.log(`✅ Fetch complete: ${messages.size} messages retrieved\n`);
          imap.end();
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err);
      reject(err);
    });

    imap.once('end', () => {
      console.log('📪 Connection closed\n');
      resolve(messages);
    });

    imap.connect();
  });
}

/**
 * Save messages to files
 */
async function saveMessages(messages) {
  console.log('💾 Saving messages...\n');

  // Create output directory
  const outputDir = 'imap-recent-5-messages';
  await fs.mkdir(outputDir, { recursive: true });

  // Convert Map to array and sort by sequence number
  const messageArray = Array.from(messages.values()).sort((a, b) => a.seqno - b.seqno);

  // Save individual message files
  for (const msg of messageArray) {
    const msgDir = path.join(outputDir, `message-${msg.seqno}`);
    await fs.mkdir(msgDir, { recursive: true });

    // Save each body section
    for (const [section, body] of Object.entries(msg.bodies)) {
      let filename;
      switch(section) {
        case '':
          filename = '0-complete.eml';
          break;
        case 'HEADER':
          filename = '1-headers.txt';
          break;
        case 'TEXT':
          filename = '2-body-with-mime.txt';
          break;
        case '1':
          filename = '3-part1-text-plain.txt';
          break;
        case '2':
          filename = '4-part2-text-html.html';
          break;
        default:
          filename = `${section}.txt`;
      }

      await fs.writeFile(
        path.join(msgDir, filename),
        body.content
      );
    }

    // Save parsed message data
    if (msg.parsedMessage) {
      const summary = {
        seqno: msg.seqno,
        subject: msg.parsedMessage.subject,
        from: msg.parsedMessage.from?.text,
        to: msg.parsedMessage.to?.text || msg.parsedMessage.to?.map(t => t.text),
        date: msg.parsedMessage.date,
        messageId: msg.parsedMessage.messageId,
        hasText: !!msg.parsedMessage.text,
        hasHtml: !!msg.parsedMessage.html,
        textLength: msg.parsedMessage.text?.length || 0,
        htmlLength: msg.parsedMessage.html?.length || 0,
        attachments: msg.parsedMessage.attachments?.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size
        })) || []
      };

      await fs.writeFile(
        path.join(msgDir, 'message-summary.json'),
        JSON.stringify(summary, null, 2)
      );
    }

    // Save attributes
    if (msg.attributes) {
      await fs.writeFile(
        path.join(msgDir, 'attributes.json'),
        JSON.stringify(msg.attributes, null, 2)
      );
    }

    console.log(`   ✓ Message #${msg.seqno} saved to ${msgDir}`);
  }

  // Save overall summary
  const overallSummary = {
    timestamp: new Date().toISOString(),
    totalMessages: messageArray.length,
    messages: messageArray.map(msg => ({
      seqno: msg.seqno,
      subject: msg.parsedMessage?.subject || msg.attributes?.envelope?.subject,
      from: msg.parsedMessage?.from?.text ||
            (msg.attributes?.envelope?.from?.[0] &&
             `${msg.attributes.envelope.from[0].mailbox}@${msg.attributes.envelope.from[0].host}`),
      date: msg.parsedMessage?.date || msg.attributes?.date,
      uid: msg.attributes?.uid,
      flags: msg.attributes?.flags,
      bodySections: Object.keys(msg.bodies).map(section => ({
        section,
        size: msg.bodies[section].size
      }))
    }))
  };

  await fs.writeFile(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(overallSummary, null, 2)
  );

  console.log(`\n✅ All messages saved to ./${outputDir}/`);
  console.log(`   - Individual message folders with all body sections`);
  console.log(`   - summary.json with overview of all messages\n`);

  return outputDir;
}

/**
 * Display summary
 */
function displaySummary(messages) {
  console.log('═'.repeat(70));
  console.log('SUMMARY OF FETCHED MESSAGES');
  console.log('═'.repeat(70) + '\n');

  const messageArray = Array.from(messages.values()).sort((a, b) => a.seqno - b.seqno);

  messageArray.forEach((msg, index) => {
    const envelope = msg.attributes?.envelope;
    const parsed = msg.parsedMessage;

    console.log(`${index + 1}. Message #${msg.seqno}`);
    console.log(`   Subject: ${parsed?.subject || envelope?.subject || 'No subject'}`);
    console.log(`   From: ${parsed?.from?.text ||
                          (envelope?.from?.[0] &&
                           `${envelope.from[0].name || ''} <${envelope.from[0].mailbox}@${envelope.from[0].host}>`
                          ) || 'Unknown'}`);
    console.log(`   Date: ${parsed?.date || envelope?.date || 'Unknown'}`);
    console.log(`   Body sections saved: ${Object.keys(msg.bodies).length}`);

    // Show sizes
    const sizes = Object.entries(msg.bodies).map(([section, body]) =>
      `${section || '(complete)'}:${Math.round(body.size/1024)}KB`
    ).join(', ');
    console.log(`   Sizes: ${sizes}`);
    console.log();
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           FETCH 5 MOST RECENT MESSAGES                        ║');
  console.log('║                                                                ║');
  console.log('║  Fetches complete body content for the 5 most recent emails   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Fetch messages
    const messages = await fetchRecent5Messages();

    // Display summary
    displaySummary(messages);

    // Save to files
    const outputDir = await saveMessages(messages);

    console.log('═'.repeat(70));
    console.log('✅ SUCCESS!');
    console.log('═'.repeat(70));
    console.log(`\nThe 5 most recent messages have been saved to:`);
    console.log(`📁 ./${outputDir}/`);
    console.log(`\nEach message folder contains:`);
    console.log(`  • 0-complete.eml - Full RFC822 message`);
    console.log(`  • 1-headers.txt - Email headers`);
    console.log(`  • 2-body-with-mime.txt - Body with MIME boundaries`);
    console.log(`  • 3-part1-text-plain.txt - Plain text version`);
    console.log(`  • 4-part2-text-html.html - HTML version`);
    console.log(`  • message-summary.json - Parsed message info`);
    console.log(`  • attributes.json - IMAP attributes\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}