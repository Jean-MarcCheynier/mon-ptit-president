import type { CurrentElectionDto, DraftBallotDto } from '@presidency-bingo/shared';
import { noop, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ElectionCard } from '@/components/election-card';
import { FormAlert } from '@/components/form-alert';
import { meQuery } from '@/lib/auth';
import { currentBallotQuery, draftQuery } from '@/lib/ballot';
import { currentElectionQuery } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';

/** Home stays up when the prediction API fails: errors are shown in place of the election card. */
export const Route = createFileRoute('/_app/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery).catch(noop),
      context.queryClient.query(draftQuery).catch(noop),
      context.queryClient.query(currentBallotQuery).catch(noop),
    ]),
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  const election = useQuery(currentElectionQuery);
  const draft = useQuery(draftQuery);
  const ballot = useQuery(currentBallotQuery);
  // Without the draft or the bet, the card would offer the wrong action.
  const error = election.error ?? draft.error ?? ballot.error;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('home.title', { name: user?.name })}</h1>
        <p className="text-muted-foreground">{t('home.description')}</p>
      </div>
      {error ? (
        <FormAlert variant="error">{errorMessage(t, error)}</FormAlert>
      ) : election.data && draft.data && ballot.data !== undefined ? (
        <ElectionCard
          election={election.data}
          decided={decidedIn(election.data, draft.data)}
          validatedAt={ballot.data?.validatedAt ?? null}
        />
      ) : election.data === null ? (
        <p className="text-muted-foreground">{t('election.none')}</p>
      ) : null}
    </div>
  );
}

/** Draft entries that still match the active pool (withdrawn candidates don't count). */
function decidedIn(election: CurrentElectionDto, draft: DraftBallotDto): number {
  const pool = new Set(election.candidates.map((c) => c.politicianId));
  return draft.entries.filter((e) => pool.has(e.politicianId)).length;
}
