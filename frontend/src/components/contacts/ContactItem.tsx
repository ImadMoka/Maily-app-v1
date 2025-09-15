import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Contact } from '../database/models/Contact'
import { markContactAsRead } from '../../services/ContactReadingService'
import { colors } from '../../constants'

// 🔮 REACTIVE CONTACT ITEM: Auto-updates when contact changes via WatermelonDB observables
const ContactItem = withObservables(['contact'], ({ contact }) => ({
  contact: contact.observe(), // 🔔 Observe individual contact for updates
}))(({ contact, onEdit, onDelete }: { 
  contact: Contact, 
  onEdit: (contact: Contact) => void, 
  onDelete: (contact: Contact) => void 
}) => {

  // 📖 HANDLE CONTACT TAP: Mark as read if unread, edit if already read
  const handleContactTap = async () => {
    if (!contact.isRead) {
      await markContactAsRead(contact)
    } else {
      onEdit(contact)
    }
  }

  // Get initials for avatar display
  const getInitials = () => {
    if (contact.name.trim()) {
      const nameParts = contact.name.trim().split(' ')
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      }
      return contact.name[0].toUpperCase()
    }
    return contact.email[0].toUpperCase()
  }

  return (
    <View style={[styles.contact, contact.isRead && { opacity: 0.6 }]}>
      {/* 👤 AVATAR: Shows initials */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials()}</Text>
      </View>

      {/* 📝 CONTACT INFO: Tap to read or edit */}
      <TouchableOpacity style={styles.contactContent} onPress={handleContactTap}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{contact.name}</Text>
          {/* 🟢 UNREAD INDICATOR: Green dot for unread contacts */}
          {!contact.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.email}>{contact.email}</Text>
      </TouchableOpacity>

      {/* 🗑️ DELETE BUTTON */}
      <TouchableOpacity onPress={() => onDelete(contact)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = StyleSheet.create({
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  email: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.7,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginLeft: 8,
  },
  delete: {
    fontSize: 18,
    color: '#ff4444',
    padding: 8,
    fontWeight: 'bold',
  },
})

export default ContactItem