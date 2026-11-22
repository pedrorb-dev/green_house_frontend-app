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

export default function DashboardScreen() {
  const colors = AppColors;
  const { data, isLoading, isError, error, refetch } = useTelemetry();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Dashboard</Text>
          <ConnectionBadge isMock={isMock} deviceOnline={data?.deviceOnline} />
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
            <Text style={[styles.errorText, { color: colors.text }]}>
              {getUserFacingMessage(error)}
            </Text>

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
                temperatureC={data.telemetry.temperatureC}
                humidityPct={data.telemetry.humidityPct}
                dhtOk={data.telemetry.dhtOk}
              />
              <SoilMoistureCard
                soilMoisturePct={data.telemetry.soilMoisturePct}
                soilRaw={data.telemetry.soilRaw}
                targetMoisturePct={data.telemetry.targetMoisturePct}
                hysteresisPct={data.telemetry.hysteresisPct}
                pumpActive={data.telemetry.pumpActive}
                pumpCooldownRemainingSec={data.telemetry.pumpCooldownRemainingSec}
              />
              <PhotoperiodCard
                photoperiodState={data.telemetry.photoperiodState}
                secondsToPhotoperiodChange={data.telemetry.secondsToPhotoperiodChange}
                lightPwm={data.telemetry.lightPwm}
                fanActive={data.telemetry.fanActive}
                fanPwm={data.telemetry.fanPwm}
              />
              <AccessGateCard
                proximityDistanceCm={data.telemetry.proximityDistanceCm}
                gateOpen={data.telemetry.gateOpen}
                gateMode={data.telemetry.gateMode}
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
