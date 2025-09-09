import { Tabs } from 'expo-router/tabs'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarStyle: { display: 'none' }
    }}>
      <Tabs.Screen name="index" />
    </Tabs>
  )
}