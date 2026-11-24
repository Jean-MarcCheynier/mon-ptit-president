import type {
  CurrentElectionDto,
  ElectionCandidateDto,
  ScoreEntryDto,
  ValidatedScoresDto,
} from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form-alert';
import { PageHeader } from '@/components/page-header';
import { PageInfo } from '@/components/page-info';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { RoundResultsView } from '@/components/round-results-view';
import { ScoreForm } from '@/components/score-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentElectionQuery } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';
import {
  firstRoundBallotQuery,
  firstRoundCandidatesQuery,
  firstRoundDraftQuery,
  firstRoundResultsQuery,
  formatScore,
  useDiscardFirstRoundDraft,
  useSetScore,
  useStartFirstRoundDraft,
  useValidateScores,
} from '@/lib/first-round';
import { isWritable, phasesQuery, requirePhase, usePhaseState } from '@/lib/phases';
import { formatDateTime } from '@/lib/time';

/** Reachable once the qualifiers are cleared (validated or closed); else back to the journey. */
export const Route = createFileRoute('/_app/first-round')({
  beforeLoad: ({ context }) => requirePhase(context.queryClient, 'FIRST_ROUND'),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(phasesQuery),
      context.queryClient.query(firstRoundCandidatesQuery),
      context.queryClient.query(firstRoundDraftQuery),
      context.queryClient.query(firstRoundBallotQuery),
      context.queryClient.query(firstRoundResultsQuery),
    ]),
  component: FirstRoundPage,
});

function FirstRoundPage() {
  const { t } = useTranslation();
  const [{ data: election }] = useSuspenseQueries({ queries: [currentElectionQuery] });

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      {election ? (
        <FirstRound election={election} />
      ) : (
        <>
          <PageHeader title={t('firstRound.title')} />
          <p className="text-muted-foreground">{t('election.none')}</p>
        </>
      )}
    </div>
  );
}

function FirstRound({ election }: { election: CurrentElectionDto }) {
  const { t, i18n } = useTranslation();
  const [{ data: pool }, { data: draft }, { data: ballot }, { data: phases }, { data: results }] =
    useSuspenseQueries({
      queries: [
        firstRoundCandidatesQuery,
        firstRoundDraftQuery,
        firstRoundBallotQuery,
        phasesQuery,
        firstRoundResultsQuery,
      ],
    });
  const phase = phases.find((p) => p.phase === 'FIRST_ROUND');
  const state = usePhaseState(phase);
  const ids = new Set(pool.politicianIds);
  const candidates = election.candidates.filter((c) => ids.has(c.politicianId));
  // A prediction validated before the official list: it still counts, on the qualified only.
  const listSinceBallot =
    pool.official &&
    ballot !== null &&
    election.officialListPublishedAt !== null &&
    ballot.validatedAt < election.officialListPublishedAt;

  const header = (description?: string) => (
    <PageHeader title={t('firstRound.title')} description={description} />
  );
  if (state === 'UPCOMING') return header(t('firstRound.upcoming'));
  if (!isWritable(state)) {
    if (!ballot) return header(t('firstRound.notParticipated'));
    return (
      <>
        {header(
          t('firstRound.closed', {
            date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
          }),
        )}
        {results.result ? (
          <RoundResultsView result={results.result} final={results.final} />
        ) : (
          <ScoresList candidates={candidates} entries={ballot.entries} />
        )}
      </>
    );
  }

  const closesOn = phase?.closesAt
    ? t('firstRound.closesOn', { date: formatDateTime(phase.closesAt, i18n.resolvedLanguage) })
    : null;
  return (
    <>
      {header(
        closesOn ? `${t('firstRound.description')} ${closesOn}` : t('firstRound.description'),
      )}
      {pool.official ? (
        listSinceBallot && draft.entries.length === 0 ? (
          <PageInfo title={t('firstRound.officialListTitle')}>
            <p>{t('firstRound.reviewAfterList')}</p>
          </PageInfo>
        ) : null
      ) : (
        <PageInfo title={t('firstRound.provisionalTitle')}>
          <p>{t('firstRound.provisional')}</p>
        </PageInfo>
      )}
      {ballot && draft.entries.length === 0 ? (
        <ValidatedScores candidates={candidates} ballot={ballot} />
      ) : (
        <EditScores candidates={candidates} entries={draft.entries} ballot={ballot} />
      )}
    </>
  );
}

function EditScores({
  candidates,
  entries,
  ballot,
}: {
  candidates: ElectionCandidateDto[];
  entries: ScoreEntryDto[];
  ballot: ValidatedScoresDto | null;
}) {
  const { t } = useTranslation();
  const setScore = useSetScore();
  const validate = useValidateScores();
  const discard = useDiscardFirstRoundDraft();
  const navigate = useNavigate();
  const error = setScore.error ?? validate.error ?? discard.error;

  return (
    <>
      <ScoreForm
        candidates={candidates}
        entries={entries}
        onSave={(politicianId, score) => setScore.mutateAsync({ politicianId, score })}
        // Like every phase: back to the journey once validated.
        onValidate={() => validate.mutate(undefined, { onSuccess: () => navigate({ to: '/' }) })}
        validating={validate.isPending}
        validatedAt={ballot?.validatedAt ?? null}
        // The validated prediction shows again in place of the form.
        onCancel={() => discard.mutate()}
        cancelling={discard.isPending}
      />
      {error ? <FormAlert variant="error">{errorMessage(t, error)}</FormAlert> : null}
    </>
  );
}

/** The validated prediction, with no edit in progress. */
function ValidatedScores({
  candidates,
  ballot,
}: {
  candidates: ElectionCandidateDto[];
  ballot: ValidatedScoresDto;
}) {
  const { t, i18n } = useTranslation();
  const startDraft = useStartFirstRoundDraft();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('firstRound.validatedTitle')}</CardTitle>
        <CardDescription>
          {t('firstRound.validatedOn', {
            date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ScoresList candidates={candidates} entries={ballot.entries} />
        <Button
          variant="outline"
          disabled={startDraft.isPending}
          onClick={() => startDraft.mutate()}
        >
          <Pencil />
          {t('firstRound.edit')}
        </Button>
        {startDraft.error ? (
          <FormAlert variant="error">{errorMessage(t, startDraft.error)}</FormAlert>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Read-only scores, highest first. */
function ScoresList({
  candidates,
  entries,
}: {
  candidates: ElectionCandidateDto[];
  entries: ScoreEntryDto[];
}) {
  const { i18n } = useTranslation();
  const byId = new Map(candidates.map((c) => [c.politicianId, c]));
  const rows = entries
    .flatMap((e) => {
      const candidate = byId.get(e.politicianId);
      return candidate ? [{ candidate, score: e.score }] : [];
    })
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
  return (
    <ul className="grid gap-2">
      {rows.map(({ candidate, score }) => (
        <li key={candidate.politicianId} className="flex items-center gap-3">
          <PoliticianAvatar name={candidate.name} photoUrl={candidate.photoUrl} />
          <span className="grid flex-1">
            <span className="font-medium">{candidate.name}</span>
            <span className="text-xs text-muted-foreground">{candidate.partyLabel}</span>
          </span>
          <span className="font-semibold tabular-nums">
            {formatScore(score, i18n.resolvedLanguage)}
          </span>
        </li>
      ))}
    </ul>
  );
}
