import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AccessGateCard } from "@/components/sensors/AccessGateCard";
import { ClimateCard } from "@/components/sensors/ClimateCard";
import { PhotoperiodCard } from "@/components/sensors/PhotoperiodCard";
import { SoilMoistureCard } from "@/components/sensors/SoilMoistureCard";
import {
  AppColors,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { useTelemetry } from "@/hooks/useGreenhouse";

/** Punto verde del badge: la fuente es el mock, no una conexión real. */
const LIVE_DOT_COLOR = "#22C55E";

export default function DashboardScreen() {
  const colors = AppColors;
  const { data, isLoading, isError, refetch } = useTelemetry();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Dashboard</Text>
        </View>

        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
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

            <Pressable
              onPress={() => refetch()}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.retryText, { color: colors.onPrimary }]}>
                Reintentar
              </Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            <View style={styles.grid}>
              <ClimateCard
                temperatureC={data.temperatureC}
                humidityPct={data.humidityPct}
                dhtOk={data.dhtOk}
              />
              <SoilMoistureCard
                soilMoisturePct={data.soilMoisturePct}
                soilRaw={data.soilRaw}
                targetMoisturePct={data.targetMoisturePct}
                hysteresisPct={data.hysteresisPct}
                pumpActive={data.pumpActive}
                pumpCooldownRemainingSec={data.pumpCooldownRemainingSec}
              />
              <PhotoperiodCard
                photoperiodState={data.photoperiodState}
                secondsToPhotoperiodChange={data.secondsToPhotoperiodChange}
                lightPwm={data.lightPwm}
                fanActive={data.fanActive}
                fanPwm={data.fanPwm}
              />
              <AccessGateCard
                proximityDistanceCm={data.proximityDistanceCm}
                gateOpen={data.gateOpen}
                gateMode={data.gateMode}
              />
            </View>
          </>
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
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
});
