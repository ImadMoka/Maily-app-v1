import { useState } from 'react'
import { View, Text, TextInput, Button, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '../../src/constants'
import { supabase } from '../../src/lib/supabase'

export default function ProfileSetup() {
  const [name, setName] = useState('')

  function goToMainApp() {
    router.replace('/(app)/(tabs)')
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Text style={styles.label}>What's your name?</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>
      
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button title="Save Name" onPress={goToMainApp} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 40,
    padding: 12,
    backgroundColor: colors.white,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.black,
  },
})