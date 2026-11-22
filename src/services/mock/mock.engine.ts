import type {
  CommandDTO,
  GateMode,
  PhotoperiodState,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";
import { GATE, PHOTOPERIOD, PUMP, PWM, SOIL } from "@/domain/models/greenhouse.types";

const EVAPORATION_PCT_PER_SEC = 0.2;
const IRRIGATION_PCT_PER_SEC = 2;

interface MockState {
  temperatureC: number;
  humidityPct: number;
  dhtOk: boolean;
  soilMoisturePct: number;
  soilRaw: number;
  photoperiodState: PhotoperiodState;
  secondsToPhotoperiodChange: number;
  proximityDistanceCm: number;
  gateMode: GateMode;
  gateOpen: boolean;
  fanActive: boolean;
  fanPwm: number;
  lightPwm: number;
  pumpActive: boolean;
  pumpRunRemainingSec: number;
  pumpCooldownRemainingSec: number;
  targetMoisturePct: number;
  hysteresisPct: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeSoilRaw(soilMoisturePct: number): number {
  return Math.round(SOIL.RAW_DRY * (1 - soilMoisturePct / 100));
}

function evaluateGateOpen(
  gateMode: GateMode,
  proximityDistanceCm: number,
): boolean {
  if (gateMode === "OPEN") return true;
  if (gateMode === "CLOSED") return false;
  return proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM;
}

export class MockEngine {
  private state: MockState;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private phaseTemp = 0;
  private phaseHum = 1.2;

  constructor() {
    const initialSoilMoisturePct = 50;
    const initialPhotoperiodState: PhotoperiodState = "DAY";
    this.state = {
      temperatureC: 25.5,
      humidityPct: 60,
      dhtOk: true,
      soilMoisturePct: initialSoilMoisturePct,
      soilRaw: computeSoilRaw(initialSoilMoisturePct),
      photoperiodState: initialPhotoperiodState,
      secondsToPhotoperiodChange: PHOTOPERIOD.DAY_HOURS * 3600,
      proximityDistanceCm: 50,
      gateMode: "AUTO",
      gateOpen: evaluateGateOpen("AUTO", 50),
      fanActive: initialPhotoperiodState === "DAY",
      fanPwm: 230,
      lightPwm: 0,
      pumpActive: false,
      pumpRunRemainingSec: 0,
      pumpCooldownRemainingSec: 0,
      targetMoisturePct: SOIL.DEFAULT_TARGET_PCT,
      hysteresisPct: SOIL.DEFAULT_HYSTERESIS_PCT,
    };
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getSnapshot(): TelemetryDTO {
    const s = this.state;
    return {
      temperatureC: s.temperatureC,
      humidityPct: s.humidityPct,
      dhtOk: s.dhtOk,
      soilMoisturePct: s.soilMoisturePct,
      soilRaw: s.soilRaw,
      photoperiodState: s.photoperiodState,
      secondsToPhotoperiodChange: s.secondsToPhotoperiodChange,
      proximityDistanceCm: s.proximityDistanceCm,
      gateMode: s.gateMode,
      gateOpen: s.gateOpen,
      fanActive: s.fanActive,
      fanPwm: s.fanPwm,
      lightPwm: s.lightPwm,
      pumpActive: s.pumpActive,
      pumpCooldownRemainingSec: s.pumpCooldownRemainingSec,
      targetMoisturePct: s.targetMoisturePct,
      hysteresisPct: s.hysteresisPct,
    };
  }

  apply(command: CommandDTO): void {
    const s = this.state;
    switch (command.type) {
      case "SET_FAN_PWM":
        s.fanPwm = clamp(command.value, PWM.FAN_MIN, PWM.FAN_MAX);
        break;
      case "SET_LIGHT_PWM":
        s.lightPwm = clamp(command.value, PWM.LIGHT_MIN, PWM.LIGHT_MAX);
        break;
      case "SET_GATE_MODE":
        s.gateMode = command.value;
        s.gateOpen = evaluateGateOpen(s.gateMode, s.proximityDistanceCm);
        break;
      case "WATER_PUMP":
        if (s.pumpCooldownRemainingSec > 0) return;
        if (s.pumpActive) return;
        s.pumpActive = true;
        s.pumpRunRemainingSec = PUMP.MAX_RUN_SEC;
        break;
      case "SET_THRESHOLDS": {
        const nextTarget = clamp(command.targetMoisturePct, 0, 100);
        s.targetMoisturePct = nextTarget;
        s.hysteresisPct = clamp(command.hysteresisPct, 0, nextTarget);
        // evaluate immediate auto irrigation
        if (
          !s.pumpActive &&
          s.pumpCooldownRemainingSec === 0 &&
          s.soilMoisturePct < s.targetMoisturePct - s.hysteresisPct
        ) {
          s.pumpActive = true;
          s.pumpRunRemainingSec = PUMP.MAX_RUN_SEC;
        }
        break;
      }
      default:
        break;
    }
  }

  // --- debug helpers (NOT part of GreenhouseRepository) ---
  setProximityNear(): void {
    this.state.proximityDistanceCm = Math.max(
      0,
      GATE.PROXIMITY_THRESHOLD_CM - 1,
    );
    this.state.gateOpen = evaluateGateOpen(
      this.state.gateMode,
      this.state.proximityDistanceCm,
    );
  }
  setProximityFar(): void {
    this.state.proximityDistanceCm = GATE.PROXIMITY_THRESHOLD_CM + 10;
    this.state.gateOpen = evaluateGateOpen(
      this.state.gateMode,
      this.state.proximityDistanceCm,
    );
  }
  forceSoilDry(): void {
    const s = this.state;
    const below = Math.max(0, s.targetMoisturePct - s.hysteresisPct - 1);
    s.soilMoisturePct = below;
    s.soilRaw = computeSoilRaw(s.soilMoisturePct);
  }
  togglePhotoperiod(): void {
    const s = this.state;
    if (s.photoperiodState === "DAY") {
      s.photoperiodState = "NIGHT";
      s.secondsToPhotoperiodChange = PHOTOPERIOD.NIGHT_HOURS * 3600;
    } else {
      s.photoperiodState = "DAY";
      s.secondsToPhotoperiodChange = PHOTOPERIOD.DAY_HOURS * 3600;
    }
    s.fanActive = s.photoperiodState === "DAY";
  }
  setSensorFault(fault: boolean): void {
    this.state.dhtOk = !fault;
  }

  private tick(): void {
    const s = this.state;

    // 1) Clima DHT11
    if (s.dhtOk) {
      this.phaseTemp += 0.02;
      this.phaseHum += 0.015;
      s.temperatureC =
        Math.round((25.5 + 1.5 * Math.sin(this.phaseTemp)) * 10) / 10;
      s.humidityPct =
        Math.round((60 + 5 * Math.sin(this.phaseHum)) * 10) / 10;
      s.temperatureC = clamp(s.temperatureC, 24, 27);
      s.humidityPct = clamp(s.humidityPct, 55, 65);
    }

    // 7) Photoperiod
    s.secondsToPhotoperiodChange -= 1;
    if (s.secondsToPhotoperiodChange <= 0) {
      if (s.photoperiodState === "DAY") {
        s.photoperiodState = "NIGHT";
        s.secondsToPhotoperiodChange = PHOTOPERIOD.NIGHT_HOURS * 3600;
      } else {
        s.photoperiodState = "DAY";
        s.secondsToPhotoperiodChange = PHOTOPERIOD.DAY_HOURS * 3600;
      }
    }
    s.fanActive = s.photoperiodState === "DAY";

    // 4) Pump run decrement
    if (s.pumpActive) {
      s.pumpRunRemainingSec -= 1;
    }
    if (
      s.pumpActive &&
      (s.soilMoisturePct >= s.targetMoisturePct || s.pumpRunRemainingSec <= 0)
    ) {
      s.pumpActive = false;
      s.pumpCooldownRemainingSec = PUMP.COOLDOWN_SEC;
    }

    // 5) Cooldown decrement
    if (s.pumpCooldownRemainingSec > 0) {
      s.pumpCooldownRemainingSec -= 1;
    }

    // 3) Auto irrigation start
    if (
      !s.pumpActive &&
      s.pumpCooldownRemainingSec === 0 &&
      s.soilMoisturePct < s.targetMoisturePct - s.hysteresisPct
    ) {
      s.pumpActive = true;
      s.pumpRunRemainingSec = PUMP.MAX_RUN_SEC;
    }

    // 2) Soil update
    if (s.pumpActive) {
      s.soilMoisturePct = clamp(
        s.soilMoisturePct + IRRIGATION_PCT_PER_SEC,
        0,
        100,
      );
    } else {
      s.soilMoisturePct = clamp(
        s.soilMoisturePct - EVAPORATION_PCT_PER_SEC,
        0,
        100,
      );
    }
    s.soilRaw = computeSoilRaw(s.soilMoisturePct);

    // 8) Gate evaluation
    s.gateOpen = evaluateGateOpen(s.gateMode, s.proximityDistanceCm);
  }
}
