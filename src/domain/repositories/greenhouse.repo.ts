import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";

export interface GreenhouseRepository {
  getTelemetry(): Promise<TelemetryDTO>;
  sendCommand(command: CommandDTO): Promise<void>;
}
