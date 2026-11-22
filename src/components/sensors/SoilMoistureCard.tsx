import { StyleSheet, Text, View } from "react-native";

import { AppColors, Spacing } from "@/constants/theme";
import { SOIL } from "@/domain/models/greenhouse.types";
import { roundPercent, soilStateLabel } from "./format";
import { SensorCard } from "./SensorCard";

interface SoilMoistureCardProps {
  soilMoisturePct: number;
  soilRaw: number;
  targetMoisturePct?: number;
  hysteresisPct?: number;
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
}

export function SoilMoistureCard({
  soilMoisturePct,
  soilRaw,
  targetMoisturePct = SOIL.DEFAULT_TARGET_PCT,
  hysteresisPct = SOIL.DEFAULT_HYSTERESIS_PCT,
  pumpActive,
  pumpCooldownRemainingSec,
}: SoilMoistureCardProps) {
  const colors = AppColors;
  const moisture = roundPercent(soilMoisturePct);
  const target = roundPercent(targetMoisturePct);
  const turnOnThreshold = roundPercent(targetMoisturePct - hysteresisPct);
  const status = soilStateLabel({
    pumpActive,
    pumpCooldownRemainingSec,
    soilMoisturePct,
    targetMoisturePct,
    hysteresisPct,
  });

  return (
    <SensorCard title="Humedad del suelo" icon="water-outline">
      <View style={styles.readings}>
        <Text style={[styles.value, { color: colors.text }]}>{moisture}%</Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          Lectura cruda: {soilRaw} ADC
        </Text>
      </View>

      <View style={styles.barContainer}>
        <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
          <View
            style={[styles.fill, { width: `${moisture}%`, backgroundColor: colors.primary }]}
          />
        </View>
        <View
          style={[
            styles.mark,
            { left: `${turnOnThreshold}%`, backgroundColor: colors.textSecondary },
          ]}
        />
        <View
          style={[styles.mark, { left: `${target}%`, backgroundColor: colors.text }]}
        />
      </View>

      <View style={styles.legend}>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          Objetivo {target}%
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          Riego &lt; {turnOnThreshold}%
        </Text>
      </View>

      <Text style={[styles.status, { color: colors.text }]}>
        {status === "En espera de seguridad"
          ? `${status} (${pumpCooldownRemainingSec}s)`
          : status}
      </Text>
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  readings: {
    gap: Spacing.one,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
  },
  detail: {
    fontSize: 12,
  },
  barContainer: {
    position: "relative",
    height: 16,
    justifyContent: "center",
  },
  track: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 6,
  },
  mark: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 16,
    borderRadius: 1,
    transform: [{ translateX: -1 }],
  },
  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
  },
});
