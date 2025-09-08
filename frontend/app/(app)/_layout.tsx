// Importiert Stack Navigation Component von Expo Router für hierarchische Navigation
import { Stack } from 'expo-router'

// Leerzeile für Code Struktur
// AppLayout Component - Layout für alle AUTHENTICATED App Screens
// Diese Component wird nur gerendert wenn User eingeloggt ist
export default function AppLayout() {
  // Return Statement - gibt JSX zurück das gerendert wird
  return (
    // Stack Navigation Container für App Screens ohne Headers
    // screenOptions = Globale Optionen für alle Child Screens
    // headerShown: false = Versteckt Navigation Headers für cleanes UI
    <Stack screenOptions={{ headerShown: false }}>
      {/* Stack.Screen registriert (tabs) Route Group */}
      {/* name="(tabs)" verlinkt zu app/(app)/(tabs)/_layout.tsx */}
      {/* Expo Router: Parentheses () = Route Groups für Organisation */}
      <Stack.Screen name="(tabs)" />
    </Stack>
    // Schließender Tag für Stack Navigation Component
  )
  // Schließende Klammer für return Statement
}
// Schließende Klammer für AppLayout Function