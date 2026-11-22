import { StyleSheet, Text, View } from "react-native";

import { AppColors, Spacing } from "@/constants/theme";
import { PWM, type PhotoperiodState } from "@/domain/models/greenhouse.types";
import { formatClock, formatPhotoperiod, lightPwmToPercent } from "./format";
import { SensorCard } from "./SensorCard";

interface PhotoperiodCardProps {
  photoperiodState: PhotoperiodState;
  secondsToPhotoperiodChange: number;
  lightPwm: number;
  fanActive: boolean;
  fanPwm: number;
}

export function PhotoperiodCard({
  photoperiodState,
  secondsToPhotoperiodChange,
  lightPwm,
  fanActive,
  fanPwm,
}: PhotoperiodCardProps) {
  const colors = AppColors;
  const isDay = photoperiodState === "DAY";

  return (
    <SensorCard
      title="Fotoperiodo"
      icon={isDay ? "sunny-outline" : "moon-outline"}
    >
      <View style={styles.phase}>
        <Text style={[styles.phaseText, { color: colors.text }]}>
          {formatPhotoperiod(photoperiodState)}
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          Cambio en {formatClock(secondsToPhotoperiodChange)}
        </Text>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Foco
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {lightPwm}/{PWM.LIGHT_MAX} · {lightPwmToPercent(lightPwm)}%
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Ventilador
          </Text>
          <Text
            style={[
              styles.value,
              { color: fanActive ? colors.primary : colors.textSecondary },
            ]}
          >
            {fanActive ? "Encendido" : "Apagado"} · PWM {fanPwm}
          </Text>
        </View>
      </View>
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  phase: {
    gap: Spacing.one,
  },
  phaseText: {
    fontSize: 18,
    fontWeight: "700",
  },
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
});
