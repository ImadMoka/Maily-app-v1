// 🔮 MAIN REACTIVE CONTACTS COMPONENT: Observes the contacts query for list changes
// withObservables() makes this component automatically re-render when contacts change
// Following the same pattern as TodoApp in your todo app

import React, { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native'
import { Q } from '@nozbe/watermelondb'
import { withObservables } from '@nozbe/watermelondb/react'
import { database } from '../../database' // Updated path since we're now in contacts/ subfolder
import { Contact } from '../../database/models/Contact' // Updated path since we're now in contacts/ subfolder
import ContactItem from './ContactItem'
import ContactForm from './ContactForm'
import { colors } from '../../constants' // Updated path since we're now in contacts/ subfolder

// 🔮 MAIN REACTIVE COMPONENT: Observes the contacts query for list changes
const ContactsList = withObservables(['userId'], ({ userId }) => ({
  // 📊 REACTIVE QUERY: This observable detects contacts being added or removed
  // Individual contact updates are handled by the ContactItem components
  contacts: database.collections
    .get<Contact>('contacts')                    // Get contacts collection
    .query(
      Q.where('user_id', userId),               // Filter by current user
      Q.sortBy('created_at', Q.desc)            // Sort by creation date (newest first)
    )
    .observe()                                  // 🔔 Make it observable for list changes!
}))(({ contacts, userId }: { contacts: Contact[], userId: string }) => {
  // 📝 LOCAL STATE: For form visibility and editing
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  // ➕ CREATE OPERATION: Add new contact to local database
  const createContact = async (contactData: { name: string; email: string }) => {
    // 🔒 DATABASE WRITE: All changes must be wrapped in database.write()
    await database.write(async () => {
      await database.collections.get<Contact>('contacts').create(contact => {
        contact.userId = userId         // Link to current user
        contact.name = contactData.name.trim()
        contact.email = contactData.email.trim().toLowerCase()
        // 💡 ID, created_at, and updated_at are automatically set by WatermelonDB!
      })
    })
    setShowForm(false)  // Hide form after creating
    // 🎯 UI UPDATES AUTOMATICALLY! The observable query will detect this change
  }

  // ✏️ EDIT OPERATION: Update existing contact
  const updateContact = async (contactData: { name: string; email: string }) => {
    if (!editingContact) return

    // 🔒 DATABASE WRITE: Wrap modifications in write transaction
    await database.write(async () => {
      await editingContact.update(() => {
        editingContact.name = contactData.name.trim()
        editingContact.email = contactData.email.trim().toLowerCase()
        // 💡 updated_at timestamp is automatically updated!
      })
    })
    setEditingContact(null)  // Clear editing state
    // 🎯 UI UPDATES AUTOMATICALLY! The observable detects the change
  }

  // 🗑️ DELETE OPERATION: Remove contact from local database
  // TODO: Delete functionality is temporarily disabled until implementation is complete
  const deleteContact = (contact: Contact) => {
    // TODO: Implement proper delete functionality
    console.log('Delete functionality coming soon for contact:', contact.name)
    /*
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            // 🔒 DATABASE WRITE: Deletion also requires write transaction
            await database.write(async () => {
              await contact.destroyPermanently()  // Hard delete - completely removes record
            })
            // 🎯 UI UPDATES AUTOMATICALLY! Observable detects deletion
          }
        }
      ]
    )
    */
  }

  // Handle edit button press
  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
  }

  // Cancel form/editing
  const handleCancel = () => {
    setShowForm(false)
    setEditingContact(null)
  }

  // 🎨 UI RENDERING: Notice how we use the reactive `contacts` prop
  return (
    <View style={styles.container}>
      {/* 📊 LIVE COUNTERS: These update automatically as contacts change */}
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <Text style={styles.subtitle}>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* 📝 ADD/EDIT CONTACT FORM */}
      {(showForm || editingContact) && (
        <ContactForm
          contact={editingContact}
          onSave={editingContact ? updateContact : createContact}
          onCancel={handleCancel}
        />
      )}

      {/* ➕ ADD CONTACT BUTTON (when not showing form) */}
      {!showForm && !editingContact && (
        <View style={styles.addButtonContainer}>
          <Text 
            style={styles.addButton} 
            onPress={() => setShowForm(true)}
          >
            + Add Contact
          </Text>
        </View>
      )}

      {/* 📋 CONTACTS LIST: Uses individual ContactItem components for proper reactivity */}
      <FlatList
        data={contacts}                       // ⚡ List changes update automatically!
        keyExtractor={(item) => item.id}      // Use database ID as React key
        renderItem={({ item }) => (
          <ContactItem
            contact={item}                    // 🔔 Each item observes itself for updates
            onEdit={handleEdit}               // Pass edit function
            onDelete={deleteContact}          // Pass delete function
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.primary,
    opacity: 0.7,
  },
  addButtonContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  addButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listContainer: {
    paddingBottom: 20,
  },
})

export default ContactsList