import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { colors } from '../../../src/constants'
import { supabase } from '../../../src/lib/supabase'
import { useSession } from '../../../src/context/SessionContext'
import { database } from '../../../src/database'
import { Q } from '@nozbe/watermelondb'

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
                // Clean up all local data for this account
                try {
                  // Track deletion statistics
                  const deletionStats = {
                    emails: 0,
                    emailBodies: 0,
                    linkedContacts: 0,
                    orphanedContacts: 0,
                    threads: 0
                  }

                  await database.write(async () => {
                    // 1. Get all emails for this account
                    const emailsCollection = database.collections.get('emails')
                    const emails = await emailsCollection
                      .query(Q.where('account_id', accountId))
                      .fetch()

                    deletionStats.emails = emails.length
                    const emailIds = emails.map(e => e.id)
                    // Access contactId using camelCase
                    const contactIds = [...new Set(emails.map(e => (e as any).contactId).filter(Boolean))]

                    // 2. Delete email bodies
                    if (emailIds.length > 0) {
                      const emailBodies = await database.collections
                        .get('email_body')
                        .query(Q.where('email_id', Q.oneOf(emailIds)))
                        .fetch()

                      deletionStats.emailBodies = emailBodies.length
                      await Promise.all(emailBodies.map(eb => eb.markAsDeleted()))
                    }

                    // 3. Delete emails
                    await Promise.all(emails.map(e => e.markAsDeleted()))

                    // 4. Delete contacts (only if they have no emails from other accounts)
                    const contactsCollection = database.collections.get('contacts')

                    if (contactIds.length > 0) {
                      // Check for emails from other accounts
                      const otherEmails = await emailsCollection
                        .query(
                          Q.and(
                            Q.where('contact_id', Q.oneOf(contactIds)),
                            Q.where('account_id', Q.notEq(accountId))
                          )
                        )
                        .fetch()

                      // Access contactId using camelCase
                      const contactsWithOtherEmails = new Set(otherEmails.map(e => (e as any).contactId))
                      const contactsToDelete = contactIds.filter(id => !contactsWithOtherEmails.has(id))

                      if (contactsToDelete.length > 0) {
                        const contacts = await contactsCollection
                          .query(Q.where('id', Q.oneOf(contactsToDelete)))
                          .fetch()

                        deletionStats.linkedContacts = contacts.length
                        await Promise.all(contacts.map(c => c.markAsDeleted()))

                        // Delete threads for these contacts
                        const threads = await database.collections
                          .get('threads')
                          .query(Q.where('contact_id', Q.oneOf(contactsToDelete)))
                          .fetch()

                        deletionStats.threads += threads.length
                        await Promise.all(threads.map(t => t.markAsDeleted()))
                      }
                    }

                    // 5. IMPORTANT: Clean up ALL orphaned contacts (contacts with no emails at all)
                    const allContacts = await contactsCollection.query().fetch()
                    const orphanedContacts = []

                    for (const contact of allContacts) {
                      // Check if this contact has ANY emails remaining
                      const remainingEmails = await emailsCollection
                        .query(Q.where('contact_id', contact.id))
                        .fetch()

                      if (remainingEmails.length === 0) {
                        orphanedContacts.push(contact)
                      }
                    }

                    if (orphanedContacts.length > 0) {
                      deletionStats.orphanedContacts = orphanedContacts.length
                      await Promise.all(orphanedContacts.map(c => c.markAsDeleted()))

                      // Also delete threads for orphaned contacts
                      const orphanContactIds = orphanedContacts.map(c => c.id)
                      const orphanThreads = await database.collections
                        .get('threads')
                        .query(Q.where('contact_id', Q.oneOf(orphanContactIds)))
                        .fetch()

                      deletionStats.threads += orphanThreads.length
                      await Promise.all(orphanThreads.map(t => t.markAsDeleted()))
                    }
                  })

                  // Create detailed success message with stats
                  const totalDeleted = deletionStats.emails + deletionStats.emailBodies +
                                      deletionStats.linkedContacts + deletionStats.orphanedContacts +
                                      deletionStats.threads

                  const statsMessage = `Account disconnected successfully!\n\n` +
                    `Cleaned up:\n` +
                    `📧 ${deletionStats.emails} emails\n` +
                    `📄 ${deletionStats.emailBodies} email bodies\n` +
                    `👤 ${deletionStats.linkedContacts + deletionStats.orphanedContacts} contacts\n` +
                    `💬 ${deletionStats.threads} threads\n\n` +
                    `Total: ${totalDeleted} records removed`

                  console.log('Deletion statistics:', deletionStats)
                  setEmailAccounts(prev => prev.filter(acc => acc.id !== accountId))
                  Alert.alert('Success', statsMessage)

                } catch (cleanupError) {
                  console.error('Local cleanup failed:', cleanupError)
                  // Don't block the disconnect even if local cleanup fails
                  setEmailAccounts(prev => prev.filter(acc => acc.id !== accountId))
                  Alert.alert('Success', 'Email account disconnected (cleanup may be incomplete)')
                }
              } else {
                const errorData = await response.json()
                console.error('Disconnect error:', errorData)
                Alert.alert('Error', errorData.error || 'Failed to disconnect email account')
              }
            } catch (error) {
              console.error('Disconnect error:', error)
              Alert.alert('Error', 'Network error while disconnecting account')
            } finally {
              setDeleting(null)
            }
          }
        }
      ]
    )
  }

  async function handleDisconnectAllAccounts() {
    Alert.alert(
      'Delete All Accounts',
      `This will delete ALL email accounts from the database.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)

            try {
              console.log('🗑️ Deleting all accounts from Supabase...')

              const response = await fetch('http://localhost:3000/api/debug/delete-all-accounts', {
                method: 'DELETE'
              })

              if (response.ok) {
                const result = await response.json()

                console.log('✅ Deleted:', result.deletedCount, 'accounts')

                Alert.alert(
                  'Success',
                  `Deleted ${result.deletedCount} accounts from database`
                )

                // Clear local state
                setEmailAccounts([])
              } else {
                const errorData = await response.json()
                console.error('❌ Error:', errorData)
                Alert.alert('Error', errorData.message || 'Failed to delete accounts')
              }

            } catch (error) {
              console.error('❌ Error:', error)
              Alert.alert('Error', 'Failed to delete accounts')
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  async function handleClearLocalData() {
    Alert.alert(
      'Clear All Local Data',
      'This will delete all cached emails, contacts, and threads from your device. Data will be re-synced from the server on next refresh.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              // First, count all records before deletion
              const stats = {
                emails: 0,
                emailBodies: 0,
                contacts: 0,
                threads: 0
              }

              // Count records in each collection
              const emailsCollection = database.collections.get('emails')
              const emailBodiesCollection = database.collections.get('email_body')
              const contactsCollection = database.collections.get('contacts')
              const threadsCollection = database.collections.get('threads')

              stats.emails = await emailsCollection.query().fetchCount()
              stats.emailBodies = await emailBodiesCollection.query().fetchCount()
              stats.contacts = await contactsCollection.query().fetchCount()
              stats.threads = await threadsCollection.query().fetchCount()

              const totalRecords = stats.emails + stats.emailBodies + stats.contacts + stats.threads

              // Try method 1: unsafeResetDatabase (fastest but may not work in all environments)
              try {
                await database.unsafeResetDatabase()
                console.log('Database reset using unsafeResetDatabase')
              } catch (resetError) {
                console.log('unsafeResetDatabase failed, using fallback method:', resetError)

                // Fallback method: Manually delete all records
                await database.write(async () => {
                  // Delete all emails
                  const allEmails = await emailsCollection.query().fetch()
                  await Promise.all(allEmails.map(record => record.markAsDeleted()))

                  // Delete all email bodies
                  const allEmailBodies = await emailBodiesCollection.query().fetch()
                  await Promise.all(allEmailBodies.map(record => record.markAsDeleted()))

                  // Delete all contacts
                  const allContacts = await contactsCollection.query().fetch()
                  await Promise.all(allContacts.map(record => record.markAsDeleted()))

                  // Delete all threads
                  const allThreads = await threadsCollection.query().fetch()
                  await Promise.all(allThreads.map(record => record.markAsDeleted()))
                })

                console.log('Database cleared using manual deletion')
              }

              // Create detailed success message
              const statsMessage = `Successfully deleted:\n\n` +
                `📧 ${stats.emails} emails\n` +
                `📄 ${stats.emailBodies} email bodies\n` +
                `👤 ${stats.contacts} contacts\n` +
                `💬 ${stats.threads} threads\n\n` +
                `Total: ${totalRecords} records cleared\n\n` +
                `Pull down to refresh and re-sync.`

              Alert.alert('Database Cleared', statsMessage)

              console.log('Local database completely cleared with stats:', stats)
              console.log(`Total records deleted: ${totalRecords}`)

            } catch (error) {
              console.error('Failed to clear local data - full error:', error)
              console.error('Error name:', error.name)
              console.error('Error message:', error.message)
              console.error('Error stack:', error.stack)

              Alert.alert(
                'Error',
                `Failed to clear local data.\n\nError: ${error.message || 'Unknown error'}\n\nPlease try restarting the app.`
              )
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

          <TouchableOpacity
            style={[styles.debugButton, { marginTop: 12, backgroundColor: '#ffebee' }]}
            onPress={handleClearLocalData}
          >
            <Text style={[styles.debugButtonText, { color: '#d32f2f' }]}>
              Clear All Local Data
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.debugButton, { marginTop: 12, backgroundColor: '#fff3e0' }]}
            onPress={handleDisconnectAllAccounts}
          >
            <Text style={[styles.debugButtonText, { color: '#e65100' }]}>
              Delete All Accounts (Backend)
            </Text>
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