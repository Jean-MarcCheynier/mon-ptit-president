import {
  type CurrentElectionDto,
  type DraftBallotDto,
  isOnboardingOutdated,
  type PlayerPhaseDto,
} from '@presidency-bingo/shared';
import { noop, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ElectionJourney } from '@/components/election-journey';
import { FormAlert } from '@/components/form-alert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { meQuery } from '@/lib/auth';
import { currentBallotQuery, draftQuery } from '@/lib/ballot';
import { currentElectionQuery } from '@/lib/elections';
import { errorMessage } from '@/lib/errors';
import { useCompleteOnboarding } from '@/lib/onboarding';
import { phasesQuery } from '@/lib/phases';
import { resultsQuery } from '@/lib/results';

/**
 * Home: the user's journey through the election's phases, and what to do next. It stays up when the prediction
 * API fails: errors are shown in place of the journey. A new player first goes through the
 * presentation.
 */
export const Route = createFileRoute('/_app/')({
  beforeLoad: async ({ context }) => {
    const phases = await context.queryClient.query(phasesQuery).catch(() => []);
    const presentation = phases.find((p) => p.phase === 'PRESENTATION');
    if (presentation?.state === 'TODO') throw redirect({ to: '/presentation' });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(currentElectionQuery).catch(noop),
      context.queryClient.query(draftQuery).catch(noop),
      context.queryClient.query(currentBallotQuery).catch(noop),
      context.queryClient.query(resultsQuery).catch(noop),
      context.queryClient.query(phasesQuery).catch(noop),
    ]),
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  const election = useQuery(currentElectionQuery);
  const draft = useQuery(draftQuery);
  const ballot = useQuery(currentBallotQuery);
  const results = useQuery(resultsQuery);
  const phases = useQuery(phasesQuery);
  // Without the draft, the bet or the phases, the journey would offer the wrong action.
  const error = election.error ?? draft.error ?? ballot.error ?? results.error ?? phases.error;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t('home.title', { name: user?.name })}</h1>
      {user ? (
        <NewPresentation versionSeen={user.onboardingVersionSeen} phases={phases.data} />
      ) : null}
      {error ? (
        <FormAlert variant="error">{errorMessage(t, error)}</FormAlert>
      ) : election.data &&
        draft.data &&
        ballot.data !== undefined &&
        results.data &&
        phases.data ? (
        <ElectionJourney
          election={election.data}
          phases={phases.data}
          decided={decidedIn(election.data, draft.data)}
          ballot={ballot.data}
          result={results.data.result}
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

/**
 * Proposes a new version of the presentation to a player who saw an older one (or none, if they
 * played before it existed), without blocking anything; dismissing it counts as seen.
 */
function NewPresentation({
  versionSeen,
  phases,
}: {
  versionSeen: number;
  phases: PlayerPhaseDto[] | undefined;
}) {
  const { t } = useTranslation();
  const complete = useCompleteOnboarding();
  const blocking = phases?.find((p) => p.phase === 'PRESENTATION')?.state === 'TODO';
  if (!isOnboardingOutdated(versionSeen) || blocking) return null;
  return (
    <Alert>
      <AlertDescription className="grid gap-3">
        <p>{t('presentation.updated')}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link to="/presentation">{t('presentation.view')}</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => complete.mutate()}
            disabled={complete.isPending}
          >
            {t('presentation.later')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
