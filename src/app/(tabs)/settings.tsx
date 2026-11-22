import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FirmwareRulesCard } from "@/components/settings/FirmwareRulesCard";
import { SimulationDebugCard } from "@/components/settings/SimulationDebugCard";
import { ThresholdsCard } from "@/components/settings/ThresholdsCard";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import {
  AppColors,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useTelemetry } from "@/hooks/useGreenhouse";
import { isMock } from "@/services";
import { getUserFacingMessage } from "@/services/api/api.service";

export default function SettingsScreen() {
  const colors = AppColors;
  const { data, isLoading, isError, error, refetch } = useTelemetry();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <ConnectionBadge isMock={isMock} deviceOnline={data?.deviceOnline} />
        </View>

        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>
              Cargando telemetría…
            </Text>
          </View>
        ) : isError ? (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.backgroundElement },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={colors.text}
            />
            <Text style={[styles.errorText, { color: colors.text }]}>
              {getUserFacingMessage(error)}
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <Text style={[styles.retryText, { color: colors.onPrimary }]}>
                Reintentar
              </Text>
            </Pressable>
          </View>
        ) : data ? (
          <View style={styles.grid}>
            <ThresholdsCard
              targetMoisturePct={data.telemetry.targetMoisturePct}
              hysteresisPct={data.telemetry.hysteresisPct}
            />
            {isMock ? (
              <SimulationDebugCard
                dhtOk={data.telemetry.dhtOk}
                photoperiodState={data.telemetry.photoperiodState}
                proximityDistanceCm={data.telemetry.proximityDistanceCm}
                soilMoisturePct={data.telemetry.soilMoisturePct}
              />
            ) : null}
            <FirmwareRulesCard />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
  },
  scroll: {
    width: "100%",
  },
  content: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  stateContainer: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  stateText: {
    fontSize: 13,
  },
  errorCard: {
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
});
