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
      {/* Expo Router auto-discovers screens based on file structure */}
    </Stack>
  )
}