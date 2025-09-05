import Imap from 'node-imap';

export interface EmailEnvelope {
  uid: number
  subject?: string
  from?: string
  date?: string
  size?: number
}

export interface EmailResult {
  success: boolean
  emails?: EmailEnvelope[]
  error?: string
}

export class SimpleEmailService {
  async fetchEmails(email: string, password: string, count: number = 100): Promise<EmailResult> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: email,
        password: password,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 30000
      });

      const emails: EmailEnvelope[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            imap.end();
            resolve({ success: false, error: 'Cannot open inbox' });
            return;
          }

          imap.search(['ALL'], (err, results) => {
            if (err || results.length === 0) {
              imap.end();
              resolve({ success: false, error: 'Cannot search emails' });
              return;
            }

            const targetEmails = results.slice(-count);
            const fetch = imap.fetch(targetEmails, { bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', struct: true });

            fetch.on('message', (msg, seqno) => {
              const email: EmailEnvelope = { uid: seqno };

              msg.on('body', (stream) => {
                let buffer = '';
                stream.on('data', (chunk) => buffer += chunk.toString());
                stream.on('end', () => {
                  const lines = buffer.split('\r\n');
                  lines.forEach(line => {
                    const [header, ...valueParts] = line.split(':');
                    const value = valueParts.join(':').trim();
                    if (header.toLowerCase() === 'subject') email.subject = value;
                    if (header.toLowerCase() === 'from') email.from = value;
                    if (header.toLowerCase() === 'date') email.date = value;
                  });
                });
              });

              msg.once('attributes', (attrs) => {
                email.uid = attrs.uid;
                email.size = attrs.size;
              });

              msg.once('end', () => emails.push(email));
            });

            fetch.once('end', () => {
              imap.end();
              resolve({ success: true, emails });
            });

            fetch.once('error', () => {
              imap.end();
              resolve({ success: false, error: 'Failed to fetch emails' });
            });
          });
        });
      });

      imap.once('error', () => {
        resolve({ success: false, error: 'Connection failed' });
      });

      imap.connect();
    });
  }
}