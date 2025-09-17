import React from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { database } from '../../database'
import { Contact } from '../../database/models/Contact'
import { Thread } from '../../database/models/Thread'
import { colors } from '../../constants'
import { router } from 'expo-router'
import { markThreadAsRead, markAllThreadEmailsAsRead } from '../../services/ThreadReadingService'

// Observable thread item component that watches individual thread changes
const ThreadItem = withObservables(['thread'], ({ thread }) => ({
  thread: thread.observe(),
}))(({ thread }: { thread: Thread }) => {
  const handleThreadTap = async () => {
    // Mark all emails and thread as read when tapped
    if (thread.unreadCount > 0 || !thread.isRead) {
      // First mark all emails in the thread as read
      await markAllThreadEmailsAsRead(thread.id)
      // Then update the thread status
      await markThreadAsRead(thread)
    }

    // Navigate to email list for this thread
    router.push({
      pathname: '/(app)/threads/thread-emails',
      params: {
        threadId: thread.id,
        threadSubject: thread.subject || 'Thread'
      }
    })
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const lastEmailDate = formatDate(thread.lastEmailDate)
  const emailCountText = thread.emailCount === 1 ? '1 email' : `${thread.emailCount} emails`

  return (
    <TouchableOpacity
      style={styles.threadItem}
      onPress={handleThreadTap}
    >
      <View style={styles.threadHeader}>
        <Text style={[styles.subject, !thread.isRead && styles.unread]} numberOfLines={1}>
          {thread.subject || 'No Subject'}
        </Text>
        {thread.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{thread.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.threadMeta}>
        <Text style={styles.lastFrom} numberOfLines={1}>
          {thread.lastEmailFrom || 'Unknown'}
        </Text>
        <Text style={styles.metaDivider}>•</Text>
        <Text style={styles.emailCount}>{emailCountText}</Text>
      </View>

      {thread.lastEmailPreview && (
        <Text style={styles.preview} numberOfLines={2}>
          {thread.lastEmailPreview}
        </Text>
      )}

      <View style={styles.threadFooter}>
        <Text style={styles.date}>{lastEmailDate}</Text>
      </View>
    </TouchableOpacity>
  )
})

const ContactThreadsList = withObservables(['contactId'], ({ contactId }) => ({
  contact: database.collections.get<Contact>('contacts').findAndObserve(contactId),
  threads: database.collections.get<Thread>('threads')
    .query(
      Q.where('contact_id', contactId),
      Q.sortBy('last_email_date', Q.desc)
    )
    .observe()
}))(({ contact, threads, contactId }: {
  contact: Contact | null
  threads: Thread[]
  contactId: string
}) => {
  if (!contact) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    )
  }

  if (threads.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No conversations with {contact.name}</Text>
      </View>
    )
  }

  const renderThread = ({ item: thread }: { item: Thread }) => {
    return <ThreadItem thread={thread} />
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(item) => item.id}
      renderItem={renderThread}
      contentContainerStyle={styles.list}
    />
  )
})

const styles = StyleSheet.create({
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
  threadItem: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subject: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
    marginRight: 8,
  },
  unread: {
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#28a745',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  threadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lastFrom: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.8,
    fontWeight: '500',
    maxWidth: '60%',
  },
  metaDivider: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.4,
    marginHorizontal: 6,
  },
  emailCount: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.6,
  },
  preview: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 8,
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  date: {
    fontSize: 12,
    color: colors.primary,
    opacity: 0.6,
  },
})

export default ContactThreadsList