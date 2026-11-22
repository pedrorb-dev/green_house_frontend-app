import type { GreenhouseRepository } from "@/domain/repositories/greenhouse.repo";
import { createApiGreenhouseRepository } from "@/services/api/api.service";
import { createMockGreenhouseRepository } from "@/services/mock/mock.service";

export const isMock = process.env.EXPO_PUBLIC_USE_MOCK === "true";
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export const greenhouseRepository: GreenhouseRepository = isMock
  ? createMockGreenhouseRepository()
  : createApiGreenhouseRepository({ baseUrl: API_URL });

export { mockEngine } from "@/services/mock/mock.service";
