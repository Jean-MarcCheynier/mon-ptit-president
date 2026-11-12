export const CANDIDATE_STATUSES = [
  'POTENTIAL',
  'DECLARED',
  'QUALIFIED',
  'NOT_QUALIFIED',
  'WITHDRAWN',
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface ElectionCandidateDto {
  politicianId: string;
  name: string;
  photoUrl: string | null;
  photoCredit: string | null;
  partyLabel: string;
  tagline: string;
  status: CandidateStatus;
}

/**
 * The phases of the player's journey, in order (GLOSSARY.md, "Phase"). A player reaches a phase
 * once the previous one is validated or closed (docs/adr/0002).
 */
export const GAME_PHASES = [
  'PRESENTATION',
  'QUALIFIERS',
  'WINNER',
  'FIRST_ROUND',
  'SECOND_ROUND',
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

/**
 * Where a player stands in a phase. UPCOMING: not reachable yet (previous phase not done, or
 * not scheduled yet). TODO: reachable, nothing validated. DONE: validated, still editable.
 * CLOSED: validated, then closed (read-only). SKIPPED: closed without a validated prediction.
 */
export type PhaseState = 'UPCOMING' | 'TODO' | 'DONE' | 'CLOSED' | 'SKIPPED';

export interface PlayerPhaseDto {
  phase: GamePhase;
  /** By the server's clock. */
  state: PhaseState;
  /** Closing of the phase; null if it never closes or while unknown. */
  closesAt: string | null;
  /**
   * False while the phase isn't built yet: it doesn't hold the journey back (the next phase
   * opens as if it weren't there) and can't be opened.
   */
  playable: boolean;
}

/** The connected player's journey through the current election. */
export interface PlayerPhasesDto {
  phases: PlayerPhaseDto[];
}

export interface CurrentElectionDto {
  id: string;
  slug: string;
  name: string;
  firstRoundAt: string;
  secondRoundAt: string;
  /** Closing of the qualifiers' predictions. */
  predictionsLockAt: string;
  /** Past predictionsLockAt, by the server's clock: no more writes are accepted. */
  predictionsLocked: boolean;
  /** When the official list was (or will be) published; null while unknown. */
  officialListPublishedAt: string | null;
  /** Past officialListPublishedAt, by the server's clock: results are available. */
  officialListPublished: boolean;
  /** Active pool: every candidate except WITHDRAWN. */
  candidates: ElectionCandidateDto[];
}
