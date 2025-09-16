import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { router } from 'expo-router'
import { Contact } from '../../database/models/Contact'
import { markContactAsRead } from '../../services/ContactReadingService'
import { colors } from '../../constants'

const ContactItem = withObservables(['contact'], ({ contact }) => ({
  contact: contact.observe(),
}))(({ contact, onDelete }: { 
  contact: Contact
  onDelete: (contact: Contact) => void 
}) => {
  const handleTap = async () => {
    if (!contact.isRead) {
      await markContactAsRead(contact)
    }
    
    router.push({
      pathname: '/(app)/contact-emails',
      params: {
        contactId: contact.id,
        contactName: contact.name
      }
    })
  }

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

  return (
    <TouchableOpacity style={styles.contact} onPress={handleTap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials()}</Text>
      </View>

      <View style={styles.contactContent}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, !contact.isRead && styles.unread]}>
            {contact.name}
          </Text>
          {!contact.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.email}>{contact.email}</Text>
      </View>

      <TouchableOpacity onPress={() => onDelete(contact)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
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
  unread: {
    fontWeight: 'bold',
  },
})

export default ContactItem