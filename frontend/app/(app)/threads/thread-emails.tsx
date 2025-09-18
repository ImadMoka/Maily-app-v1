import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../../src/constants';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../src/database';
import { Email } from '../../../src/database/models/Email';
import { Thread } from '../../../src/database/models/Thread';
import { markEmailAsRead } from '../../../src/services/EmailReadingService';

// Observable email item component
const EmailItem = withObservables(['email'], ({ email }) => ({
  email: email.observe(),
}))(({ email }: { email: Email }) => {
  const handleEmailTap = async () => {
    if (!email.isRead) {
      console.log('📧 Marking email as read:', email.subject);
      await markEmailAsRead(email);
    }
  };

  const sender = email.fromName || email.fromAddress;
  const formatDateTime = (date: Date) => {
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <TouchableOpacity
      style={styles.emailItem}
      onPress={handleEmailTap}
    >
      <View style={styles.emailHeader}>
        <View style={styles.emailSender}>
          <Text style={[styles.sender, !email.isRead && styles.unread]}>
            {sender}
          </Text>
          {!email.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.date}>{formatDateTime(email.dateSent)}</Text>
      </View>

      <Text style={styles.bodyPreview} numberOfLines={2}>
        {email.subject || 'No Subject'}
      </Text>
    </TouchableOpacity>
  );
});

// Main component wrapped with observables
const ThreadEmailsContent = withObservables(['threadId'], ({ threadId }) => ({
  thread: database.collections.get<Thread>('threads').findAndObserve(threadId),
  emails: database.collections.get<Email>('emails')
    .query(
      Q.where('thread_id', threadId),
      Q.sortBy('date_sent', Q.asc)
    )
    .observe()
}))(({ thread, emails }: {
  thread: Thread | null;
  emails: Email[];
}) => {
  if (!thread) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (emails.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No emails in this thread</Text>
      </View>
    );
  }

  const renderEmail = ({ item: email }: { item: Email }) => {
    return <EmailItem email={email} />;
  };

  return (
    <>
      <View style={styles.threadInfo}>
        <Text style={styles.threadSubject} numberOfLines={2}>
          {thread.subject || 'No Subject'}
        </Text>
        <Text style={styles.threadMeta}>
          {emails.length} {emails.length === 1 ? 'email' : 'emails'} •
          {thread.unreadCount > 0 ? ` ${thread.unreadCount} unread` : ' All read'}
        </Text>
      </View>

      <FlatList
        data={emails}
        keyExtractor={(item) => item.id}
        renderItem={renderEmail}
        contentContainerStyle={styles.list}
      />
    </>
  );
});

export default function ThreadEmailsScreen() {
  const { threadId, threadSubject } = useLocalSearchParams<{
    threadId: string;
    threadSubject: string;
  }>();

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Thread</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Thread emails list */}
      <ThreadEmailsContent threadId={threadId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.secondary,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 80,
  },
  separator: {
    height: 1,
    backgroundColor: colors.secondary,
    opacity: 0.6,
  },
  threadInfo: {
    backgroundColor: colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
  },
  threadSubject: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  threadMeta: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.6,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.primary,
    opacity: 0.7,
  },
  list: {
    padding: 16,
  },
  emailItem: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  emailSender: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sender: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: colors.primary,
    opacity: 0.6,
  },
  bodyPreview: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.8,
    lineHeight: 20,
  },
  unread: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.notification,
    marginLeft: 8,
  },
});