import type { ElectionCandidateDto, ValidatedBallotDto } from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, Undo2, X } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BallotColumn } from '@/components/ballot-column';
import { EditBallotButton } from '@/components/edit-ballot-button';
import { FormAlert } from '@/components/form-alert';
import { PageHeader } from '@/components/page-header';
import { initials } from '@/components/politician-avatar';
import { ResultsView } from '@/components/results-view';
import { ScoringRules } from '@/components/scoring-rules';
import {
  SwipeCard,
  SwipeCardItem,
  SwipeCardStack,
  SwipeCardStamp,
  SwipeCardTrigger,
  SwipeCardUndo,
} from '@/components/swipe-card';
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
import { requirePhase } from '@/lib/phases';
import { resultsQuery } from '@/lib/results';
import { stableShuffle } from '@/lib/shuffle';
import { formatDateTime } from '@/lib/time';

/** Held back by the presentation for a new player; else always open (read-only once closed). */
export const Route = createFileRoute('/_app/predict')({
  beforeLoad: ({ context }) => requirePhase(context.queryClient, 'QUALIFIERS'),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(draftQuery),
      context.queryClient.query(currentBallotQuery),
      context.queryClient.query(resultsQuery),
    ]),
  component: PredictPage,
});

function PredictPage() {
  const { t } = useTranslation();
  const [{ data: election }, { data: draft }, { data: ballot }, { data: results }] =
    useSuspenseQueries({
      queries: [currentElectionQuery, draftQuery, currentBallotQuery, resultsQuery],
    });
  const locked = usePredictionsLocked(election);
  const title = <PageHeader title={t('predict.title')} titleClassName="truncate mobile:text-xl" />;
  const swiping =
    election && !results.published && !locked && !(ballot && draft.entries.length === 0);

  return (
    <div
      className={`mx-auto grid grid-cols-[minmax(0,1fr)] gap-6 ${locked ? 'max-w-3xl' : 'max-w-sm'}`}
    >
      {swiping ? null : title}
      {election && results.published ? (
        results.result ? (
          <ResultsView result={results.result} />
        ) : (
          <p className="text-muted-foreground">{t('election.resultsNotParticipated')}</p>
        )
      ) : election && locked ? (
        // Any unvalidated draft is ignored: only the validated bet counts.
        <LockedBallot candidates={election.candidates} ballot={ballot} />
      ) : election && ballot && draft.entries.length === 0 ? (
        <ValidatedCard candidates={election.candidates} ballot={ballot} />
      ) : election ? (
        <Swipe title={title} electionId={election.id} candidates={election.candidates} />
      ) : (
        <p className="text-muted-foreground">{t('election.none')}</p>
      )}
      {/* Explained before playing: the scoring only rewards bold bets if players know it. */}
      {election && !results.published ? <ScoringRules /> : null}
    </div>
  );
}

/**
 * The deck, at a fixed size so the buttons never move: Yes / No are always clicked at the same
 * spot. On phones it fills the screen above the bottom bar (the scoring rules come after it).
 */
