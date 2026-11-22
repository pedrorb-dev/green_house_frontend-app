import type { GreenhouseRepository } from "@/domain/repositories/greenhouse.repo";
import type {
  CommandDTO,
  TelemetryResponse,
} from "@/domain/models/greenhouse.types";
import { MockEngine } from "@/services/mock/mock.engine";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

class MockGreenhouseService implements GreenhouseRepository {
  constructor(private readonly engine: MockEngine) {}

  async getTelemetry(): Promise<TelemetryResponse> {
    await delay(50 + Math.random() * 50);
    return { telemetry: this.engine.getSnapshot(), deviceOnline: true };
  }

  async sendCommand(command: CommandDTO): Promise<CommandDTO> {
    await delay(50 + Math.random() * 50);
    this.engine.apply(command);
    return command;
  }
}

const engine = new MockEngine();

/** Arranca el motor de forma perezosa: en modo API no se crea ningún intervalo. */
export function createMockGreenhouseRepository(): GreenhouseRepository {
  engine.start();
  return new MockGreenhouseService(engine);
}

export { engine as mockEngine };
