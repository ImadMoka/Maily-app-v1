import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { colors } from '../../../src/constants';
import { supabase } from '../../../src/lib/supabase';
import { router } from 'expo-router';
import { useSession } from '../../../src/context/SessionContext';

export default function Index() {
  const [accounts, setAccounts] = useState([])
  const { session } = useSession()

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    const response = await fetch('http://localhost:3000/api/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
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

      {/* Chat Section */}
      <View style={styles.chatSection}>
        <View style={styles.chatContent}>
          <Text style={styles.noChatsText}>No chats</Text>
          {accounts.length === 0 && (
            <TouchableOpacity style={styles.addAccountButton} onPress={() => router.push('/email-setup')}>
              <Text style={styles.addAccountText}>Add Email Account</Text>
            </TouchableOpacity>
          )}
        </View>
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
    color: colors.primary,
    letterSpacing: -0.5,
  },
  logoutButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.secondary,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: colors.secondary,
    marginHorizontal: 0,
    opacity: 0.6,
  },
  chatSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  chatContent: {
    alignItems: 'center',
  },
  noChatsText: {
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