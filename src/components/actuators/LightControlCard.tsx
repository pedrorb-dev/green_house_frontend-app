import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { formatPhotoperiod, lightPwmToPercent } from "@/components/sensors/format";
import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import { PWM, type PhotoperiodState } from "@/domain/models/greenhouse.types";
import { useSendCommand } from "@/hooks/useGreenhouse";

const FOCO_PASO = 16;
const LIGHT_PRESETS = [
  { label: "0%", pwm: 0 },
  { label: "25%", pwm: 64 },
  { label: "50%", pwm: 128 },
  { label: "100%", pwm: 255 },
] as const;

interface LightControlCardProps {
  lightPwm: number;
  photoperiodState: PhotoperiodState;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function LightControlCard({
  lightPwm,
  photoperiodState,
}: LightControlCardProps) {
  const colors = AppColors;
  const { mutate, isPending, isError } = useSendCommand();
  const [draft, setDraft] = useState<number | null>(null);

  const value = draft ?? lightPwm;
  const percent = lightPwmToPercent(value);

  const change = (next: number) =>
    setDraft(clamp(next, PWM.LIGHT_MIN, PWM.LIGHT_MAX));

  const apply = () => {
    if (draft === null) return;
    mutate(
      { type: "SET_LIGHT_PWM", value: draft },
      { onSuccess: () => setDraft(null) },
    );
  };

  const applyDisabled = draft === null || isPending;
  const applyTextColor = applyDisabled ? colors.text : colors.onPrimary;

  return (
    <SensorCard title="Foco LED" icon="bulb-outline">
      <View style={styles.details}>
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
            PWM / intensidad
          </Text>
          <Text style={[styles.pwmValue, { color: colors.text }]}>
            {value} · {percent}%
          </Text>
        </View>
      </View>

      <Text style={[styles.note, { color: colors.textSecondary }]}>
        {`Rango ${PWM.LIGHT_MIN}–${PWM.LIGHT_MAX} · paso de ${FOCO_PASO} (firmware ESP32).`}
      </Text>

      {draft !== null && (
        <Text style={[styles.draftNote, { color: colors.primary }]}>
          {`Cambio pendiente: ${draft} PWM (${lightPwmToPercent(draft)}%)`}
        </Text>
      )}

      {isError && (
        <View
          style={[styles.alert, { backgroundColor: colors.backgroundElement }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.text} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            No se pudo aplicar la intensidad. El valor pendiente se conserva.
          </Text>
        </View>
      )}

      <View style={styles.stepper}>
        <Pressable
          onPress={() => change(value - FOCO_PASO)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Bajar intensidad del foco"
          style={({ pressed }) => [
            styles.stepButton,
            { backgroundColor: colors.backgroundElement },
            pressed && !isPending && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.stepText, { color: colors.text }]}>-16</Text>
        </Pressable>
        <Pressable
          onPress={() => change(value + FOCO_PASO)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Subir intensidad del foco"
          style={({ pressed }) => [
            styles.stepButton,
            { backgroundColor: colors.backgroundElement },
            pressed && !isPending && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.stepText, { color: colors.text }]}>+16</Text>
        </Pressable>
      </View>

      <View style={styles.presets}>
        {LIGHT_PRESETS.map((preset) => (
          <Pressable
            key={preset.pwm}
            onPress={() => change(preset.pwm)}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel={`Preset ${preset.label}`}
            style={({ pressed }) => [
              styles.presetButton,
              {
                backgroundColor:
                  value === preset.pwm
                    ? colors.backgroundSelected
                    : colors.backgroundElement,
              },
              pressed && !isPending && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.presetText,
                { color: value === preset.pwm ? colors.primary : colors.text },
              ]}
            >
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={apply}
        disabled={applyDisabled}
        accessibilityRole="button"
        accessibilityLabel="Aplicar intensidad del foco"
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
