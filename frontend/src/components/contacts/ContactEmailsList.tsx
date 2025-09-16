import React from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { database } from '../../database'
import { Contact } from '../../database/models/Contact'
import { Email } from '../../database/models/Email'
import { markEmailAsRead } from '../../services/EmailReadingService'
import { colors } from '../../constants'

// Observable email item component that watches individual email changes
const EmailItem = withObservables(['email'], ({ email }) => ({
  email: email.observe(),
}))(({ email }: { email: Email }) => {
  const handleEmailTap = async () => {
    if (!email.isRead) {
      console.log('📧 Marking email as read:', email.subject)
      await markEmailAsRead(email)
      console.log('✅ Email marked as read, new status:', email.isRead)
    } else {
      console.log('📖 Email already read:', email.subject)
    }
    // Future: Could navigate to email detail view here
  }

  const sender = email.fromName || email.fromAddress
  const date = email.dateSent.toLocaleDateString()
  
  return (
    <TouchableOpacity 
      style={styles.emailItem} 
      onPress={handleEmailTap}
    >
      <View style={styles.emailHeader}>
        <Text style={[styles.sender, !email.isRead && styles.unread]}>
          {sender}
        </Text>
        <Text style={styles.date}>{date}</Text>
        {!email.isRead && <View style={styles.unreadDot} />}
      </View>
      <Text style={[styles.subject, !email.isRead && styles.unread]} numberOfLines={1}>
        {email.subject || 'No Subject'}
      </Text>
    </TouchableOpacity>
  )
})

const ContactEmailsList = withObservables(['contactId'], ({ contactId }) => ({
  contact: database.collections.get<Contact>('contacts').findAndObserve(contactId),
  emails: database.collections.get<Email>('emails')
    .query(Q.where('contact_id', contactId), Q.sortBy('date_sent', Q.desc))
    .observe()
}))(({ contact, emails, contactId }: { 
  contact: Contact | null
  emails: Email[]
  contactId: string
}) => {
  if (!contact) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    )
  }

  if (emails.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No emails from {contact.name}</Text>
      </View>
    )
  }

  const renderEmail = ({ item: email }: { item: Email }) => {
    return <EmailItem email={email} />
  }

  return (
    <FlatList
      data={emails}
      keyExtractor={(item) => item.id}
      renderItem={renderEmail}
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
  emailItem: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sender: {
    fontSize: 14,
    color: colors.primary,
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: colors.primary,
    opacity: 0.6,
  },
  subject: {
    fontSize: 16,
    color: colors.primary,
  },
  unread: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginLeft: 8,
  },
})

export default ContactEmailsList