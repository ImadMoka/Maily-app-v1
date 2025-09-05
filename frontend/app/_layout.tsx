import { Stack } from 'expo-router'
import { SessionProvider, useSession } from '../src/context/SessionContext'
import { useEffect } from 'react'
import { router } from 'expo-router'

function RootNavigator() {
  const { session, loading } = useSession()

  useEffect(() => {
    if (!loading) {
      if (session) {
        router.replace('/(app)/(tabs)')
      } else {
        router.replace('/(auth)/sign-in')
      }
    }
  }, [session, loading])

  if (loading) {
    return null // Or loading screen
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}

export default function Layout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  )
}