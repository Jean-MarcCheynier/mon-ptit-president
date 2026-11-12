import {
  ErrorCode,
  type GamePhase,
  type PhaseState,
  type PlayerPhaseDto,
  type PlayerPhasesDto,
} from '@presidency-bingo/shared';
import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { ApiRequestError, api } from './api';
import { useIsPast } from './time';

/** The user's phases of the current election, in order; empty when there is no election. */
export const phasesQuery = queryOptions({
  queryKey: ['elections', 'current', 'phases'],
  queryFn: async (): Promise<PlayerPhaseDto[]> => {
    try {
      return (await api<PlayerPhasesDto>('/elections/current/phases')).phases;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION) {
        return [];
      }
      throw error;
    }
  },
});

/** Whether the user can open the phase: reachable, or closed and readable. */
export const isReachable = (state: PhaseState) => state !== 'UPCOMING';

/** Whether the user can still write their prediction of the phase. */
export const isWritable = (state: PhaseState) => state === 'TODO' || state === 'DONE';

/** The phase to put forward: the first one with nothing validated yet. */
export function nextPhase(phases: PlayerPhaseDto[]): GamePhase | null {
  return phases.find((p) => p.playable && p.state === 'TODO')?.phase ?? null;
}

/**
 * A phase's state: as reported by the server, or closed since its closing passed while the page
 * was open. A refused write refetches the phases (see query-client), which fixes a skewed local
 * clock; the next phase opening at that closing waits for that refetch.
 */
export function usePhaseState(phase: PlayerPhaseDto | undefined): PhaseState {
  const closed = useIsPast(phase?.closesAt ?? undefined);
  const state = phase?.state ?? 'UPCOMING';
  if (closed && state === 'DONE') return 'CLOSED';
  if (closed && state === 'TODO') return 'SKIPPED';
  return state;
}

/** Route guard: back to the journey when the phase isn't reachable yet. */
export async function requirePhase(queryClient: QueryClient, phase: GamePhase): Promise<void> {
  const phases = await queryClient.query(phasesQuery);
  const state = phases.find((p) => p.phase === phase)?.state;
  // No election: the page says so itself.
  if (phases.length > 0 && (state === undefined || !isReachable(state))) {
    throw redirect({ to: '/' });
  }
}
