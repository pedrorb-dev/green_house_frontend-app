import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppColors, Spacing } from "@/constants/theme";
import { GATE, type GateMode } from "@/domain/models/greenhouse.types";
import { formatGateMode, formatGateOpen } from "./format";
import { SensorCard } from "./SensorCard";

interface AccessGateCardProps {
  proximityDistanceCm: number;
  gateOpen: boolean;
  gateMode: GateMode;
}

export function AccessGateCard({
  proximityDistanceCm,
  gateOpen,
  gateMode,
}: AccessGateCardProps) {
  const colors = AppColors;
  const proximityDetected =
    proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM;

  return (
    <SensorCard title="Acceso y compuerta" icon="scan-outline">
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Distancia
          </Text>
          <Text
            style={[
              styles.value,
              {
                color: proximityDetected ? colors.primary : colors.text,
              },
            ]}
          >
            {proximityDistanceCm.toFixed(1)} cm
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Compuerta
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatGateOpen(gateOpen)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Modo
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatGateMode(gateMode)}
          </Text>
        </View>
      </View>

      {proximityDetected && (
        <View
          style={[styles.alert, { backgroundColor: colors.backgroundElement }]}
        >
          <Ionicons name="warning-outline" size={16} color={colors.text} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            Proximidad detectada (&lt; {GATE.PROXIMITY_THRESHOLD_CM} cm).
          </Text>
        </View>
      )}
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: Spacing.one,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  detail: {
    fontSize: 12,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 8,
  },
  alertText: {
    flexShrink: 1,
    fontSize: 12,
  },
});
