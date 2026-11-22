import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppColors, Spacing } from "@/constants/theme";
import { formatCelsius, roundPercent } from "./format";
import { SensorCard } from "./SensorCard";

interface ClimateCardProps {
  temperatureC: number;
  humidityPct: number;
  dhtOk: boolean;
}

export function ClimateCard({
  temperatureC,
  humidityPct,
  dhtOk,
}: ClimateCardProps) {
  const colors = AppColors;

  return (
    <SensorCard title="Clima" icon="thermometer-outline">
      <View style={styles.readings}>
        <View style={styles.reading}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Temperatura
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatCelsius(temperatureC)}
          </Text>
        </View>
        <View style={styles.reading}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Humedad
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {roundPercent(humidityPct)} % HR
          </Text>
        </View>
      </View>

      {!dhtOk && (
        <View
          style={[styles.alert, { backgroundColor: colors.backgroundElement }]}
        >
          <Ionicons name="warning-outline" size={16} color={colors.text} />
          <Text style={[styles.alertText, { color: colors.text }]}>
            Fallo de lectura: se muestran los últimos valores retenidos.
          </Text>
        </View>
      )}
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  readings: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.four,
  },
  reading: {
    flexGrow: 1,
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
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
