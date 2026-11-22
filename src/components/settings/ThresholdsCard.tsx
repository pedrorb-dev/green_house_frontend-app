import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { roundPercent } from "@/components/sensors/format";
import { SensorCard } from "@/components/sensors/SensorCard";
import { AppColors, Spacing } from "@/constants/theme";
import { SOIL } from "@/domain/models/greenhouse.types";
import { useSendCommand } from "@/hooks/useGreenhouse";
import { getUserFacingMessage } from "@/services/api/api.service";

const INTEGER_PATTERN = /^\d+$/;
const TARGET_MIN = 10;
const TARGET_MAX = 95;
const TARGET_ERROR = "El objetivo debe ser un entero entre 10 y 95.";

interface ThresholdsCardProps {
  targetMoisturePct: number;
  hysteresisPct: number;
}

export function ThresholdsCard({
  targetMoisturePct,
  hysteresisPct,
}: ThresholdsCardProps) {
  const colors = AppColors;
  const { mutate, isPending, isError, error } = useSendCommand();
  const [draftTarget, setDraftTarget] = useState<string | null>(null);
  const [draftHysteresis, setDraftHysteresis] = useState<string | null>(null);

  const targetText = draftTarget ?? String(targetMoisturePct);
  const hysteresisText = draftHysteresis ?? String(hysteresisPct);

  const parsedTarget = INTEGER_PATTERN.test(targetText) ? Number(targetText) : NaN;
  const targetIsValid =
    Number.isInteger(parsedTarget) &&
    parsedTarget >= TARGET_MIN &&
    parsedTarget <= TARGET_MAX;

  // Con el objetivo inválido se valida contra el valor vigente para no mostrar un límite absurdo.
  const referenceTarget = targetIsValid ? parsedTarget : targetMoisturePct;
  const hysteresisMax = referenceTarget - 1;
  const parsedHysteresis = INTEGER_PATTERN.test(hysteresisText)
    ? Number(hysteresisText)
    : NaN;
  const hysteresisIsValid =
    Number.isInteger(parsedHysteresis) &&
    parsedHysteresis >= 1 &&
    parsedHysteresis <= hysteresisMax;

  const targetError = targetIsValid ? null : TARGET_ERROR;
  const hysteresisError = hysteresisIsValid
    ? null
    : `La histéresis debe ser un entero entre 1 y ${hysteresisMax}.`;

  const currentTurnOnPct = roundPercent(targetMoisturePct - hysteresisPct);
  const previewTurnOnPct =
    targetIsValid && hysteresisIsValid ? parsedTarget - parsedHysteresis : null;

  const clearDrafts = () => {
    setDraftTarget(null);
    setDraftHysteresis(null);
  };

  const noChanges =
    parsedTarget === targetMoisturePct && parsedHysteresis === hysteresisPct;
  const saveDisabled =
    !targetIsValid || !hysteresisIsValid || noChanges || isPending;

  const save = () => {
    if (saveDisabled) return;
    mutate(
      {
        type: "SET_THRESHOLDS",
        targetMoisturePct: parsedTarget,
        hysteresisPct: parsedHysteresis,
      },
      { onSuccess: clearDrafts },
    );
  };

  const restore = () => {
    mutate(
      {
        type: "SET_THRESHOLDS",
        targetMoisturePct: SOIL.DEFAULT_TARGET_PCT,
        hysteresisPct: SOIL.DEFAULT_HYSTERESIS_PCT,
      },
      { onSuccess: clearDrafts },
    );
  };

  return (
    <SensorCard title="Umbrales de riego" icon="options-outline">
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          Objetivo de humedad (%)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: colors.backgroundElement,
              backgroundColor: colors.onPrimary,
              color: colors.text,
            },
          ]}
          value={targetText}
          onChangeText={setDraftTarget}
          keyboardType="number-pad"
          editable={!isPending}
          accessibilityLabel="Objetivo de humedad (%)"
        />
        {targetError && (
          <Text style={[styles.errorText, { color: colors.text }]}>
            {targetError}
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          Margen de histéresis (%)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: colors.backgroundElement,
              backgroundColor: colors.onPrimary,
              color: colors.text,
            },
          ]}
          value={hysteresisText}
          onChangeText={setDraftHysteresis}
          keyboardType="number-pad"
          editable={!isPending}
          accessibilityLabel="Margen de histéresis (%)"
        />
        {hysteresisError && (
          <Text style={[styles.errorText, { color: colors.text }]}>
            {hysteresisError}
          </Text>
        )}
      </View>

      {previewTurnOnPct === null ? (
        <Text style={[styles.previewMuted, { color: colors.textSecondary }]}>
          Introduce valores válidos para ver la vista previa.
        </Text>
      ) : (
        <View
          style={[
            styles.preview,
            { backgroundColor: colors.backgroundElement },
          ]}
        >
          <Ionicons name="water-outline" size={16} color={colors.primary} />
          <View style={styles.previewBody}>
            <Text style={[styles.previewText, { color: colors.text }]}>
              {`La bomba se encenderá debajo de ${previewTurnOnPct}%.`}
            </Text>
            {previewTurnOnPct !== currentTurnOnPct && (
              <Text style={[styles.previewCurrent, { color: colors.textSecondary }]}>
                {`Umbral vigente: ${currentTurnOnPct}%.`}
              </Text>
            )}
          </View>
        </View>
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

      <Pressable
        onPress={save}
        disabled={saveDisabled}
        accessibilityRole="button"
        accessibilityLabel="Guardar umbrales"
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: saveDisabled
              ? colors.backgroundElement
              : colors.primary,
          },
          pressed && !saveDisabled && styles.buttonPressed,
        ]}
      >
        {isPending ? (
          <>
            <ActivityIndicator
              size="small"
              color={saveDisabled ? colors.text : colors.onPrimary}
            />
            <Text
              style={[
                styles.buttonText,
                { color: saveDisabled ? colors.text : colors.onPrimary },
              ]}
            >
              Guardando…
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.buttonText,
              { color: saveDisabled ? colors.text : colors.onPrimary },
            ]}
          >
            Guardar umbrales
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={restore}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel="Restaurar cultivo base"
        style={({ pressed }) => [
          styles.restoreButton,
          { backgroundColor: colors.backgroundElement },
          pressed && !isPending && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>
          {`Restaurar cultivo base (${SOIL.DEFAULT_TARGET_PCT}% / ${SOIL.DEFAULT_HYSTERESIS_PCT}%)`}
        </Text>
      </Pressable>
    </SensorCard>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
  },
  preview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 8,
  },
  previewBody: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  previewText: {
    fontSize: 12,
    fontWeight: "600",
  },
  previewCurrent: {
    fontSize: 11,
  },
  previewMuted: {
    fontSize: 12,
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
  saveButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  restoreButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
