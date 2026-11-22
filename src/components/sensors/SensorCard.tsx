import { Ionicons } from "@expo/vector-icons";
import type * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppColors, Spacing } from "@/constants/theme";

export interface SensorCardProps {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent?: string;
  children: React.ReactNode;
}

/** Carcasa común (título + icono + contenedor) de las tarjetas de sensor. */
export function SensorCard({ title, icon, accent, children }: SensorCardProps) {
  const colors = AppColors;
  const accentColor = accent ?? colors.primary;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.header}>
        <Ionicons name={icon} size={20} color={accentColor} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 300,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderColor: AppColors.backgroundElement,
    backgroundColor: AppColors.onPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
});
