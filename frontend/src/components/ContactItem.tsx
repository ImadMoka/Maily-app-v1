// 🔮 INDIVIDUAL CONTACT COMPONENT: Observes a single contact for updates
// This ensures that updates to individual contacts trigger re-renders
// Following the same pattern as TodoItem in your todo app

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Contact } from '../database/models/Contact'
import { colors } from '../constants'

// 🔮 REACTIVE CONTACT ITEM: Observes individual contact for automatic updates
const ContactItem = withObservables(['contact'], ({ contact }) => ({
  contact: contact.observe(), // 🔔 Observe individual contact for updates
}))(({ contact, onEdit, onDelete }: { 
  contact: Contact, 
  onEdit: (contact: Contact) => void, 
  onDelete: (contact: Contact) => void 
}) => {

  // Get initials for avatar display (like your todo app's checkbox)
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
    <View style={styles.contact}>
      {/* 👤 AVATAR: Shows initials like todo checkbox */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials()}</Text>
      </View>

      {/* 📝 CONTACT INFO: Tap anywhere to edit */}
      <TouchableOpacity style={styles.contactContent} onPress={() => onEdit(contact)}>
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.email}>{contact.email}</Text>
      </TouchableOpacity>

      {/* 🗑️ DELETE BUTTON: Remove this contact */}
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
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.7,
  },
  delete: {
    fontSize: 18,
    color: '#ff4444',
    padding: 8,
    fontWeight: 'bold',
  },
})

export default ContactItem