import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { formatGateOpen } from "@/components/sensors/format";
import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import {
  GATE,
  type GateMode,
} from "@/domain/models/greenhouse.types";
import { useSendCommand } from "@/hooks/useGreenhouse";

const GATE_MODES: readonly GateMode[] = ["AUTO", "OPEN", "CLOSED"];

interface GateControlCardProps {
  gateMode: GateMode;
  gateOpen: boolean;
  proximityDistanceCm: number;
}

export function GateControlCard({
  gateMode,
  gateOpen,
  proximityDistanceCm,
}: GateControlCardProps) {
  const colors = AppColors;
  const { mutate, isPending, isError } = useSendCommand();

  const proximityDetected =
    gateMode === "AUTO" && proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM;

  return (
    <SensorCard title="Compuerta" icon="toggle-outline">
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Estado físico
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatGateOpen(gateOpen)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Ultrasónico
          </Text>
          <Text
            style={[
              styles.value,
              { color: proximityDetected ? colors.primary : colors.text },
            ]}
          >
            {`${proximityDistanceCm.toFixed(1)} cm`}
          </Text>
        </View>
      </View>

      {proximityDetected && (
        <View
          style={[styles.alert, { backgroundColor: colors.backgroundElement }]}
        >
          <Ionicons name="warning-outline" size={16} color={colors.text} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            {`Proximidad detectada (< ${GATE.PROXIMITY_THRESHOLD_CM} cm) en modo AUTO.`}
          </Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Modo de la compuerta
      </Text>
      <View style={styles.segmented}>
        {GATE_MODES.map((mode) => {
          const active = mode === gateMode;
          return (
            <Pressable
              key={mode}
              onPress={() => mutate({ type: "SET_GATE_MODE", value: mode })}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Modo ${mode}`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.segment,
                {
                  backgroundColor: active
                    ? colors.backgroundSelected
                    : colors.backgroundElement,
                },
                pressed && !isPending && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.primary : colors.text },
                ]}
              >
                {mode}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isPending && (
        <View style={styles.applying}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.applyingText, { color: colors.primary }]}>
            Aplicando…
          </Text>
        </View>
      )}

      {isError && (
        <View
          style={[styles.alert, { backgroundColor: colors.backgroundElement }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.text} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            No se pudo cambiar el modo de la compuerta.
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
  sectionLabel: {
    fontSize: 12,
  },
  segmented: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  segment: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  applying: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  applyingText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
