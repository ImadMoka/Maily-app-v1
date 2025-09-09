import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'

export default function EmailSetup() {
  const [email, setEmail] = useState('')

  function handleContinue() {
    if (!email.includes('@gmail.com')) {
      Alert.alert('Sorry, we don\'t support your provider right now - we are working on it')
      return
    }
    router.push({
      pathname: '/(app)/email-setup-step2',
      params: { email }
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>1) Step One</Text>
      <Text style={styles.description}>Enter the email address you want to receive messages from</Text>
      
      <TextInput
        style={styles.emailInput}
        placeholder="typ in your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueText}>Continue</Text>
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
    marginBottom: 30,
  },
  emailInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 40,
    alignItems: 'center',
  },
  continueText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})