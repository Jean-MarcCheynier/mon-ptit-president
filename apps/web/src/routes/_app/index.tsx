import type { CurrentElectionDto, DraftBallotDto } from '@presidency-bingo/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ElectionCard } from '@/components/election-card';
import { FormAlert } from '@/components/form-alert';
import { meQuery } from '@/lib/auth';
import { currentBallotQuery, draftQuery } from '@/lib/ballot';
import { currentElectionQuery } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery),
      context.queryClient.query(draftQuery),
      context.queryClient.query(currentBallotQuery),
    ]),
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  const election = useQuery(currentElectionQuery);
  const draft = useQuery(draftQuery);
  const ballot = useQuery(currentBallotQuery);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('home.title', { name: user?.name })}</h1>
        <p className="text-muted-foreground">{t('home.description')}</p>
      </div>
      {election.error ? (
        <FormAlert variant="error">{errorMessage(t, election.error)}</FormAlert>
      ) : election.data ? (
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
function decidedIn(election: CurrentElectionDto, draft: DraftBallotDto | undefined): number {
  const pool = new Set(election.candidates.map((c) => c.politicianId));
  return draft?.entries.filter((e) => pool.has(e.politicianId)).length ?? 0;
}
