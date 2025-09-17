import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../../src/constants';
import ContactThreadsList from '../../../src/components/contacts/ContactThreadsList';

export default function ContactThreadsScreen() {
  const { contactId, contactName } = useLocalSearchParams<{
    contactId: string;
    contactName: string;
  }>();

  const handleViewAllEmails = () => {
    // Navigate to the full email list for this contact
    router.push({
      pathname: '/(app)/contacts/contact-emails',
      params: {
        contactId: contactId,
        contactName: contactName
      }
    });
  };

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
        <TouchableOpacity
          style={styles.allEmailsButton}
          onPress={handleViewAllEmails}
        >
          <Text style={styles.allEmailsButtonText}>All Emails</Text>
        </TouchableOpacity>
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>Conversations</Text>
        <Text style={styles.infoSubtext}>Grouped by subject</Text>
      </View>

      {/* Threads list */}
      <ContactThreadsList contactId={contactId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
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
    marginHorizontal: 8,
  },
  allEmailsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  allEmailsButtonText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: colors.secondary,
    opacity: 0.6,
  },
  infoBar: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  infoSubtext: {
    fontSize: 12,
    color: colors.primary,
    opacity: 0.6,
  },
});