function Swipe({
  title,
  electionId,
  candidates,
}: {
  title: ReactNode;
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
  const { current, next, decided, total, previous } = deckState(deck, draft.entries);

  const save = (isCandidate: boolean) => {
    if (current) setEntry.mutate({ politicianId: current.politicianId, isCandidate });
  };
  const error = setEntry.error ?? removeEntry.error;

  return (
    <SwipeCard
      // Phones: the screen height, minus the safe areas, main's top padding and the bottom bar.
      className="grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 mobile:h-[calc(100svh-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] mobile:min-h-[26rem] mobile:gap-3"
      onSwipeLeft={() => save(false)}
      onSwipeRight={() => save(true)}
      onUndo={() => previous && removeEntry.mutate(previous.politicianId)}
      canUndo={previous !== null}
      keyboard
    >
      {title}
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

      {/* Desktop: about 3:4, capped. Phones: whatever the screen leaves. */}
      <SwipeCardStack className="aspect-[3/4] max-h-[560px] mobile:aspect-auto mobile:max-h-none">
        {current ? (
          // Same order on every render: the card behind keeps its node when it comes to the front.
          [current, next].map((candidate) =>
            candidate ? (
              <SwipeCardItem
                key={candidate.politicianId}
                behind={candidate !== current}
                className="min-h-0"
              >
                <CandidateCard candidate={candidate} />
                <SwipeCardStamp direction="right">{t('predict.yes')}</SwipeCardStamp>
                <SwipeCardStamp direction="left">{t('predict.no')}</SwipeCardStamp>
              </SwipeCardItem>
            ) : null,
          )
        ) : (
          <DoneCard total={total} />
        )}
      </SwipeCardStack>
      <p aria-live="polite" className="sr-only">
        {current?.name}
      </p>

      <div className="grid gap-3">
        {/* Kept in place once done, so the "done" card is the size of a candidate's. */}
        <div className={`grid grid-cols-2 gap-3 ${current ? '' : 'invisible'}`}>
          <SwipeCardTrigger direction="left" asChild>
            <Button size="lg" variant="outline">
              <X />
              {t('predict.no')}
            </Button>
          </SwipeCardTrigger>
          <SwipeCardTrigger direction="right" asChild>
            <Button size="lg">
              <Check />
              {t('predict.yes')}
            </Button>
          </SwipeCardTrigger>
        </div>

        <div className="flex items-center justify-between gap-3">
          <SwipeCardUndo asChild>
            <Button variant="ghost" size="sm">
              <Undo2 />
              {t('predict.undo')}
            </Button>
          </SwipeCardUndo>
          <p className="text-right text-xs text-muted-foreground mobile:hidden">
            {t('predict.shortcuts')}
          </p>
        </div>

        {error ? <FormAlert variant="error">{errorMessage(t, error)}</FormAlert> : null}
      </div>
    </SwipeCard>
  );
}

/** Same size whatever the candidate: texts are cut, the photo credit's line is always kept. */
function CandidateCard({ candidate }: { candidate: ElectionCandidateDto }) {
  const { t } = useTranslation();
  return (
    <Card className="h-full gap-3 py-4">
      <CardContent className="flex min-h-0 flex-1 flex-col items-center gap-3 px-4 text-center">
        <figure className="flex min-h-0 w-full flex-1 flex-col gap-1">
          <div className="relative min-h-0 flex-1">
            <Avatar className="absolute inset-y-0 left-1/2 aspect-square h-full w-auto max-w-full -translate-x-1/2 rounded-2xl">
              {candidate.photoUrl ? (
                <AvatarImage
                  src={candidate.photoUrl}
                  alt={candidate.name}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="rounded-2xl text-5xl font-medium">
                {initials(candidate.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <figcaption className="h-[1lh] truncate text-[10px] leading-tight text-muted-foreground">
            {candidate.photoCredit
              ? t('predict.photoCredit', { credit: candidate.photoCredit })
              : null}
          </figcaption>
        </figure>
        <div className="grid w-full gap-1">
          <h2 className="truncate text-xl font-semibold">{candidate.name}</h2>
          <p className="truncate text-sm font-medium">{candidate.partyLabel}</p>
          <p
            className="line-clamp-2 h-[2lh] text-sm text-muted-foreground"
            title={candidate.tagline}
          >
            {candidate.tagline}
          </p>
        </div>
        <p className="font-medium">{t('predict.question')}</p>
      </CardContent>
    </Card>
  );
}

function DoneCard({ total }: { total: number }) {
  const { t } = useTranslation();
  return (
    <Card className="h-full justify-center">
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
function ValidatedCard({
  candidates,
  ballot,
}: {
  candidates: ElectionCandidateDto[];
  ballot: ValidatedBallotDto;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('predict.validatedTitle')}</CardTitle>
        <CardDescription>
          {t('ballot.validatedOn', {
            date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid">
        <EditBallotButton candidates={candidates} ballot={ballot} />
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
