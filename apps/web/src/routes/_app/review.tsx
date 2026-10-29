import type { ElectionCandidateDto } from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { ArrowLeftRight, CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form-alert';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  currentBallotQuery,
  draftQuery,
  reviewState,
  useSetEntry,
  useValidate,
} from '@/lib/ballot';
import { currentElectionQuery } from '@/lib/elections';
import { errorMessage, translate } from '@/lib/errors';
import { formatDateTime } from '@/lib/time';

export const Route = createFileRoute('/_app/review')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(draftQuery),
      context.queryClient.query(currentBallotQuery),
    ]),
  component: ReviewPage,
});

function ReviewPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [{ data: election }, { data: draft }, { data: ballot }] = useSuspenseQueries({
    queries: [currentElectionQuery, draftQuery, currentBallotQuery],
  });
  const setEntry = useSetEntry();
  const validate = useValidate();

  // Nothing to review: swipe first (or see the validated bet there). Once validated, the
  // draft is gone and the page waits for the redirect to home.
  if (!election || draft.entries.length === 0) {
    return validate.isIdle ? <Navigate to="/predict" replace /> : null;
  }

  const { kept, dropped, undecided, blocker } = reviewState(election.candidates, draft.entries);
  const toggle = (candidate: ElectionCandidateDto, isCandidate: boolean) =>
    setEntry.mutate({ politicianId: candidate.politicianId, isCandidate });
  const error = validate.error ?? setEntry.error;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('review.title')}</h1>
        <p className="text-muted-foreground">{t('review.description')}</p>
        {ballot ? (
          <p className="text-sm text-muted-foreground">
            {t('review.currentBet', {
              date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
            })}
          </p>
        ) : null}
      </div>

      {undecided > 0 ? (
        <FormAlert variant="error">
          <span className="grid gap-2">
            {t('review.undecided', { count: undecided })}
            <Button asChild size="sm" variant="outline" className="justify-self-start">
              <Link to="/predict">{t('review.continue')}</Link>
            </Button>
          </span>
        </FormAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          title={t('review.kept', { count: kept.length })}
          candidates={kept}
          moveLabel={(name) => t('review.moveToDropped', { name })}
          onMove={(c) => toggle(c, false)}
        />
        <Column
          title={t('review.dropped', { count: dropped.length })}
          candidates={dropped}
          moveLabel={(name) => t('review.moveToKept', { name })}
          onMove={(c) => toggle(c, true)}
        />
      </div>

      <div className="grid gap-3">
        {blocker && undecided === 0 ? (
          <p className="text-sm text-muted-foreground">{translate(t, `errors.${blocker}`, '')}</p>
        ) : null}
        {error ? <FormAlert variant="error">{errorMessage(t, error)}</FormAlert> : null}
        <Button
          size="lg"
          className="sm:justify-self-end"
          disabled={blocker !== null || validate.isPending}
          onClick={() => validate.mutate(undefined, { onSuccess: () => navigate({ to: '/' }) })}
        >
          <CircleCheck />
          {t('review.validate')}
        </Button>
      </div>
    </div>
  );
}

function Column({
  title,
  candidates,
  moveLabel,
  onMove,
}: {
  title: string;
  candidates: ElectionCandidateDto[];
  moveLabel: (name: string) => string;
  onMove: (candidate: ElectionCandidateDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('review.empty')}</p>
        ) : (
          <ul className="grid gap-1">
            {candidates.map((candidate) => (
              <li key={candidate.politicianId}>
                <button
                  type="button"
                  aria-label={moveLabel(candidate.name)}
                  onClick={() => onMove(candidate)}
                  className="group flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <PoliticianAvatar name={candidate.name} photoUrl={candidate.photoUrl} />
                  <span className="grid flex-1">
                    <span className="font-medium">{candidate.name}</span>
                    <span className="text-xs text-muted-foreground">{candidate.partyLabel}</span>
                  </span>
                  <ArrowLeftRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
