import type { ElectionCandidateDto } from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BallotColumn } from '@/components/ballot-column';
import { DraftActions } from '@/components/draft-actions';
import { FormAlert } from '@/components/form-alert';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  currentBallotQuery,
  draftQuery,
  reviewState,
  useDiscardDraft,
  useSetEntry,
  useValidate,
} from '@/lib/ballot';
import { currentElectionQuery, usePredictionsLocked } from '@/lib/elections';
import { errorMessage, translate } from '@/lib/errors';
import { requirePhase } from '@/lib/phases';

/** Held back by the presentation for a new player; else always open (read-only once closed). */
export const Route = createFileRoute('/_app/review')({
  beforeLoad: ({ context }) => requirePhase(context.queryClient, 'QUALIFIERS'),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(draftQuery),
      context.queryClient.query(currentBallotQuery),
    ]),
  component: ReviewPage,
});

function ReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [{ data: election }, { data: draft }, { data: ballot }] = useSuspenseQueries({
    queries: [currentElectionQuery, draftQuery, currentBallotQuery],
  });
  const setEntry = useSetEntry();
  const validate = useValidate();
  const discard = useDiscardDraft();
  const locked = usePredictionsLocked(election);

  // Locked: /predict shows the bet read-only.
  if (locked) return <Navigate to="/predict" replace />;
  // Nothing to review: swipe first (or see the validated bet there). Once validated, the
  // draft is gone and the page waits for the redirect to home. Once given up, /predict shows the
  // bet again.
  if (!election || draft.entries.length === 0) {
    return validate.isIdle ? <Navigate to="/predict" replace /> : null;
  }

  const { kept, dropped, undecided, blocker } = reviewState(election.candidates, draft.entries);
  const toggle = (candidate: ElectionCandidateDto, isCandidate: boolean) =>
    setEntry.mutate({ politicianId: candidate.politicianId, isCandidate });
  const error = validate.error ?? setEntry.error ?? discard.error;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={t('review.title')} description={t('review.description')} />

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
        <BallotColumn
          title={t('review.kept', { count: kept.length })}
          candidates={kept}
          moveLabel={(name) => t('review.moveToDropped', { name })}
          onMove={(c) => toggle(c, false)}
        />
        <BallotColumn
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
        <DraftActions
          validatedAt={ballot?.validatedAt ?? null}
          onCancel={() => discard.mutate()}
          cancelling={discard.isPending}
          validate={
            <Button
              size="lg"
              disabled={blocker !== null || validate.isPending}
              onClick={() => validate.mutate(undefined, { onSuccess: () => navigate({ to: '/' }) })}
            >
              <CircleCheck />
              {t('review.validate')}
            </Button>
          }
        />
      </div>
    </div>
  );
}
