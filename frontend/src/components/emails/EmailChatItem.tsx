// React and React Native imports for component functionality, UI elements, modal, and linking
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';

// WatermelonDB imports for reactive database observables and queries
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

// Database models for Email and EmailBody entities
import { Email } from '../../database/models/Email';
import { EmailBody } from '../../database/models/EmailBody';
import { database } from '../../database';

// App constants for colors and email reading service
import { colors } from '../../constants';
import { markEmailAsRead } from '../../services/EmailReadingService';

// TypeScript interface defining props for EmailChatItem component expecting an Email object
interface EmailChatItemProps {
  email: Email;
}

// Higher-order component that wraps EmailChatItem with reactive database observables for email and emailBody changes
const EmailChatItem = withObservables(['email'], ({ email }) => ({
  email: email.observe(),
  emailBody: database.collections.get<EmailBody>('email_body')
    .query(Q.where('email_id', email.id))
    .observe(),
}))(({ email, emailBody }: { email: Email; emailBody: EmailBody[] }) => {
  // State management for modal visibility and WebView loading status
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function that marks email as read when tapped if it hasn't been read yet
  const handleEmailTap = async () => {
    if (!email.isRead) {
      console.log('📧 Marking email as read:', email.subject);
      await markEmailAsRead(email);
    }
  };

  // Function that opens the email content modal by setting modalVisible to true
  const handleOpenEmail = () => {
    setModalVisible(true);
  };

  // Function that closes the email content modal by setting modalVisible to false
  const handleCloseModal = () => {
    setModalVisible(false);
  };

  // Function that formats a Date object into a short readable format like "Sep 18, 10:06 AM"
  const formatDateTime = (date: Date) => {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function that returns the current user's email address - currently hardcoded placeholder that should be replaced with dynamic user data
  const getUserAccountEmail = () => {
    return 'user@example.com'; // placeholder
  };

  // Function that determines if an email was sent or received by comparing fromAddress with user's email address
  const getEmailDirection = (email: Email): 'sent' | 'received' => {
    const userEmail = getUserAccountEmail();
    return email.fromAddress.toLowerCase() === userEmail.toLowerCase()
      ? 'sent'
      : 'received';
  };

  // Calculate email direction and extract the first email body if available
  const direction = getEmailDirection(email);
  const body = emailBody.length > 0 ? emailBody[0] : null;

  // Function that prepares HTML email content for WebView display by cleaning unwanted template text and wrapping in mobile-optimized HTML structure with optional preview scaling
  const prepareEmailContent = (content: string, isPreview: boolean = false) => {
    // Clean the content first - remove common email template text and whitespace
    let cleanedContent = content
      // Remove "click here to view" type messages
      .replace(/click here to view this .+?(?:web|browser|online)/gi, '')
      .replace(/view (?:this|email) (?:in|on) (?:your )?(?:web )?browser/gi, '')
      .replace(/if you (?:can't|cannot) see this .+?click here/gi, '')
      .replace(/having trouble viewing this email\?/gi, '')
      .replace(/view (?:this )?email (?:in|on) (?:your )?browser/gi, '')
      .replace(/english version below/gi, '')
      // Remove leading/trailing empty paragraphs and divs
      .replace(/^(\s*<(?:p|div)[^>]*>\s*<\/(?:p|div)>\s*)+/gi, '')
      .replace(/(\s*<(?:p|div)[^>]*>\s*<\/(?:p|div)>\s*)+$/gi, '')
      // Remove empty tables at the beginning
      .replace(/^(\s*<table[^>]*>\s*<\/table>\s*)+/gi, '')
      // Remove multiple line breaks and spaces at start
      .replace(/^(\s*<br[^>]*>\s*)+/gi, '')
      .replace(/^(\s*&nbsp;\s*)+/gi, '')
      // Remove leading whitespace
      .replace(/^\s+/gm, '')
      .trim();

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=${isPreview ? '0.25' : '1'}, maximum-scale=${isPreview ? '0.25' : '1'}, user-scalable=no">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #333;
          padding: 16px;
          background-color: #fff;
          word-wrap: break-word;
          overflow-wrap: break-word;
          margin-top: 0 !important;
          padding-top: 16px !important;
        }
        img {
          max-width: 100% !important;
          height: auto !important;
          display: block;
          margin: 10px 0;
        }
        table {
          width: 100% !important;
          border-collapse: collapse;
        }
        td, th {
          padding: 8px;
          text-align: left;
        }
        a {
          color: #007AFF;
          text-decoration: underline;
          cursor: pointer;
        }
        p {
          margin: 10px 0;
        }
        h1, h2, h3, h4, h5, h6 {
          margin: 15px 0 10px 0;
          line-height: 1.3;
        }
        .container {
          max-width: 100%;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${cleanedContent}
      </div>
    </body>
    </html>`;

    return emailHtml;
  };

  // Main component JSX return that renders email chat bubble with blurred preview window and modal for full email content
  return (
    <View style={[
      styles.chatMessage,
      direction === 'sent' ? styles.sentMessage : styles.receivedMessage
    ]}>
      <TouchableOpacity
        style={[
          styles.chatBubble,
          direction === 'sent' ? styles.sentBubble : styles.receivedBubble
        ]}
        onPress={handleEmailTap}
      >
        {body?.body ? (
          <View style={styles.emailPreviewContainer}>
            {/* Email preview window with scaled WebView */}
            <TouchableOpacity
              style={[
                styles.previewContainer,
                direction === 'sent' ? styles.sentPreviewContainer : styles.receivedPreviewContainer
              ]}
              onPress={handleOpenEmail}
              activeOpacity={0.8}
            >
              <WebView
                source={{ html: prepareEmailContent(body.body, true) }}
                style={styles.previewWebView}
                scrollEnabled={false}
                javaScriptEnabled={false}
                pointerEvents="none"
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              />
              {/* Subtle overlay to indicate clickable */}
              <View style={[
                styles.previewOverlay,
                direction === 'sent' ? styles.sentPreviewOverlay : styles.receivedPreviewOverlay
              ]} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emailPreviewContainer}>
            <View style={[
              styles.blurredWindow,
              direction === 'sent' ? styles.sentBlurredWindow : styles.receivedBlurredWindow
            ]}>
              <Text style={[
                styles.minimalistButtonText,
                direction === 'sent' ? styles.sentMinimalistButtonText : styles.receivedMinimalistButtonText
              ]}>
                No content
              </Text>
            </View>
          </View>
        )}
        <Text style={[
          styles.messageTime,
          direction === 'sent' ? styles.sentTime : styles.receivedTime
        ]}>
          {formatDateTime(email.dateSent)}
        </Text>
        {!email.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>

      {/* Email Content Modal */}
      {modalVisible && body?.body && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleCloseModal}
          accessible={true}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Email Content</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* WebView for Email Content */}
              <WebView
                source={{ html: prepareEmailContent(body.body) }}
                originWhitelist={['*']}
                startInLoadingState={true}
                scalesPageToFit={false}
                incognito={true}
                style={styles.webview}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                renderLoading={() => (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading email...</Text>
                  </View>
                )}
                onShouldStartLoadWithRequest={(event) => {
                  // Open URLs in phone's default browser
                  if (event.url && event.url !== 'about:blank' && !event.url.startsWith('data:')) {
                    console.log('Opening URL in browser:', event.url);
                    Linking.openURL(event.url).catch(err => {
                      console.error('Failed to open URL:', err);
                    });
                    return false; // Prevent navigation in WebView
                  }
                  return true; // Allow initial email content load
                }}
                showsVerticalScrollIndicator={true}
                showsHorizontalScrollIndicator={false}
                bounces={true}
                scrollEnabled={true}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
});

// StyleSheet object containing all styling definitions for chat messages, buttons, modal, and WebView elements with direction-based variations for sent/received messages
const styles = StyleSheet.create({
  chatMessage: {
    marginVertical: 4,
    marginHorizontal: 16,
  },

  // Direction-based message alignment
  sentMessage: {
    alignItems: 'flex-end', // Right align for sent messages
  },
  receivedMessage: {
    alignItems: 'flex-start', // Left align for received messages
  },

  // Base bubble styles - larger for photo-like previews
  chatBubble: {
    borderRadius: 18,
    padding: 12,
    maxWidth: '90%',
    minWidth: 250,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Sent bubble (blue, right side)
  sentBubble: {
    backgroundColor: '#007AFF', // iOS blue
    borderBottomRightRadius: 6, // Pointed tail on bottom right
  },

  // Received bubble (gray, left side)
  receivedBubble: {
    backgroundColor: '#F0F0F0', // Slightly darker gray
    borderBottomLeftRadius: 6, // Pointed tail on bottom left
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  // Text styles
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
  },
  sentText: {
    color: colors.white, // White text on blue background
  },
  receivedText: {
    color: '#333333', // Darker text for better readability
  },

  // Time styles
  messageTime: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 4,
    textAlign: 'right',
  },
  sentTime: {
    color: 'rgba(255, 255, 255, 0.8)', // Semi-transparent white
  },
  receivedTime: {
    color: '#666666', // Medium gray
  },

  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30', // iOS red
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },

  // Minimalistic email preview styles
  emailPreviewContainer: {
    flex: 1,
  },

  // Blurred window in the middle - WhatsApp photo size
  blurredWindow: {
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  sentBlurredWindow: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  receivedBlurredWindow: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },

  // Preview container that replaces the blurred window and makes the entire preview area clickable
  previewContainer: {
    height: 200,
    borderRadius: 16,
    marginVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  sentPreviewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  receivedPreviewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },

  // WebView that displays the scaled email preview at 25% size
  previewWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Subtle overlay that indicates the preview is clickable without obscuring content
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    pointerEvents: 'none',
  },
  sentPreviewOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  receivedPreviewOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },

  // Minimalist button in center
  minimalistButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  sentMinimalistButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  receivedMinimalistButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },

  // Minimalist button text
  minimalistButtonText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  sentMinimalistButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  receivedMinimalistButtonText: {
    color: 'rgba(0, 0, 0, 0.7)',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    margin: 20,
    flex: 1,
    maxHeight: '90%',
    width: '90%',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.primary,
    opacity: 0.7,
  },
});

// Export the EmailChatItem component as default export for use in other parts of the application
export default EmailChatItem;