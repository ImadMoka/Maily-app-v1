import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { colors } from '../../../src/constants'
import { supabase } from '../../../src/lib/supabase'
import { useSession } from '../../../src/context/SessionContext'

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const { session } = useSession()

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
      <View style={styles.contentSection}>

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
      </View>
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
})