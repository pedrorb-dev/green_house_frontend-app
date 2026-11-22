import {
  GATE,
  PWM,
  type GateMode,
  type PhotoperiodState,
} from "@/domain/models/greenhouse.types";

export type SoilStateLabel =
  | "Óptimo"
  | "Seco / Riego pendiente"
  | "Regando"
  | "En espera de seguridad";

/** Temperatura con un decimal y unidad, p. ej. "25.4 °C". */
export function formatCelsius(celsius: number): string {
  return `${celsius.toFixed(1)} °C`;
}

/** Duración en segundos como "HH:MM:SS" (cero si el valor es negativo). */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Entero 0..100 listo para pintar, sin artefactos de coma flotante. */
export function roundPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** PWM del foco (0..255) como porcentaje 0..100. */
export function lightPwmToPercent(lightPwm: number): number {
  return roundPercent((lightPwm / PWM.LIGHT_MAX) * 100);
}

/** Estado físico de la compuerta con su ángulo. */
export function formatGateOpen(gateOpen: boolean): string {
  return gateOpen
    ? `Abierta (${GATE.OPEN_ANGLE_DEG}°)`
    : `Cerrada (${GATE.CLOSED_ANGLE_DEG}°)`;
}

const GATE_MODE_LABELS: Record<GateMode, string> = {
  AUTO: "Automático",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
};

export function formatGateMode(gateMode: GateMode): string {
  return GATE_MODE_LABELS[gateMode];
}

const PHOTOPERIOD_LABELS: Record<PhotoperiodState, string> = {
  DAY: "Día · Luz activa",
  NIGHT: "Noche · Reposo",
};

export function formatPhotoperiod(state: PhotoperiodState): string {
  return PHOTOPERIOD_LABELS[state];
}

/** Etiqueta de humedad del suelo según precedencia: riego → cooldown → seco → óptimo. */
export function soilStateLabel(args: {
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
  soilMoisturePct: number;
  targetMoisturePct: number;
  hysteresisPct: number;
}): SoilStateLabel {
  const {
    pumpActive,
    pumpCooldownRemainingSec,
    soilMoisturePct,
    targetMoisturePct,
    hysteresisPct,
  } = args;

  if (pumpActive) return "Regando";
  if (pumpCooldownRemainingSec > 0) return "En espera de seguridad";
  if (soilMoisturePct < targetMoisturePct - hysteresisPct) {
    return "Seco / Riego pendiente";
  }
  return "Óptimo";
}
