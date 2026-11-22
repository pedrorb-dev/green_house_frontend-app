import type {
  CommandDTO,
  ErrorResponse,
  HealthResponse,
  HistoryRange,
  TelemetryDTO,
  TelemetryHistoryPoint,
  TelemetryResponse,
} from "@/domain/models/greenhouse.types";
import type { GreenhouseRepository } from "@/domain/repositories/greenhouse.repo";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const USER_MESSAGES: Record<string, string> = {
  TELEMETRY_NOT_AVAILABLE: "Esperando la primera lectura del ESP32…",
  COMMAND_REJECTED: "La bomba está regando o en espera de seguridad (30 s).",
  MQTT_PUBLISH_ERROR: "Se perdió la comunicación con el broker MQTT.",
  INVALID_COMMAND: "Comando inválido: revisa los valores.",
  VALIDATION_FAILED: "Comando inválido: revisa los valores.",
  BAD_REQUEST: "Comando inválido: revisa los valores.",
  INFLUX_QUERY_ERROR: "Error al consultar el histórico.",
};

const FALLBACK_MESSAGE = "No se pudo conectar con el servidor.";

export function getUserFacingMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return USER_MESSAGES[error.code] ?? FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorResponse | null = null;
  try {
    body = (await response.json()) as ErrorResponse;
  } catch {
    // El servidor puede responder sin cuerpo JSON.
  }
  return new ApiError(
    body?.message ?? response.statusText,
    response.status,
    body?.error ?? "",
  );
}

export function createApiGreenhouseRepository({ baseUrl }: { baseUrl: string }):
  GreenhouseRepository & {
    getHealth(): Promise<HealthResponse>;
    getTelemetryHistory(range: HistoryRange): Promise<TelemetryHistoryPoint[]>;
  } {
  const root = baseUrl.replace(/\/+$/, "");
  const endpoint = (path: string) => `${root}${path}`;

  return {
    async getTelemetry(): Promise<TelemetryResponse> {
      const response = await fetch(endpoint("/api/v1/greenhouse/telemetry"));
      if (!response.ok) throw await toApiError(response);

      const telemetry = (await response.json()) as TelemetryDTO;
      return {
        telemetry,
        deviceOnline: response.headers.get("X-Device-Online") === "true",
      };
    },

    async sendCommand(command: CommandDTO): Promise<CommandDTO> {
      const response = await fetch(endpoint("/api/v1/greenhouse/commands"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) throw await toApiError(response);

      return (await response.json()) as CommandDTO;
    },

    async getHealth(): Promise<HealthResponse> {
      const response = await fetch(endpoint("/api/v1/health"));
      if (!response.ok) throw await toApiError(response);

      return (await response.json()) as HealthResponse;
    },

    async getTelemetryHistory(
      range: HistoryRange,
    ): Promise<TelemetryHistoryPoint[]> {
      const response = await fetch(
        endpoint(`/api/v1/greenhouse/telemetry/history?range=${range}`),
      );
      if (!response.ok) throw await toApiError(response);

      return (await response.json()) as TelemetryHistoryPoint[];
    },
  };
}
