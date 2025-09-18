#!/usr/bin/env bun
/**
 * IMAP Fetch with Complete ParsedMail Object - Fixed Version
 *
 * Properly handles async parsing to return complete mail objects
 * Reference: https://nodemailer.com/extras/mailparser/
 */

import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import fs from 'fs/promises';

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
 * Fetch and parse emails properly
 */
async function fetchAndParseMails(count = 5) {
  const imap = new Imap(imapConfig);

  return new Promise((resolve, reject) => {
    const messagePromises = [];

    imap.once('ready', () => {
      console.log('✅ Connected to IMAP\n');

      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📬 Mailbox: ${box.messages.total} total messages`);

        const total = box.messages.total;
        const start = Math.max(1, total - (count - 1));
        const fetchRange = `${start}:${total}`;

        console.log(`📥 Fetching ${count} most recent messages: ${fetchRange}\n`);

        const fetch = imap.seq.fetch(fetchRange, {
          bodies: '',  // Complete RFC822 message
          struct: true,
          envelope: true,
          flags: true,
          size: true
        });

        let messageCount = 0;

        fetch.on('message', (msg, seqno) => {
          messageCount++;
          console.log(`📧 Message ${messageCount}/${count} (#${seqno})`);

          // Create a promise for this message
          const messagePromise = new Promise((resolveMsg) => {
            let messageBuffer = null;
            let attributes = null;
            const chunks = [];

            msg.on('body', (stream, info) => {
              console.log(`   Receiving ${info.size || '?'} bytes...`);

              stream.on('data', (chunk) => {
                chunks.push(chunk);
              });

              stream.on('end', () => {
                messageBuffer = Buffer.concat(chunks);
                console.log(`   ✓ Collected ${messageBuffer.length} bytes`);
              });

              stream.on('error', (err) => {
                console.log(`   ❌ Stream error: ${err.message}`);
              });
            });

            msg.on('attributes', (attrs) => {
              attributes = attrs;
            });

            msg.once('end', async () => {
              if (messageBuffer) {
                try {
                  // Parse the message
                  const parsed = await simpleParser(messageBuffer);
                  console.log(`   ✓ Parsed: "${parsed.subject || 'No subject'}"`);

                  resolveMsg({
                    seqno,
                    parsedMail: parsed,
                    rawSize: messageBuffer.length,
                    imapAttributes: attributes
                  });
                } catch (err) {
                  console.log(`   ❌ Parse error: ${err.message}`);
                  resolveMsg(null);
                }
              } else {
                resolveMsg(null);
              }
            });
          });

          messagePromises.push(messagePromise);
        });

        fetch.once('error', (err) => {
          console.error('Fetch error:', err);
          reject(err);
        });

        fetch.once('end', async () => {
          console.log('\n⏳ Waiting for all messages to parse...\n');

          // Wait for all messages to be parsed
          const results = await Promise.all(messagePromises);
          const parsedMails = results.filter(m => m !== null);

          console.log(`✅ Successfully parsed ${parsedMails.length}/${count} messages\n`);

          imap.end();
          resolve(parsedMails);
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err);
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Display ParsedMail objects
 */
function displayParsedMails(mails) {
  console.log('═'.repeat(80));
  console.log('COMPLETE PARSEDMAIL OBJECTS');
  console.log('═'.repeat(80) + '\n');

  mails.forEach((mail, index) => {
    const p = mail.parsedMail;

    console.log(`📧 Message ${index + 1} - #${mail.seqno}`);
    console.log('-'.repeat(60));

    // Basic info
    console.log(`Subject: ${p.subject || 'No subject'}`);
    console.log(`From: ${p.from?.text || 'Unknown'}`);
    console.log(`To: ${p.to?.text || (Array.isArray(p.to) ? p.to.map(t => t.text).join(', ') : 'Unknown')}`);
    console.log(`Date: ${p.date || 'Unknown'}`);
    console.log(`Message-ID: ${p.messageId || 'None'}`);

    // Content
    console.log(`\nContent:`);
    console.log(`  • Text: ${p.text ? `${p.text.length} chars (clean, decoded!)` : 'None'}`);
    console.log(`  • HTML: ${p.html ? `${p.html.length} chars` : 'None'}`);
    console.log(`  • Text as HTML: ${p.textAsHtml ? 'Available' : 'None'}`);

    // Show clean text preview
    if (p.text) {
      console.log('\n📄 Clean Text Preview (NO encoding like =C3=A4):');
      console.log('  ' + '─'.repeat(56));
      const lines = p.text.substring(0, 300).split('\n');
      lines.slice(0, 5).forEach(line => {
        console.log('  ' + line.substring(0, 70) + (line.length > 70 ? '...' : ''));
      });
      if (p.text.length > 300) {
        console.log(`  ... (${p.text.length - 300} more chars)`);
      }
      console.log('  ' + '─'.repeat(56));
    }

    // Attachments
    if (p.attachments && p.attachments.length > 0) {
      console.log(`\n📎 Attachments: ${p.attachments.length}`);
      p.attachments.forEach((att, i) => {
        console.log(`  [${i + 1}] ${att.filename || 'unnamed'} (${att.contentType}, ${att.size} bytes)`);
      });
    }

    // Headers
    console.log(`\n📋 Headers: ${p.headers ? `Map with ${p.headers.size} entries` : 'None'}`);
    if (p.headers && p.headers.size > 0) {
      const importantHeaders = ['content-type', 'mime-version', 'dkim-signature'];
      importantHeaders.forEach(h => {
        if (p.headers.has(h)) {
          const value = p.headers.get(h);
          console.log(`  • ${h}: ${String(value).substring(0, 60)}...`);
        }
      });
    }

    // All available properties
    console.log(`\n🔑 All ParsedMail properties:`);
    const allKeys = Object.keys(p);
    console.log(`  ${allKeys.join(', ')}`);

    console.log('\n' + '═'.repeat(80) + '\n');
  });
}

/**
 * Save ParsedMail objects
 */
async function saveParsedMails(mails) {
  const outputDir = 'imap-complete-parsed';
  await fs.mkdir(outputDir, { recursive: true });

  for (let i = 0; i < mails.length; i++) {
    const mail = mails[i];
    const filename = `message-${mail.seqno}-parsed.json`;

    // Convert to serializable format
    const serializable = {
      seqno: mail.seqno,
      rawSize: mail.rawSize,
      imapAttributes: mail.imapAttributes,
      parsedMail: {
        // Headers (convert Map to object)
        headers: mail.parsedMail.headers ? Object.fromEntries(mail.parsedMail.headers) : null,
        headerLines: mail.parsedMail.headerLines,

        // Addresses
        from: mail.parsedMail.from,
        to: mail.parsedMail.to,
        cc: mail.parsedMail.cc,
        bcc: mail.parsedMail.bcc,
        replyTo: mail.parsedMail.replyTo,

        // Message info
        subject: mail.parsedMail.subject,
        messageId: mail.parsedMail.messageId,
        inReplyTo: mail.parsedMail.inReplyTo,
        references: mail.parsedMail.references,
        date: mail.parsedMail.date,

        // Content (FULL, not truncated!)
        text: mail.parsedMail.text,
        textAsHtml: mail.parsedMail.textAsHtml,
        html: mail.parsedMail.html,

        // Attachments
        attachments: mail.parsedMail.attachments?.map(att => ({
          type: att.type,
          content: '(binary data excluded)',
          contentType: att.contentType,
          contentDisposition: att.contentDisposition,
          filename: att.filename,
          contentId: att.contentId,
          cid: att.cid,
          related: att.related,
          size: att.size,
          headers: att.headers ? Object.fromEntries(att.headers) : null
        })),

        // Other properties
        priority: mail.parsedMail.priority
      }
    };

    await fs.writeFile(
      `${outputDir}/${filename}`,
      JSON.stringify(serializable, null, 2)
    );

    console.log(`💾 Saved ${filename}`);
  }

  console.log(`\n✅ All ParsedMail objects saved to ./${outputDir}/\n`);
}

/**
 * Main
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        COMPLETE PARSEDMAIL OBJECTS WITH simpleParser          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    const mails = await fetchAndParseMails(5);

    displayParsedMails(mails);
    await saveParsedMails(mails);

    console.log('📚 The ParsedMail object contains:');
    console.log('  • All headers as a Map');
    console.log('  • Decoded text (no =C3=A4 encoding!)');
    console.log('  • Clean HTML');
    console.log('  • Parsed attachments');
    console.log('  • All addresses parsed into objects\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}