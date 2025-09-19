// 📝 CONTACT FORM COMPONENT: Add contact form
// Similar to the todo input form but with name and email fields

import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../../constants'

interface ContactFormProps {
  onSave: (contactData: { name: string; email: string }) => void
  onCancel: () => void
}

export default function ContactForm({ onSave, onCancel }: ContactFormProps) {
  // 📝 LOCAL STATE: Form inputs (like newTodo in your todo app)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')


  // ✅ FORM VALIDATION: Simple email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const isFormValid = () => {
    return name.trim().length > 0 && email.trim().length > 0 && isValidEmail(email.trim())
  }

  // 💾 SAVE HANDLER: Create contact
  const handleSave = () => {
    if (!isFormValid()) return

    onSave({
      name: name.trim(),
      email: email.trim()
    })

    // Clear form after saving
    setName('')
    setEmail('')
  }

  // 🎨 UI RENDERING: Form with validation
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Add Contact
      </Text>

      {/* 👤 NAME INPUT */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter contact name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      {/* 📧 EMAIL INPUT */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {email.trim().length > 0 && !isValidEmail(email.trim()) && (
          <Text style={styles.errorText}>Please enter a valid email address</Text>
        )}
      </View>

      {/* 🔘 ACTION BUTTONS */}
      <View style={styles.buttonContainer}>
        {/* ❌ CANCEL BUTTON */}
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {/* ✅ SAVE BUTTON */}
        <TouchableOpacity 
          style={[styles.saveButton, !isFormValid() && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={!isFormValid()}
        >
          <Text style={[styles.saveText, !isFormValid() && styles.saveTextDisabled]}>
            Add
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.secondary,
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  saveTextDisabled: {
    color: colors.primary,
    opacity: 0.7,
  },
})