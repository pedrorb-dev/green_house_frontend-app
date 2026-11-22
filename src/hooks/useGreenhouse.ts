import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { greenhouseRepository } from "@/services/mock/mock.service";
import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";

const TELEMETRY_KEY = ["telemetry"] as const;

export function useTelemetry(): UseQueryResult<TelemetryDTO, Error> {
  return useQuery({
    queryKey: TELEMETRY_KEY,
    queryFn: () => greenhouseRepository.getTelemetry(),
    refetchInterval: 2000,
  });
}

export function useSendCommand(): UseMutationResult<
  void,
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
