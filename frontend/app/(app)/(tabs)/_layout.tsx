import { View, StyleSheet } from 'react-native'
import { colors } from '../../../src/constants'

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      {/* Für jetzt simple View - später echte Tabs */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
})