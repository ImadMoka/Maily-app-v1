const Imap = require('node-imap');

// Replace these with your actual credentials
const imapConfig = {
  user: 'imadmokatest@gmail.com',
  password: 'dlwqtdbzlbmhwgai',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  authTimeout: 10000,
  connTimeout: 10000,
  tlsOptions: {
    rejectUnauthorized: false,
    servername: 'imap.gmail.com'
  }
};

const imap = new Imap(imapConfig);

const startTime = Date.now();

imap.once('ready', function() {
  const connectTime = Date.now() - startTime;
  console.log(`IMAP connection ready - took ${connectTime}ms`);
  
  // Close connection immediately
  imap.end();
});

imap.once('error', function(err) {
  const errorTime = Date.now() - startTime;
  console.error(`IMAP error after ${errorTime}ms:`, err);
});

imap.once('end', function() {
  const totalTime = Date.now() - startTime;
  console.log(`IMAP connection ended - total time: ${totalTime}ms`);
});

// Connect to IMAP server
console.log('Connecting to IMAP server...');
imap.connect();