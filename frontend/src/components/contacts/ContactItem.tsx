import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { router } from 'expo-router'
import { Contact } from '../../database/models/Contact'
import { colors } from '../../constants'

const ContactItem = withObservables(['contact'], ({ contact }) => ({
  contact: contact.observe(),
}))(({ contact, onDelete }: {
  contact: Contact
  onDelete: (contact: Contact) => void
}) => {

  // 🔄 NAVIGATION HANDLER: When user taps on contact row
  // Navigates to contact-emails page showing all emails for this contact
  // Passes contactId and contactName as route parameters
  const handleTap = async () => {
    router.push({
      pathname: '/(app)/contact-threads',
      params: {
        contactId: contact.id,
        contactName: contact.name
      }
    })
  }

  // 🎭 AVATAR INITIALS GENERATOR: Creates 1-2 letter avatar from contact name
  // Examples: "John Doe" → "JD", "Alice" → "A", empty name → first email letter
  const getInitials = () => {
    const name = contact.name.trim()
    if (name) {
      const parts = name.split(' ')
      return parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : name[0].toUpperCase()
    }
    return contact.email[0].toUpperCase()
  }

  // ⏰ TIMESTAMP FORMATTER: Shows when last email was sent/received
  // Today: "2:30 PM", Yesterday: "Yesterday", This year: "Dec 15", Older: "Dec 15, 2023"
  const formatTime = (date: Date) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } else if (messageDate.getTime() === today.getTime() - 24 * 60 * 60 * 1000) {
      return 'Yesterday'
    } else if (messageDate.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
  }

  // 🎨 UI COMPONENT: WhatsApp-style contact row layout
  return (
    <TouchableOpacity style={styles.contact} onPress={handleTap}>
      {/* 🎭 AVATAR CIRCLE: Shows contact initials on colored background */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials()}</Text>
      </View>

      {/* 📝 CONTACT INFO: Name, email, timestamp and unread status */}
      <View style={styles.contactContent}>
        {/* 📊 TOP ROW: Contact name + timestamp */}
        <View style={styles.nameRow}>
          <Text style={[styles.name, !contact.isRead && styles.unread]}>
            {contact.name}
          </Text>
          {contact.lastEmailAt && (
            <Text style={styles.timestamp}>
              {formatTime(contact.lastEmailAt)}
            </Text>
          )}
        </View>
        {/* 📧 BOTTOM ROW: Email address + unread indicator */}
        <View style={styles.secondRow}>
          <Text style={styles.email}>{contact.email}</Text>
          {!contact.isRead && <View style={styles.unreadDot} />}
        </View>
      </View>

      {/* 🗑️ DELETE BUTTON: Red X to remove contact */}
      <TouchableOpacity onPress={() => onDelete(contact)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
})

// 🎨 STYLES: WhatsApp-inspired design with clean rows and subtle borders
const styles = StyleSheet.create({
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  contactContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  email: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginLeft: 10,
  },
  delete: {
    fontSize: 16,
    color: '#FF3B30',
    padding: 8,
    fontWeight: '400',
  },
  unread: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  secondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '400',
  },
})

export default ContactItem