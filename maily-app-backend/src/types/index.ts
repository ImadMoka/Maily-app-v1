export interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  body: string;
  attachments?: Attachment[];
}

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}