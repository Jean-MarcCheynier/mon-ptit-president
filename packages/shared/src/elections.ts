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

export type PhaseStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

/** When a phase's predictions open and close; null while unknown. */
export interface PhaseWindowDto {
  opensAt: string | null;
  closesAt: string | null;
  /** By the server's clock. A phase without both dates is UPCOMING until its closing passes. */
  status: PhaseStatus;
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
  /** First-round predictions: open from the publication of the official list. */
  firstRound: PhaseWindowDto;
  /** Active pool: every candidate except WITHDRAWN. */
  candidates: ElectionCandidateDto[];
}
