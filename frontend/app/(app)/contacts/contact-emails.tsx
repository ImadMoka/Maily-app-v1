import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors } from '../../../src/constants';
import ContactEmailsList from '../../../src/components/contacts/ContactEmailsList';

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
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
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
    width: 80,
  },
  separator: {
    height: 0.5,
    backgroundColor: colors.separator,
  },
});