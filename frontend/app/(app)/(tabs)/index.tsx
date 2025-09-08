import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../../src/constants';
import { supabase } from '../../../src/lib/supabase';
import { router } from 'expo-router';

export default function Index() {
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
          <TouchableOpacity style={styles.addAccountButton}>
            <Text style={styles.addAccountText}>Add Email Account</Text>
          </TouchableOpacity>
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  logoutButton: {
    position: 'absolute',
    left: 20,
    bottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutText: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  chatSection: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  chatContent: {
    alignItems: 'center',
  },
  noChatsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 30,
  },
  addAccountButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addAccountText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  tabsSection: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  tabsPlaceholder: {
    fontSize: 14,
    color: '#ccc',
  },
});