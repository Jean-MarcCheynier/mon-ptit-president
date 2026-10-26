import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ElectionCard } from '@/components/election-card';
import { FormAlert } from '@/components/form-alert';
import { meQuery } from '@/lib/auth';
import { currentElectionQuery } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.prefetchQuery(currentElectionQuery),
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  const election = useQuery(currentElectionQuery);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('home.title', { name: user?.name })}</h1>
        <p className="text-muted-foreground">{t('home.description')}</p>
      </div>
      {election.error ? (
        <FormAlert variant="error">{errorMessage(t, election.error)}</FormAlert>
      ) : election.data ? (
        <ElectionCard election={election.data} />
      ) : election.data === null ? (
        <p className="text-muted-foreground">{t('election.none')}</p>
      ) : null}
    </div>
  );
}
