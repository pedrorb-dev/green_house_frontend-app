import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { roundPercent } from "@/components/sensors/format";
import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import {
  GATE,
  PHOTOPERIOD,
  type PhotoperiodState,
} from "@/domain/models/greenhouse.types";
import { mockEngine } from "@/services/mock/mock.service";

interface SimulationDebugCardProps {
  dhtOk: boolean;
  photoperiodState: PhotoperiodState;
  proximityDistanceCm: number;
  soilMoisturePct: number;
}

export function SimulationDebugCard({
  dhtOk,
  photoperiodState,
  proximityDistanceCm,
  soilMoisturePct,
}: SimulationDebugCardProps) {
  const colors = AppColors;
  const queryClient = useQueryClient();

  const run = (action: () => void) => {
    action();
    // Misma clave literal que TELEMETRY_KEY en useGreenhouse.ts.
    void queryClient.invalidateQueries({ queryKey: ["telemetry"] });
  };

  const proximityNear = proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM;
  const photoperiodHours =
    photoperiodState === "DAY"
      ? PHOTOPERIOD.DAY_HOURS
      : PHOTOPERIOD.NIGHT_HOURS;

  return (
    <SensorCard title="Panel de pruebas · simulador local" icon="bug-outline">
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Estos botones afectan solo al mockEngine de esta sesión; no envían
        comandos al invernadero real.
      </Text>

      <View style={styles.section}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Ultrasónico
          </Text>
          <Text
            style={[
              styles.value,
              { color: proximityNear ? colors.primary : colors.text },
            ]}
          >
            {`${proximityDistanceCm.toFixed(1)} cm${
              proximityNear ? ` · objeto cerca (< ${GATE.PROXIMITY_THRESHOLD_CM} cm)` : ""
            }`}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => run(() => mockEngine.setProximityNear())}
            accessibilityRole="button"
            accessibilityLabel="Simular objeto cerca"
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.backgroundElement },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>
              {`Simular objeto cerca (< ${GATE.PROXIMITY_THRESHOLD_CM} cm)`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => run(() => mockEngine.setProximityFar())}
            accessibilityRole="button"
            accessibilityLabel="Simular área despejada"
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.backgroundElement },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>
              {`Simular área despejada (≥ ${GATE.PROXIMITY_THRESHOLD_CM} cm)`}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Sustrato
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {`${roundPercent(soilMoisturePct)} %`}
          </Text>
        </View>
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Dispara el riego automático; observa el cooldown en Dashboard/Controls.
        </Text>
        <Pressable
          onPress={() => run(() => mockEngine.forceSoilDry())}
          accessibilityRole="button"
          accessibilityLabel="Forzar suelo seco"
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.backgroundElement },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>
            Forzar suelo seco
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Fotoperiodo
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {`${photoperiodState} · ${photoperiodHours} h`}
          </Text>
        </View>
        <Pressable
          onPress={() => run(() => mockEngine.togglePhotoperiod())}
          accessibilityRole="button"
          accessibilityLabel="Alternar Día / Noche"
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.backgroundElement },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>
            Alternar Día / Noche
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.detailRow}>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Sensor DHT11
          </Text>
          <View style={styles.status}>
            <Ionicons
              name={dhtOk ? "checkmark-circle-outline" : "warning-outline"}
              size={16}
              color={dhtOk ? colors.primary : colors.text}
            />
            <Text style={[styles.value, { color: colors.text }]}>
              {dhtOk ? "OK" : "En fallo"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => run(() => mockEngine.setSensorFault(dhtOk))}
          accessibilityRole="button"
          accessibilityLabel="Alternar fallo del sensor DHT11"
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.backgroundElement },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>
            {dhtOk ? "Simular fallo DHT11" : "Restaurar sensor DHT11"}
          </Text>
        </Pressable>
      </View>
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 12,
  },
  section: {
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
    textAlign: "right",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 130,
    alignItems: "center",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
