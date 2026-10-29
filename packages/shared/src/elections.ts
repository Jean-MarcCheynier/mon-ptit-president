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

export interface CurrentElectionDto {
  id: string;
  slug: string;
  name: string;
  firstRoundAt: string;
  secondRoundAt: string;
  predictionsLockAt: string;
  /** Past predictionsLockAt, by the server's clock: no more writes are accepted. */
  predictionsLocked: boolean;
  /** Active pool: every candidate except WITHDRAWN. */
  candidates: ElectionCandidateDto[];
}
