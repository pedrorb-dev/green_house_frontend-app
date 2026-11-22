import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { roundPercent } from "@/components/sensors/format";
import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import { useSendCommand } from "@/hooks/useGreenhouse";
import { getUserFacingMessage } from "@/services/api/api.service";

interface PumpControlCardProps {
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
  soilMoisturePct: number;
  targetMoisturePct: number;
}

export function PumpControlCard({
  pumpActive,
  pumpCooldownRemainingSec,
  soilMoisturePct,
  targetMoisturePct,
}: PumpControlCardProps) {
  const colors = AppColors;
  const { mutate, isPending, isError, error } = useSendCommand();

  const status = pumpActive
    ? "Regando…"
    : pumpCooldownRemainingSec > 0
      ? `En espera de seguridad (${pumpCooldownRemainingSec}s)`
      : "Lista para regar";

  const moisture = roundPercent(soilMoisturePct);
  const target = roundPercent(targetMoisturePct);
  const disabled = pumpActive || pumpCooldownRemainingSec > 0 || isPending;
  const buttonTextColor = disabled ? colors.text : colors.onPrimary;

  return (
    <SensorCard title="Bomba de riego" icon="water-outline">
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Estado
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>{status}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Humedad actual
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {moisture}%
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Objetivo
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>{target}%</Text>
        </View>
      </View>

      {isError && (
        <View
          style={[styles.alert, { backgroundColor: colors.backgroundElement }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.text} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            {getUserFacingMessage(error)}
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => mutate({ type: "WATER_PUMP" })}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Regar ahora"
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: disabled
              ? colors.backgroundElement
              : colors.primary,
          },
          pressed && !disabled && styles.buttonPressed,
        ]}
      >
        {isPending ? (
          <>
            <ActivityIndicator size="small" color={buttonTextColor} />
            <Text style={[styles.buttonText, { color: buttonTextColor }]}>
              Aplicando…
            </Text>
          </>
        ) : (
          <Text style={[styles.buttonText, { color: buttonTextColor }]}>
            Regar ahora
          </Text>
        )}
      </Pressable>
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
  note: {
    fontSize: 12,
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
  button: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
