import { View, Text, StyleSheet, TouchableOpacity, Linking, TextInput, Alert } from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useSession } from '../../src/context/SessionContext'
import { colors } from '../../src/constants'

export default function EmailSetupStep2() {
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { email } = useLocalSearchParams()
  const { session } = useSession()
  
  function handleOpenGoogleAppPasswords() {
    Linking.openURL('https://myaccount.google.com/apppasswords')
  }

  async function handleFinish() {
    if (!appPassword.trim()) {
      return
    }

    if (!session?.access_token) {
      Alert.alert('Error', 'Please sign in again')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: email,
          password: appPassword.trim(),
          imapHost: 'imap.gmail.com',
          imapUsername: email,
          imapPort: 993
        })
      })

      const data = await response.json()

      console.log('API Response:', { status: response.status, data })

      if (response.ok && data.success) {
        Alert.alert('Success', 'Email account setup complete!', [
          { text: 'OK', onPress: () => router.push('/(app)/(tabs)/') }
        ])
      } else {
        Alert.alert('Error', data.error || 'Failed to setup email account')
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.')
      console.error('API call failed:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={() => router.push('/(app)/(tabs)/')}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.stepTitle}>Step 2</Text>
      <Text style={styles.description}>Follow these steps to get your app password:</Text>
      
      <Text style={styles.instructions}>
        1. Click the button below{'\n'}
        2. Enter 'MAILY' as the app name{'\n'}
        3. Copy the generated password{'\n'}
        4. Paste it in the field below
      </Text>
      
      <TouchableOpacity style={styles.linkButton} onPress={handleOpenGoogleAppPasswords}>
        <Text style={styles.linkText}>Open Google App Passwords</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.codeInput}
        placeholder="Paste your app password here (example: pkmz rerb zkbi qhei)"
        value={appPassword}
        onChangeText={setAppPassword}
        autoCapitalize="none"
      />
      
      <TouchableOpacity 
        style={[styles.finishButton, (!appPassword.trim() || loading) && styles.finishButtonDisabled]} 
        onPress={handleFinish}
        disabled={!appPassword.trim() || loading}
      >
        <Text style={styles.finishText}>{loading ? 'Setting up...' : 'Finish'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 18,
    color: colors.primary,
    opacity: 0.9,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  instructions: {
    fontSize: 16,
    color: colors.primary,
    opacity: 0.8,
    lineHeight: 26,
    marginBottom: 32,
    paddingHorizontal: 16,
    backgroundColor: colors.secondary,
    paddingVertical: 20,
    borderRadius: 16,
    fontWeight: '500',
  },
  linkButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginBottom: 32,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 56,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  codeInput: {
    height: 56,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    backgroundColor: colors.white,
    marginBottom: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    color: colors.black,
  },
  finishButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 56,
    justifyContent: 'center',
  },
  finishButtonDisabled: {
    backgroundColor: colors.secondary,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  finishText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 32,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
})