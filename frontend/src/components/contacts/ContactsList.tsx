// 🔮 MAIN REACTIVE CONTACTS COMPONENT: Observes the contacts query for list changes
// withObservables() makes this component automatically re-render when contacts change
// Following the same pattern as TodoApp in your todo app

import React, { useState } from 'react'
import { View, Text, FlatList, StyleSheet, TextInput } from 'react-native'
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
  // 🔍 SEARCH STATE: Remembers what user types in search box
  const [searchTerm, setSearchTerm] = useState('')

  // 🔍 FILTER LOGIC: Filter contacts based on search term
  const filteredContacts = contacts.filter(contact => {
    // If no search term, show all contacts
    if (!searchTerm.trim()) return true

    // Convert search term to lowercase for case-insensitive search
    const search = searchTerm.toLowerCase().trim()

    // Check if name or email contains the search term
    const nameMatches = contact.name.toLowerCase().includes(search)
    const emailMatches = contact.email.toLowerCase().includes(search)

    // Return true if either name or email matches
    return nameMatches || emailMatches
  })

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
      {/* 📊 CONTACTS HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
      </View>

      {/* 📝 ADD/EDIT CONTACT FORM */}
      {(showForm || editingContact) && (
        <ContactForm
          contact={editingContact}
          onSave={editingContact ? updateContact : createContact}
          onCancel={handleCancel}
        />
      )}


      {/* 🔍 SEARCH BAR: Text input for filtering contacts */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={colors.text}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* 📋 CONTACTS LIST: Uses individual ContactItem components for proper reactivity */}
      <FlatList
        data={filteredContacts}              // ⚡ Now shows filtered contacts based on search!
        keyExtractor={(item) => item.id}      // Use database ID as React key
        renderItem={({ item }) => (
          <ContactItem
            contact={item}                    // 🔔 Each item observes itself for updates
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
    backgroundColor: colors.background,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: -0.5,
  },
  listContainer: {
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  searchInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
})

export default ContactsList