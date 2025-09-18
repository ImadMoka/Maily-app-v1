// Import Stack Navigation Component from Expo Router for hierarchical navigation
import { Stack } from 'expo-router'

// AppLayout Component - Layout for all AUTHENTICATED App Screens
// This component is only rendered when user is logged in
export default function AppLayout() {
  // Return Statement - returns JSX that will be rendered
  return (
    // Stack Navigation Container for App Screens without headers
    // screenOptions = Global options for all child screens
    // headerShown: false = Hides navigation headers for clean UI
    <Stack screenOptions={{ headerShown: false }}>
      {/* Main tabs with mail and settings */}
      <Stack.Screen name="(tabs)" />
      {/* Other screens */}
      <Stack.Screen name="setup/email-setup" />
      <Stack.Screen name="setup/email-setup-step2" />
      <Stack.Screen name="contacts/contact-emails" />
      <Stack.Screen name="contacts/contact-threads" />
      <Stack.Screen name="threads/thread-emails" />
    </Stack>
  )
}