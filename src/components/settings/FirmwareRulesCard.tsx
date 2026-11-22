import { Ionicons } from "@expo/vector-icons";
import type * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import {
  GATE,
  PHOTOPERIOD,
  PUMP,
  PWM,
} from "@/domain/models/greenhouse.types";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface FirmwareRule {
  icon: IconName;
  label: string;
  value: string;
}

const RULES: readonly FirmwareRule[] = [
  {
    icon: "sunny-outline",
    label: "Fotoperiodo",
    value: `${PHOTOPERIOD.DAY_HOURS} h de luz / ${PHOTOPERIOD.NIGHT_HOURS} h de oscuridad`,
  },
  {
    icon: "water-outline",
    label: "Bomba",
    value: `Riego máx. ${PUMP.MAX_RUN_SEC} s / espera de seguridad ${PUMP.COOLDOWN_SEC} s`,
  },
  {
    icon: "speedometer-outline",
    label: "Ventilador",
    value: `PWM ${PWM.FAN_MIN}–${PWM.FAN_MAX} · protección de voltaje del ESP32`,
  },
  {
    icon: "locate-outline",
    label: "Sensor ultrasónico",
    value: `Compuerta automática cuando la distancia es < ${GATE.PROXIMITY_THRESHOLD_CM} cm`,
  },
];

export function FirmwareRulesCard() {
  const colors = AppColors;

  return (
    <SensorCard title="Reglas del firmware" icon="document-text-outline">
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Referencia de solo lectura del firmware ESP32; los umbrales ajustables
        están en la tarjeta de umbrales.
      </Text>
      <View style={styles.rules}>
        {RULES.map((rule) => (
          <View key={rule.label} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={rule.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.ruleBody}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {rule.label}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {rule.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 12,
  },
  rules: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  icon: {
    width: 24,
    alignItems: "center",
  },
  ruleBody: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  label: {
    fontSize: 12,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
  },
});
