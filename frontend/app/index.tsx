import { View, StyleSheet } from 'react-native';
import { colors } from '../src/constants';

export default function Index() {
  return (
    <View style={styles.container}>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
});