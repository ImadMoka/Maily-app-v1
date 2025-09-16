import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../src/constants';
import ContactEmailsList from '../../src/components/contacts/ContactEmailsList';

export default function ContactEmailsScreen() {
  const { contactId, contactName } = useLocalSearchParams<{
    contactId: string;
    contactName: string;
  }>();

  return (
    <View style={styles.container}>
      {/* Header with back button and contact name */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{contactName}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Emails list */}
      <ContactEmailsList contactId={contactId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 80, // Same width as back button for centering
  },
  separator: {
    height: 1,
    backgroundColor: colors.secondary,
    opacity: 0.6,
  },
});