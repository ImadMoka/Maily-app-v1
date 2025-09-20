import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../../src/constants';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../src/database';
import { Email } from '../../../src/database/models/Email';
import { Thread } from '../../../src/database/models/Thread';
import { Contact } from '../../../src/database/models/Contact';
import EmailChatItem from '../../../src/components/emails/EmailChatItem';


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
    return <EmailChatItem email={email} />;
  };

  return (
    <FlatList
      data={emails}
      keyExtractor={(item) => item.id}
      renderItem={renderEmail}
      contentContainerStyle={styles.list}
    />
  );
});

const ThreadHeader = withObservables(['threadId'], ({ threadId }) => ({
  thread: database.collections.get<Thread>('threads').findAndObserve(threadId),
}))(({ thread }: { thread: Thread | null }) => {
  const [contact, setContact] = React.useState(null);

  React.useEffect(() => {
    if (thread?.contactId) {
      database.collections.get('contacts').find(thread.contactId).then(setContact);
    }
  }, [thread?.contactId]);

  const displayName = contact ? (contact.name || contact.email) : 'Thread';

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{displayName}</Text>
      <View style={styles.placeholder} />
    </View>
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
      <ThreadHeader threadId={threadId} />

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
    fontSize: 15,
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
    paddingVertical: 8,
  },
});