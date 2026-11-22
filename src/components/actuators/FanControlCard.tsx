import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { formatPhotoperiod } from "@/components/sensors/format";
import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import { PWM, type PhotoperiodState } from "@/domain/models/greenhouse.types";
import { useSendCommand } from "@/hooks/useGreenhouse";
import { getUserFacingMessage } from "@/services/api/api.service";

const FAN_PRESETS = [230, 238, 245] as const;
const FAN_STEP = 1;

interface FanControlCardProps {
  fanActive: boolean;
  fanPwm: number;
  photoperiodState: PhotoperiodState;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function FanControlCard({
  fanActive,
  fanPwm,
  photoperiodState,
}: FanControlCardProps) {
  const colors = AppColors;
  const { mutate, isPending, isError, error } = useSendCommand();
  const [draft, setDraft] = useState<number | null>(null);

  const value = draft ?? fanPwm;
  const isNight = photoperiodState === "NIGHT";
  const status = fanActive
    ? "Encendido"
    : isNight
      ? "En reposo nocturno"
      : "Apagado";

  const change = (next: number) =>
    setDraft(clamp(next, PWM.FAN_MIN, PWM.FAN_MAX));

  const apply = () => {
    if (draft === null) return;
    mutate(
      { type: "SET_FAN_PWM", value: draft },
      { onSuccess: () => setDraft(null) },
    );
  };

  const applyDisabled = draft === null || isPending;
  const applyTextColor = applyDisabled ? colors.text : colors.onPrimary;

  return (
    <SensorCard title="Ventilador" icon="speedometer-outline">
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Estado
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>{status}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Fotoperiodo
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatPhotoperiod(photoperiodState)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            PWM
          </Text>
          <Text style={[styles.pwmValue, { color: colors.text }]}>
            {value}
          </Text>
        </View>
      </View>

      {isNight && (
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          El valor PWM queda guardado para el ciclo diurno.
        </Text>
      )}
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        {`Rango ${PWM.FAN_MIN}–${PWM.FAN_MAX} · protección de voltaje del ESP32 (< 250).`}
      </Text>

      {draft !== null && (
        <Text style={[styles.draftNote, { color: colors.primary }]}>
          Cambio pendiente: {draft} PWM
        </Text>
      )}

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

      <View style={styles.stepper}>
        <Pressable
          onPress={() => change(value - FAN_STEP)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Bajar PWM del ventilador"
          style={({ pressed }) => [
            styles.stepButton,
            { backgroundColor: colors.backgroundElement },
            pressed && !isPending && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.stepText, { color: colors.text }]}>-1</Text>
        </Pressable>
        <Pressable
          onPress={() => change(value + FAN_STEP)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Subir PWM del ventilador"
          style={({ pressed }) => [
            styles.stepButton,
            { backgroundColor: colors.backgroundElement },
            pressed && !isPending && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.stepText, { color: colors.text }]}>+1</Text>
        </Pressable>
      </View>

      <View style={styles.presets}>
        {FAN_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => change(preset)}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel={`Preset ${preset}`}
            style={({ pressed }) => [
              styles.presetButton,
              {
                backgroundColor:
                  value === preset ? colors.backgroundSelected : colors.backgroundElement,
              },
              pressed && !isPending && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.presetText,
                { color: value === preset ? colors.primary : colors.text },
              ]}
            >
              {preset}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={apply}
        disabled={applyDisabled}
        accessibilityRole="button"
        accessibilityLabel="Aplicar PWM del ventilador"
        style={({ pressed }) => [
          styles.applyButton,
          {
            backgroundColor: applyDisabled
              ? colors.backgroundElement
              : colors.primary,
          },
          pressed && !applyDisabled && styles.buttonPressed,
        ]}
      >
        {isPending ? (
          <>
            <ActivityIndicator size="small" color={applyTextColor} />
            <Text style={[styles.applyText, { color: applyTextColor }]}>
              Aplicando…
            </Text>
          </>
        ) : (
          <Text style={[styles.applyText, { color: applyTextColor }]}>
            Aplicar
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
  pwmValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  note: {
    fontSize: 12,
  },
  draftNote: {
    fontSize: 12,
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
  stepper: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  stepButton: {
    minWidth: 56,
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "700",
  },
  presets: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  presetButton: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  presetText: {
    fontSize: 13,
    fontWeight: "600",
  },
  applyButton: {
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
  applyText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
