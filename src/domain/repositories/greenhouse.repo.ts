import type {
  CommandDTO,
  TelemetryResponse,
} from "@/domain/models/greenhouse.types";

export interface GreenhouseRepository {
  getTelemetry(): Promise<TelemetryResponse>;
  sendCommand(command: CommandDTO): Promise<CommandDTO>;
}
