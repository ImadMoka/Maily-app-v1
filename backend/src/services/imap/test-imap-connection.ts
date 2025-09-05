import Imap from 'node-imap';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file explicitly
dotenv.config({ path: path.join(import.meta.dir, '.env') });

async function testImapConnection() {
  const imapConfig = {
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT || '993'),
    user: process.env.IMAP_USER!,
    password: process.env.IMAP_PASSWORD!,
    secure: process.env.IMAP_SECURE === 'true'
  };

  const imap = new Imap({
    user: imapConfig.user,
    password: imapConfig.password,
    host: imapConfig.host,
    port: imapConfig.port,
    tls: imapConfig.secure,
    authTimeout: 30000,
    connTimeout: 30000,
    tlsOptions: {
      rejectUnauthorized: false,
      servername: imapConfig.host
    }
  });

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      console.log('SUCCESS');
      imap.end();
      resolve(true);
    });

    imap.once('error', (err: Error) => {
      console.log('FAILED');
      reject(err);
    });

    imap.connect();
  });
}

testImapConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));