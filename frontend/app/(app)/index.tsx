import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { colors } from '../../src/constants';
import { supabase } from '../../src/lib/supabase';
import { router } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import ContactsList from '../../src/components/contacts/ContactsList'; // Updated path for reorganized components
import { startAutoSync } from '../../src/database/sync';
import { imapSyncService } from '../../src/services/ImapSyncService';

export default function Index() {
  const [accounts, setAccounts] = useState<any[] | null>(null)
  const { session } = useSession()

  useEffect(() => {
    fetchAccounts()
  }, [])

  // 🔄 START BACKGROUND SYNC: Begin syncing contacts with cloud database
  useEffect(() => {
    const cleanup = startAutoSync()  // Returns cleanup function

    // 🧹 CLEANUP: Stop sync when component unmounts
    return cleanup  // This stops the sync interval and real-time subscription
  }, [])  // Empty dependency array = run once on mount

  // Start IMAP background sync
  useEffect(() => {
    imapSyncService.startBackgroundSync()
    return () => imapSyncService.stopBackgroundSync()
  }, [])

  async function fetchAccounts() {
    const response = await fetch('http://localhost:3000/api/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })
    
    const data = await response.json()
    setAccounts(data.accounts || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/(auth)/auth')
  }

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.heading}>Maily</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Separator Line */}
      <View style={styles.separator} />

      {/* Content Section */}
      <View style={styles.contentSection}>
        {accounts === null ? (
          /* 🔄 LOADING: Show loading state while fetching accounts */
          <View style={styles.loadingContent}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : accounts?.length === 0 ? (
          /* 📧 NO ACCOUNTS: Show add account button */
          <View style={styles.noAccountsContent}>
            <Text style={styles.noAccountsText}>No email accounts</Text>
            <TouchableOpacity style={styles.addAccountButton} onPress={() => router.push('/(app)/setup/email-setup')}>
              <Text style={styles.addAccountText}>Add Email Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* 📱 HAS ACCOUNTS: Show contacts list */
          <ContactsList userId={session?.user?.id || ''} />
        )}
      </View>

      {/* Separator Line */}
      <View style={styles.separator} />

      {/* Bottom Tabs Section */}
      <View style={styles.tabsSection}>
        <Text style={styles.tabsPlaceholder}>Tabs will be here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerSection: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: -0.5,
  },
  logoutButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.black,
  },
  logoutText: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: colors.secondary,
    marginHorizontal: 0,
    opacity: 0.6,
  },
  contentSection: {
    flex: 1,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '500',
  },
  noAccountsContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  noAccountsText: {
    fontSize: 18,
    color: colors.primary,
    opacity: 0.6,
    marginBottom: 40,
    fontWeight: '500',
  },
  addAccountButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 200,
    alignItems: 'center',
  },
  addAccountText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabsSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
    backgroundColor: colors.secondary,
    opacity: 0.3,
  },
  tabsPlaceholder: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
    opacity: 0.7,
  },
});