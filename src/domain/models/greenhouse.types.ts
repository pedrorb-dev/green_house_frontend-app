export type PhotoperiodState = "DAY" | "NIGHT";
export type GateMode = "AUTO" | "OPEN" | "CLOSED";

export interface TelemetryDTO {
  // DHT11
  temperatureC: number;
  humidityPct: number;
  dhtOk: boolean;
  // Suelo capacitivo
  soilMoisturePct: number; // 0..100 calibrado
  soilRaw: number; // 0..4000 ADC
  // Fotoperiodo
  photoperiodState: PhotoperiodState;
  secondsToPhotoperiodChange: number;
  // Proximidad + compuerta (HC-SR04 + Servo)
  proximityDistanceCm: number;
  gateMode: GateMode;
  gateOpen: boolean; // true = Abierta 45°, false = Cerrada 0°
  // Actuadores
  fanActive: boolean; // true en DAY, false en NIGHT
  fanPwm: number; // 230..245 (velocidad configurada)
  lightPwm: number; // 0..255
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
  // Umbrales configurables
  targetMoisturePct: number; // 65
  hysteresisPct: number; // 10 (enciende por debajo de 65 - 10 = 55%)
}

export type CommandDTO =
  | { type: "SET_FAN_PWM"; value: number }
  | { type: "SET_LIGHT_PWM"; value: number }
  | { type: "SET_GATE_MODE"; value: GateMode }
  | { type: "WATER_PUMP" }
  | {
      type: "SET_THRESHOLDS";
      targetMoisturePct: number;
      hysteresisPct: number;
    };

// Respuesta del backend (o del mock) con el estado de conexión del ESP32
export interface TelemetryResponse {
  telemetry: TelemetryDTO;
  deviceOnline: boolean; // de la cabecera X-Device-Online
}

// Contratos del backend aún sin UI (SPEC 06)
export type HistoryRange = "1h" | "6h" | "24h" | "7d";

export interface TelemetryHistoryPoint {
  timestamp: string; // ISO-8601 (Instant)
  temperatureC: number | null;
  humidityPct: number | null;
  soilMoisturePct: number | null;
  lightPwm: number | null;
  fanPwm: number | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  deviceOnline: boolean;
  lastTelemetryAt: string | null;
}

export interface ErrorResponse {
  error: string; // código estable del backend
  message: string; // descripción técnica
  timestamp: string;
}

export const PWM = {
  FAN_MIN: 230,
  FAN_MAX: 245,
  LIGHT_MIN: 0,
  LIGHT_MAX: 255,
} as const;
export const PUMP = { COOLDOWN_SEC: 30, MAX_RUN_SEC: 10 } as const;
export const SOIL = {
  RAW_DRY: 4000,
  RAW_WET: 0,
  DEFAULT_TARGET_PCT: 65,
  DEFAULT_HYSTERESIS_PCT: 10,
} as const;
export const PHOTOPERIOD = { DAY_HOURS: 13, NIGHT_HOURS: 11 } as const;
export const GATE = {
  PROXIMITY_THRESHOLD_CM: 10,
  OPEN_ANGLE_DEG: 45,
  CLOSED_ANGLE_DEG: 0,
} as const;
