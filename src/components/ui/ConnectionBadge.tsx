import { StyleSheet, Text, View } from "react-native";

import { AppColors, Spacing } from "@/constants/theme";

interface ConnectionBadgeProps {
  isMock: boolean;
  deviceOnline?: boolean; // undefined = cargando / sin datos
}

const ONLINE_COLOR = "#22C55E";
const OFFLINE_COLOR = "#F59E0B";

function getBadgeState(isMock: boolean, deviceOnline?: boolean) {
  if (isMock) {
    return { dotColor: ONLINE_COLOR, label: "En vivo • Simulación" };
  }
  if (deviceOnline === undefined) {
    return { dotColor: OFFLINE_COLOR, label: "Conectando…" };
  }
  if (deviceOnline) {
    return { dotColor: ONLINE_COLOR, label: "En vivo • ESP32" };
  }
  return { dotColor: OFFLINE_COLOR, label: "Sin conexión ESP32" };
}

export function ConnectionBadge({ isMock, deviceOnline }: ConnectionBadgeProps) {
  const colors = AppColors;
  const { dotColor, label } = getBadgeState(isMock, deviceOnline);

  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
