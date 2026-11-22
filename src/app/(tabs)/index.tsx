import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/theme';

export default function DashboardScreen() {
  const colors = AppColors;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Dashboard</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>En construcción</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
  },
});
