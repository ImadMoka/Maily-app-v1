#!/usr/bin/env bun
/**
 * IMAP Fetch with Complete ParsedMail Object
 *
 * Uses simpleParser to return the entire mail object
 * so you can examine all parts yourself
 *
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
 * Fetch recent messages and parse them completely
 */
async function fetchAndParseEmails(count = 5) {
  const imap = new Imap(imapConfig);

  return new Promise((resolve, reject) => {
    const parsedMails = [];

    imap.once('ready', () => {
      console.log('✅ Connected to IMAP\n');

      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📬 Mailbox: ${box.messages.total} total messages`);

        // Calculate range
        const total = box.messages.total;
        const start = Math.max(1, total - (count - 1));
        const fetchRange = `${start}:${total}`;

        console.log(`📥 Fetching ${count} most recent messages: ${fetchRange}\n`);

        // Fetch only complete messages
        const fetch = imap.seq.fetch(fetchRange, {
          bodies: '',  // Get complete RFC822 message
          struct: true,
          envelope: true
        });

        let messageCount = 0;

        fetch.on('message', (msg, seqno) => {
          messageCount++;
          console.log(`Processing message ${messageCount}/${count} (#${seqno})...`);

          let messageBuffer = null;
          let attributes = null;
          let parsePromise = null;

          msg.on('body', async (stream, info) => {
            try {
              // Collect the complete message
              messageBuffer = await collectStream(stream);
              console.log(`  ✓ Collected: ${messageBuffer.length} bytes`);

              // Start parsing (but don't await here)
              parsePromise = simpleParser(messageBuffer).then(parsed => {
                console.log(`  ✓ Parsed: ${parsed.subject || 'No subject'}`);
                return {
                  seqno,
                  parsedMail: parsed,
                  rawSize: messageBuffer.length
                };
              }).catch(err => {
                console.log(`  ❌ Parse error: ${err.message}`);
                return null;
              });
            } catch (err) {
              console.log(`  ❌ Stream error: ${err.message}`);
            }
          });

          msg.on('attributes', (attrs) => {
            attributes = attrs;
          });

          msg.once('end', async () => {
            // Wait for parsing to complete
            if (parsePromise) {
              const completeMessage = await parsePromise;
              if (completeMessage) {
                completeMessage.imapAttributes = attributes;
                parsedMails.push(completeMessage);
                console.log(`  ✓ Added message #${seqno} to collection`);
              }
            }
          });
        });

        fetch.once('error', reject);

        fetch.once('end', () => {
          // Wait a moment for all parsing to complete
          setTimeout(() => {
            console.log(`\n✅ Fetched ${parsedMails.length} messages\n`);
            imap.end();
          }, 2000);
        });
      });
    });

    imap.once('error', reject);

    imap.once('end', () => {
      console.log('📪 Connection closed\n');
      resolve(parsedMails);
    });

    imap.connect();
  });
}

/**
 * Display the structure of ParsedMail objects
 */
