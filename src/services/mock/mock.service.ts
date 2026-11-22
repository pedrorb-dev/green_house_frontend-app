import type { GreenhouseRepository } from "@/domain/repositories/greenhouse.repo";
import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";
import { MockEngine } from "@/services/mock/mock.engine";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

class MockGreenhouseService implements GreenhouseRepository {
  constructor(private readonly engine: MockEngine) {}

  async getTelemetry(): Promise<TelemetryDTO> {
    await delay(50 + Math.random() * 50);
    return this.engine.getSnapshot();
  }

  async sendCommand(command: CommandDTO): Promise<void> {
    await delay(50 + Math.random() * 50);
    this.engine.apply(command);
  }
}

const engine = new MockEngine();
engine.start();

export const greenhouseRepository: GreenhouseRepository =
  new MockGreenhouseService(engine);
export { engine as mockEngine };
