import type { ElectionCandidateDto, ValidatedBallotDto } from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, Undo2, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BallotColumn } from '@/components/ballot-column';
import { EditBallotButton } from '@/components/edit-ballot-button';
import { FormAlert } from '@/components/form-alert';
import { initials } from '@/components/politician-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { meQuery } from '@/lib/auth';
import {
  currentBallotQuery,
  deckState,
  draftQuery,
  reviewState,
  useRemoveEntry,
  useSetEntry,
} from '@/lib/ballot';
import { currentElectionQuery, usePredictionsLocked } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';
import { stableShuffle } from '@/lib/shuffle';
import { formatDateTime } from '@/lib/time';

export const Route = createFileRoute('/_app/predict')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(draftQuery),
      context.queryClient.query(currentBallotQuery),
    ]),
  component: PredictPage,
});

function PredictPage() {
  const { t } = useTranslation();
  const [{ data: election }, { data: draft }, { data: ballot }] = useSuspenseQueries({
    queries: [currentElectionQuery, draftQuery, currentBallotQuery],
  });
  const locked = usePredictionsLocked(election);

  return (
    <div className={`mx-auto grid gap-6 ${locked ? 'max-w-3xl' : 'max-w-sm'}`}>
      <h1 className="text-2xl font-semibold">{t('predict.title')}</h1>
      {election && locked ? (
        // Any unvalidated draft is ignored: only the validated bet counts.
        <LockedBallot candidates={election.candidates} ballot={ballot} />
      ) : election && ballot && draft.entries.length === 0 ? (
        <ValidatedCard validatedAt={ballot.validatedAt} />
      ) : election ? (
        <Swipe electionId={election.id} candidates={election.candidates} />
      ) : (
        <p className="text-muted-foreground">{t('election.none')}</p>
      )}
    </div>
  );
}

function Swipe({
  electionId,
  candidates,
}: {
  electionId: string;
  candidates: ElectionCandidateDto[];
}) {
  const { t } = useTranslation();
  const [{ data: user }, { data: draft }] = useSuspenseQueries({
    queries: [meQuery, draftQuery],
  });
  const setEntry = useSetEntry();
  const removeEntry = useRemoveEntry();

  const seed = `${user?.id}:${electionId}`;
  const deck = useMemo(
    () => stableShuffle(candidates, (c) => c.politicianId, seed),
    [candidates, seed],
  );
  const { current, decided, total, previous } = deckState(deck, draft.entries);

  const decide = (isCandidate: boolean) => {
    if (current) setEntry.mutate({ politicianId: current.politicianId, isCandidate });
  };
  const undo = () => {
    if (previous) removeEntry.mutate(previous.politicianId);
  };

  // Arrow keys decide, Backspace undoes. Buttons stay reachable with Tab.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select'))
        return;
      if (event.key === 'ArrowLeft') decide(false);
      else if (event.key === 'ArrowRight') decide(true);
      else if (event.key === 'Backspace') undo();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const error = setEntry.error ?? removeEntry.error;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t('predict.progressLabel')}</span>
          <span className="tabular-nums">{t('predict.progress', { decided, total })}</span>
        </div>
        <progress
          className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
          value={decided}
          max={total}
          aria-label={t('predict.progressLabel')}
        />
      </div>

      {current ? <CandidateCard candidate={current} /> : <DoneCard total={total} />}

      {current ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" onClick={() => decide(false)}>
            <X />
            {t('predict.no')}
          </Button>
          <Button size="lg" onClick={() => decide(true)}>
            <Check />
            {t('predict.yes')}
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={undo} disabled={!previous}>
          <Undo2 />
          {t('predict.undo')}
        </Button>
        <p className="text-right text-xs text-muted-foreground">{t('predict.shortcuts')}</p>
      </div>

      {error ? <FormAlert variant="error">{errorMessage(t, error)}</FormAlert> : null}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: ElectionCandidateDto }) {
  const { t } = useTranslation();
  return (
    <Card aria-live="polite">
      <CardContent className="grid justify-items-center gap-4 text-center">
        <figure className="grid justify-items-center gap-1">
          <Avatar className="size-48 rounded-2xl">
            {candidate.photoUrl ? (
              <AvatarImage src={candidate.photoUrl} alt={candidate.name} className="object-cover" />
            ) : null}
            <AvatarFallback className="rounded-2xl text-5xl font-medium">
              {initials(candidate.name)}
            </AvatarFallback>
          </Avatar>
          {candidate.photoCredit ? (
            <figcaption className="max-w-48 text-[10px] leading-tight text-muted-foreground">
              {t('predict.photoCredit', { credit: candidate.photoCredit })}
            </figcaption>
          ) : null}
        </figure>
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">{candidate.name}</h2>
          <p className="text-sm font-medium">{candidate.partyLabel}</p>
          <p className="text-sm text-muted-foreground">{candidate.tagline}</p>
        </div>
        <p className="font-medium">{t('predict.question')}</p>
      </CardContent>
    </Card>
  );
}

function DoneCard({ total }: { total: number }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('predict.doneTitle')}</CardTitle>
        <CardDescription>{t('predict.doneDescription', { count: total })}</CardDescription>
      </CardHeader>
      <CardContent className="grid">
        <Button asChild>
          <Link to="/review">{t('predict.review')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** The current bet with no edit in progress. */
function ValidatedCard({ validatedAt }: { validatedAt: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('predict.validatedTitle')}</CardTitle>
        <CardDescription>
          {t('ballot.validatedOn', { date: formatDateTime(validatedAt, i18n.resolvedLanguage) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid">
        <EditBallotButton />
      </CardContent>
    </Card>
  );
}

/** Predictions are closed: the validated bet, read-only. */
function LockedBallot({
  candidates,
  ballot,
}: {
  candidates: ElectionCandidateDto[];
  ballot: ValidatedBallotDto | null;
}) {
  const { t, i18n } = useTranslation();
  if (!ballot) return <p className="text-muted-foreground">{t('election.notParticipated')}</p>;

  const { kept, dropped } = reviewState(candidates, ballot.entries);
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground">
        {t('predict.locked', { date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage) })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <BallotColumn title={t('review.kept', { count: kept.length })} candidates={kept} />
        <BallotColumn title={t('review.dropped', { count: dropped.length })} candidates={dropped} />
      </div>
    </div>
  );
}