function displayParsedMailStructure(mails) {
  console.log('═'.repeat(80));
  console.log('PARSEDMAIL OBJECT STRUCTURE');
  console.log('═'.repeat(80) + '\n');

  mails.forEach((mail, index) => {
    const parsed = mail.parsedMail;

    console.log(`Message ${index + 1} - Sequence #${mail.seqno}`);
    console.log('-'.repeat(40));

    console.log('\n📋 ParsedMail Object Properties:');
    console.log(`  • headers: ${parsed.headers ? 'Map object with all headers' : 'Not present'}`);
    console.log(`  • subject: "${parsed.subject || 'None'}"`);
    console.log(`  • from: ${parsed.from ? `${parsed.from.text}` : 'None'}`);
    console.log(`  • to: ${parsed.to ? (Array.isArray(parsed.to) ? `${parsed.to.length} recipients` : parsed.to.text) : 'None'}`);
    console.log(`  • date: ${parsed.date || 'None'}`);
    console.log(`  • messageId: ${parsed.messageId || 'None'}`);
    console.log(`  • inReplyTo: ${parsed.inReplyTo || 'None'}`);
    console.log(`  • references: ${parsed.references ? (Array.isArray(parsed.references) ? `${parsed.references.length} references` : parsed.references) : 'None'}`);

    console.log(`\n  • text: ${parsed.text ? `${parsed.text.length} chars (decoded plain text)` : 'None'}`);
    console.log(`  • textAsHtml: ${parsed.textAsHtml ? `${parsed.textAsHtml.length} chars` : 'None'}`);
    console.log(`  • html: ${parsed.html ? `${parsed.html.length} chars (decoded HTML)` : 'None'}`);

    console.log(`\n  • attachments: ${parsed.attachments ? `${parsed.attachments.length} attachments` : 'None'}`);
    if (parsed.attachments && parsed.attachments.length > 0) {
      parsed.attachments.forEach((att, i) => {
        console.log(`    [${i}]: ${att.filename || 'unnamed'} (${att.contentType}, ${att.size} bytes)`);
      });
    }

    // Show text preview (clean, no encoding!)
    if (parsed.text) {
      console.log('\n  📄 Text Preview (first 200 chars - CLEAN, no =C3=A4 encoding!):');
      console.log('  ' + '-'.repeat(60));
      const preview = parsed.text.substring(0, 200).replace(/\n/g, '\n  ');
      console.log('  ' + preview);
      console.log('  ' + '-'.repeat(60));
    }

    console.log('\n  🔍 Additional Properties:');
    const allKeys = Object.keys(parsed);
    const otherKeys = allKeys.filter(k => !['headers', 'subject', 'from', 'to', 'date', 'messageId',
                                           'text', 'textAsHtml', 'html', 'attachments', 'inReplyTo', 'references'].includes(k));
    if (otherKeys.length > 0) {
      console.log(`     ${otherKeys.join(', ')}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  });
}

/**
 * Save complete ParsedMail objects
 */
async function saveParsedMails(mails) {
  const outputDir = 'imap-parsed-mails';
  await fs.mkdir(outputDir, { recursive: true });

  // Save individual parsed mail objects
  for (const mail of mails) {
    const filename = `parsed-mail-${mail.seqno}.json`;

    // Convert the parsed mail to a serializable format
    const serializable = {
      seqno: mail.seqno,
      rawSize: mail.rawSize,
      parsedMail: {
        // Headers (Map needs to be converted)
        headers: mail.parsedMail.headers ? Object.fromEntries(mail.parsedMail.headers) : null,

        // Standard fields
        subject: mail.parsedMail.subject,
        from: mail.parsedMail.from,
        to: mail.parsedMail.to,
        cc: mail.parsedMail.cc,
        bcc: mail.parsedMail.bcc,
        date: mail.parsedMail.date,
        messageId: mail.parsedMail.messageId,
        inReplyTo: mail.parsedMail.inReplyTo,
        references: mail.parsedMail.references,

        // Content (full content, not truncated!)
        text: mail.parsedMail.text,
        textAsHtml: mail.parsedMail.textAsHtml,
        html: mail.parsedMail.html,

        // Attachments (without actual content to save space)
        attachments: mail.parsedMail.attachments?.map(att => ({
          filename: att.filename,
          contentType: att.contentType,
          contentDisposition: att.contentDisposition,
          contentId: att.contentId,
          size: att.size,
          headers: att.headers ? Object.fromEntries(att.headers) : null
        })),

        // Other properties
        priority: mail.parsedMail.priority,
        replyTo: mail.parsedMail.replyTo,
        headerLines: mail.parsedMail.headerLines
      },
      imapAttributes: mail.imapAttributes
    };

    await fs.writeFile(
      `${outputDir}/${filename}`,
      JSON.stringify(serializable, null, 2)
    );

    console.log(`💾 Saved ${filename}`);
  }

  // Save a summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalMessages: mails.length,
    messages: mails.map(mail => ({
      seqno: mail.seqno,
      subject: mail.parsedMail.subject,
      from: mail.parsedMail.from?.text,
      date: mail.parsedMail.date,
      hasText: !!mail.parsedMail.text,
      hasHtml: !!mail.parsedMail.html,
      textLength: mail.parsedMail.text?.length || 0,
      htmlLength: mail.parsedMail.html?.length || 0,
      attachmentCount: mail.parsedMail.attachments?.length || 0
    }))
  };

  await fs.writeFile(
    `${outputDir}/summary.json`,
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n✅ All ParsedMail objects saved to ./${outputDir}/\n`);

  return outputDir;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              FETCH COMPLETE PARSEDMAIL OBJECTS                ║');
  console.log('║                                                                ║');
  console.log('║  Using simpleParser to get the complete mail object           ║');
  console.log('║  with all parts decoded and structured                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Fetch and parse emails
    const mails = await fetchAndParseEmails(5);

    // Display the structure
    displayParsedMailStructure(mails);

    // Save to files
    await saveParsedMails(mails);

    console.log('📚 ParsedMail Object Documentation:');
    console.log('   https://nodemailer.com/extras/mailparser/\n');

    console.log('Key benefits of using simpleParser:');
    console.log('  ✓ Automatically decodes quoted-printable (=C3=A4 → ä)');
    console.log('  ✓ Parses MIME structure');
    console.log('  ✓ Extracts attachments');
    console.log('  ✓ Handles all character encodings');
    console.log('  ✓ Provides clean text and HTML');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}