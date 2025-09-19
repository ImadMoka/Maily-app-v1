import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { colors } from '../../../src/constants'
import { supabase } from '../../../src/lib/supabase'
import { useSession } from '../../../src/context/SessionContext'

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailAccounts, setEmailAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { session } = useSession()

  useEffect(() => {
    fetchEmailAccounts()
  }, [])

  async function fetchEmailAccounts() {
    if (!session?.access_token) return

    setLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/accounts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setEmailAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Failed to fetch email accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnectAccount(accountId: string, email: string) {
    Alert.alert(
      'Disconnect Email Account',
      `Are you sure you want to disconnect ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            if (!session?.access_token) return

            setDeleting(accountId)
            try {
              const response = await fetch(`http://localhost:3000/api/accounts/${accountId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              })

              if (response.ok) {
                setEmailAccounts(prev => prev.filter(acc => acc.id !== accountId))
                Alert.alert('Success', 'Email account disconnected successfully')
              } else {
                const errorData = await response.json()
                console.error('Disconnect error:', errorData)
                Alert.alert('Error', errorData.error || 'Failed to disconnect email account')
              }
            } catch (error) {
              Alert.alert('Error', 'Network error while disconnecting account')
            } finally {
              setDeleting(null)
            }
          }
        }
      ]
    )
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/(auth)/auth')
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.heading}>Settings</Text>
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Settings Content */}
      <ScrollView style={styles.contentSection}>

        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{session?.user?.email}</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Name</Text>
            <Text style={styles.settingValue}>{session?.user?.user_metadata?.display_name || 'Not set'}</Text>
          </View>
        </View>

        {/* Connected Email Accounts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Email Accounts</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : emailAccounts.length > 0 ? (
            <>
              {emailAccounts.map(account => (
                <View key={account.id} style={styles.emailAccountItem}>
                  <View style={styles.emailAccountInfo}>
                    <Text style={styles.emailAccountEmail}>{account.email}</Text>
                    <Text style={styles.emailAccountStatus}>
                      {account.is_active ? '✓ Active' : '⚠ Inactive'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={() => handleDisconnectAccount(account.id, account.email)}
                    disabled={deleting === account.id}
                  >
                    {deleting === account.id ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.disconnectButtonText}>Disconnect</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addAnotherAccountButton}
                onPress={() => router.push('/(app)/setup/email-setup')}
              >
                <Text style={styles.addAnotherAccountButtonText}>+ Add Another Account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noAccountsContainer}>
              <Text style={styles.noAccountsText}>No email accounts connected</Text>
              <TouchableOpacity
                style={styles.connectAccountButton}
                onPress={() => router.push('/(app)/setup/email-setup')}
              >
                <Text style={styles.connectAccountButtonText}>Connect Email Account</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.secondary, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Theme Section (Future) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingValue}>Light (Coming Soon)</Text>
          </View>
        </View>

        {/* Debug Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug</Text>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => router.push('/(app)/debug-email-bodies')}
          >
            <Text style={styles.debugButtonText}>View Email Bodies Database</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
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
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: colors.secondary,
    opacity: 0.6,
  },
  contentSection: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    color: colors.primary,
    opacity: 0.7,
  },
  logoutButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  debugButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emailAccountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  emailAccountInfo: {
    flex: 1,
    marginRight: 12,
  },
  emailAccountEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emailAccountStatus: {
    fontSize: 12,
    color: colors.primary,
    opacity: 0.7,
    marginTop: 2,
  },
  disconnectButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  noAccountsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noAccountsText: {
    fontSize: 14,
    color: colors.primary,
    opacity: 0.6,
    marginBottom: 12,
  },
  connectAccountButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  connectAccountButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  addAnotherAccountButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 16,
  },
  addAnotherAccountButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
})