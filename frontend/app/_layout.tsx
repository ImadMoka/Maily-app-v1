import { Stack } from 'expo-router'
import { SessionProvider, useSession } from '../src/context/SessionContext'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../src/constants'

function RootNavigator() {
  const { session, loading } = useSession()

  useEffect(() => {
    if (!loading) {
      if (session) {
        // TODO: Check if user has completed profile setup
        // For now, let manual navigation handle it
        // router.replace('/(app)')
      } else {
        router.replace('/(auth)/auth')
      }
    }
  }, [session, loading])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    fontSize: 18,
    color: colors.primary,
  },
})

export default function Layout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  )
}