import { View, Text, StyleSheet, TouchableOpacity, Linking, TextInput } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'

export default function EmailSetupStep2() {
  const [appPassword, setAppPassword] = useState('')
  
  function handleOpenGoogleAppPasswords() {
    Linking.openURL('https://myaccount.google.com/apppasswords')
  }

  function handleFinish() {
    if (!appPassword.trim()) {
      return // Don't allow finish if no password entered
    }
    // TODO: Save password and go to main page
    router.push('/(app)/(tabs)/')
  }


  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>2) Step Two</Text>
      <Text style={styles.description}>Follow these steps to get your app password:</Text>
      
      <Text style={styles.instructions}>
        1. Click the blue button below{'\n'}
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
        style={[styles.finishButton, !appPassword.trim() && styles.finishButtonDisabled]} 
        onPress={handleFinish}
        disabled={!appPassword.trim()}
      >
        <Text style={styles.finishText}>Finish</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  instructions: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 25,
  },
  linkButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 30,
    alignItems: 'center',
  },
  linkText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  codeInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  finishButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginTop: 15,
    alignSelf: 'center',
  },
  finishButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finishText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'normal',
  },
})