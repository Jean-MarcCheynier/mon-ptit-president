import {
  type CurrentElectionDto,
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

/** What a phase offers to do from the journey. */
export type PhaseAction = 'PREDICT' | 'RESUME' | 'EDIT' | 'VIEW' | 'RESULTS';

/**
 * A phase's action, by its state: predict, resume the draft or edit while writable, view once
 * closed, see the results once published; none when skipped or not reachable yet.
 */
export function phaseAction(
  state: PhaseState,
  { draft = false, results = false }: { draft?: boolean; results?: boolean } = {},
): PhaseAction | null {
  if (results) return 'RESULTS';
  switch (state) {
    case 'TODO':
      return draft ? 'RESUME' : 'PREDICT';
    case 'DONE':
      return draft ? 'RESUME' : 'EDIT';
    case 'CLOSED':
      return 'VIEW';
    default:
      return null;
  }
}

/** Whether the action writes the prediction, before the phase's closing. */
export const isWriting = (action: PhaseAction) =>
  action === 'PREDICT' || action === 'RESUME' || action === 'EDIT';

/** The phase to put forward: the first one with nothing validated yet. */
export function nextPhase(phases: PlayerPhaseDto[]): GamePhase | null {
  return phases.find((p) => p.playable && p.state === 'TODO')?.phase ?? null;
}

/**
 * What the home's sentence reminds the player of: the phase to bet on, a rendez-vous for the
 * next one (on a date, or null while unknown or already past), or nothing at the journey's end.
 */
export type NextStepHint =
  | { kind: 'TODO'; phase: Exclude<GamePhase, 'PRESENTATION'> }
  | { kind: 'RENDEZVOUS'; date: string | null }
  | null;

/**
 * The home's next step: the first phase to do; without one, a rendez-vous for the next upcoming
 * phase. The presentation never counts (a new player is sent there), nor a winner phase that
 * isn't playable: it lets the journey through, so the rendez-vous is the first round's. The
 * rendez-vous has a date when one is known: the first round opens with the official list, the
 * second one after the first round.
 */
export function nextStepHint(
  phases: PlayerPhaseDto[],
  election: Pick<CurrentElectionDto, 'officialListPublishedAt' | 'firstRoundAt'>,
  now = new Date(),
): NextStepHint {
  const steps = phases.filter(
    (p): p is PlayerPhaseDto & { phase: Exclude<GamePhase, 'PRESENTATION'> } =>
      p.phase !== 'PRESENTATION' && (p.phase !== 'WINNER' || p.playable),
  );
  const todo = steps.find((p) => p.playable && p.state === 'TODO');
  if (todo) return { kind: 'TODO', phase: todo.phase };
  const upcoming = steps.find((p) => p.state === 'UPCOMING');
  if (!upcoming) return null;
  const date =
    upcoming.phase === 'FIRST_ROUND'
      ? election.officialListPublishedAt
      : upcoming.phase === 'SECOND_ROUND'
        ? election.firstRoundAt
        : null;
  return { kind: 'RENDEZVOUS', date: date && new Date(date) > now ? date : null };
}

/** The page where the player writes (or reviews) a phase's prediction; not every phase has one. */
export const PHASE_PAGES = {
  QUALIFIERS: '/predict',
  WINNER: '/winner',
  FIRST_ROUND: '/first-round',
} as const satisfies Partial<Record<GamePhase, string>>;

export type PhasePage = (typeof PHASE_PAGES)[keyof typeof PHASE_PAGES];

const pageOf = (phase: GamePhase): PhasePage | undefined =>
  (PHASE_PAGES as Partial<Record<GamePhase, PhasePage>>)[phase];

/**
 * The page of the step to put forward: the current one (see nextPhase); without one, the last
 * phase still writable; otherwise the last closed one, to see one's prediction and its results.
 * The qualifiers when none applies (no election, nothing open yet).
 */
export function currentPhasePage(phases: PlayerPhaseDto[]): PhasePage {
  const next = nextPhase(phases);
  const nextPage = next ? pageOf(next) : undefined;
  if (nextPage) return nextPage;

  const withPage = phases.filter((p) => p.playable && pageOf(p.phase));
  const writable = withPage.findLast((p) => isWritable(p.state));
  const closed = withPage.findLast((p) => p.state === 'CLOSED' || p.state === 'SKIPPED');
  const target = writable ?? closed;
  return (target && pageOf(target.phase)) ?? PHASE_PAGES.QUALIFIERS;
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
