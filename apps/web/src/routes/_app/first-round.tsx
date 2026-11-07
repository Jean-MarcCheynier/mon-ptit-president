import type {
  CurrentElectionDto,
  ElectionCandidateDto,
  ScoreEntryDto,
  ValidatedScoresDto,
} from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form-alert';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { ScoreForm } from '@/components/score-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentElectionQuery, usePhaseStatus } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';
import {
  firstRoundBallotQuery,
  firstRoundDraftQuery,
  formatScore,
  useSetScore,
  useStartFirstRoundDraft,
  useValidateScores,
} from '@/lib/first-round';
import { formatDateTime } from '@/lib/time';

export const Route = createFileRoute('/_app/first-round')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(firstRoundDraftQuery),
      context.queryClient.query(firstRoundBallotQuery),
    ]),
  component: FirstRoundPage,
});

function FirstRoundPage() {
  const { t } = useTranslation();
  const [{ data: election }] = useSuspenseQueries({ queries: [currentElectionQuery] });

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <h1 className="text-2xl font-semibold">{t('firstRound.title')}</h1>
      {election ? (
        <FirstRound election={election} />
      ) : (
        <p className="text-muted-foreground">{t('election.none')}</p>
      )}
    </div>
  );
}

function FirstRound({ election }: { election: CurrentElectionDto }) {
  const { t, i18n } = useTranslation();
  const [{ data: draft }, { data: ballot }] = useSuspenseQueries({
    queries: [firstRoundDraftQuery, firstRoundBallotQuery],
  });
  const status = usePhaseStatus(election.firstRound);
  const qualified = election.candidates.filter((c) => c.status === 'QUALIFIED');

  if (status === 'UPCOMING') {
    return <p className="text-muted-foreground">{t('firstRound.upcoming')}</p>;
  }
  if (status === 'CLOSED') {
    if (!ballot) return <p className="text-muted-foreground">{t('firstRound.notParticipated')}</p>;
    return (
      <div className="grid gap-4">
        <p className="text-muted-foreground">
          {t('firstRound.closed', {
            date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
          })}
        </p>
        <ScoresList candidates={qualified} entries={ballot.entries} />
      </div>
    );
  }

  const closesOn = election.firstRound.closesAt
    ? t('firstRound.closesOn', {
        date: formatDateTime(election.firstRound.closesAt, i18n.resolvedLanguage),
      })
    : null;
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground">
        {t('firstRound.description')} {closesOn}
      </p>
      {ballot && draft.entries.length === 0 ? (
        <ValidatedScores candidates={qualified} ballot={ballot} />
      ) : (
        <EditScores candidates={qualified} entries={draft.entries} ballot={ballot} />
      )}
    </div>
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
  const { t, i18n } = useTranslation();
  const setScore = useSetScore();
  const validate = useValidateScores();
  const error = setScore.error ?? validate.error;

  return (
    <>
      {ballot ? (
        <p className="text-sm text-muted-foreground">
          {t('firstRound.currentBet', {
            date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
          })}
        </p>
      ) : null}
      <ScoreForm
        candidates={candidates}
        entries={entries}
        onSave={(politicianId, score) => setScore.mutateAsync({ politicianId, score })}
        onValidate={() => validate.mutate()}
        validating={validate.isPending}
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
