import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type {
  CommandDTO,
  TelemetryResponse,
} from "@/domain/models/greenhouse.types";
import { greenhouseRepository } from "@/services";

const TELEMETRY_KEY = ["telemetry"] as const;

export function useTelemetry(): UseQueryResult<TelemetryResponse, Error> {
  return useQuery({
    queryKey: TELEMETRY_KEY,
    queryFn: () => greenhouseRepository.getTelemetry(),
    refetchInterval: 2000,
    retry: false,
  });
}

export function useSendCommand(): UseMutationResult<
  CommandDTO,
  Error,
  CommandDTO,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CommandDTO) =>
      greenhouseRepository.sendCommand(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TELEMETRY_KEY }),
  });
}
