# IMAP Body Sections Explained

This document explains what each file in this folder contains and how IMAP body sections work.

## Files in this folder:

### 0-complete.eml
**IMAP Section: "" (empty string)**
- **What it contains**: The COMPLETE RFC822 email message
- **Includes**: All headers + all body parts + MIME structure
- **Use case**: When you need the entire original email (for forwarding, archiving, or full parsing)
- **Format**: Standard .eml format that can be opened by email clients
- **Size**: Largest file as it contains everything

### 1-headers.txt
**IMAP Section: "HEADER"**
- **What it contains**: ONLY the email headers
- **Includes**: From, To, Subject, Date, Message-ID, routing information, etc.
- **Does NOT include**: Any message body content
- **Use case**: When you only need metadata (sender, subject, date) without downloading the body
- **Format**: Plain text headers in RFC822 format

### 2-body-with-mime.txt
**IMAP Section: "TEXT"**
- **What it contains**: The message body WITHOUT headers but WITH MIME structure
- **Includes**: MIME boundaries, Content-Type headers for each part, and all body parts
- **Does NOT include**: Main email headers (From, To, Subject, etc.)
- **Use case**: When you need the body structure but already have the headers
- **Format**: MIME multipart message starting with boundary markers

### 3-part1-text-plain.txt
**IMAP Section: "1"**
- **What it contains**: The FIRST MIME part (usually plain text version)
- **Includes**: Just the plain text content, already decoded
- **Does NOT include**: MIME headers or boundaries
- **Use case**: When you want the plain text version for text processing or display
- **Format**: Plain text, usually UTF-8, with quoted-printable encoding markers (=C3=A4 for ä, etc.)

### 4-part2-text-html.html
**IMAP Section: "2"**
- **What it contains**: The SECOND MIME part (usually HTML version)
- **Includes**: HTML formatted email content
- **Does NOT include**: MIME headers or boundaries
- **Use case**: When you want the rich HTML version for display in web browsers
- **Format**: HTML with quoted-printable encoding markers

### attributes.json
**IMAP metadata (not a body section)**
- **What it contains**: IMAP-specific metadata about the message
- **Includes**: UID, flags, envelope info, MIME structure definition
- **Use case**: For managing messages on the IMAP server (marking as read, etc.)

### message-summary.json
**Parsed message data (not a body section)**
- **What it contains**: Extracted and parsed information from the complete message
- **Includes**: Clean subject, from, to, date, message sizes
- **Use case**: Quick access to message information without parsing

## MIME Structure for this message:

```
Complete Message (0-complete.eml)
├── Headers (1-headers.txt)
└── Body (2-body-with-mime.txt)
    ├── Part 1: text/plain (3-part1-text-plain.txt)
    └── Part 2: text/html (4-part2-text-html.html)
```

## Key Concepts:

1. **Body Sections**: Each IMAP fetch request for a different section triggers a separate 'body' event
2. **Section Names**:
   - `""` = entire message
   - `"HEADER"` = headers only
   - `"TEXT"` = body only (with MIME)
   - `"1"`, `"2"`, etc. = specific MIME parts
3. **Encoding**: The `=XX` patterns you see are quoted-printable encoding (e.g., `=C3=A4` = ä)
4. **MIME Boundaries**: Lines like `----==_mimepart_68cad67d276c_44d251568533412` separate different parts

## Why Multiple Versions?

Most modern emails contain both:
- **Plain text version** (Part 1): For text-only email clients
- **HTML version** (Part 2): For rich formatting in modern clients

The email client chooses which version to display based on its capabilities and user preferences.