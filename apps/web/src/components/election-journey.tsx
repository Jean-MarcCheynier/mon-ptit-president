import type {
  CurrentElectionDto,
  PlayerPhaseDto,
  ResultDto,
  ValidatedBallotDto,
} from '@presidency-bingo/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EditBallotButton } from '@/components/edit-ballot-button';
import { PhaseTrail } from '@/components/phase-trail';
import { Button } from '@/components/ui/button';
import { usePredictionsLocked } from '@/lib/elections';
import { useStartFirstRoundDraft } from '@/lib/first-round';
import { usePhaseState } from '@/lib/phases';
import { formatDateTime } from '@/lib/time';

interface ElectionJourneyProps {
  election: CurrentElectionDto;
  /** The user's journey through the election. */
  phases: PlayerPhaseDto[];
  /** Candidates already decided in the user's draft. */
  decided: number;
  /** The user's current bet; null if they never validated one. */
  ballot: ValidatedBallotDto | null;
  /** The user's result once the official list is published; null before, or without a bet. */
  result: ResultDto | null;
}

/** The current election, as a section heading, and the user's journey through its phases. */
export function ElectionJourney({
  election,
  phases,
  decided,
  ballot,
  result,
}: ElectionJourneyProps) {
  const { t, i18n } = useTranslation();
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long' }).format(new Date(iso));

  return (
    <section aria-labelledby="election-name" className="grid gap-4">
      <div className="grid gap-1">
        <h2 id="election-name" className="text-xl font-semibold">
          {election.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('election.rounds', {
            first: formatDate(election.firstRoundAt),
            second: formatDate(election.secondRoundAt),
          })}
        </p>
      </div>
      <PhaseTrail
        phases={phases}
        actions={{
          QUALIFIERS: (
            <QualifiersAction
              election={election}
              decided={decided}
              ballot={ballot}
              result={result}
            />
          ),
          WINNER: <WinnerAction phase={phases.find((p) => p.phase === 'WINNER')} />,
          FIRST_ROUND: <FirstRoundAction phase={phases.find((p) => p.phase === 'FIRST_ROUND')} />,
        }}
      />
    </section>
  );
}

function QualifiersAction({
  election,
  decided,
  ballot,
  result,
}: Omit<ElectionJourneyProps, 'phases'>) {
  const { t, i18n } = useTranslation();
  const locked = usePredictionsLocked(election);

  if (result) {
    return (
      <>
        <div className="grid w-full gap-1">
          <p className="text-sm font-medium">{t('results.home', { ...result })}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {t('results.points', { count: result.points })}
          </p>
        </div>
        <Button asChild>
          <Link to="/predict">{t('results.view')}</Link>
        </Button>
      </>
    );
  }
  if (election.officialListPublished) {
    return <p className="text-sm text-muted-foreground">{t('election.resultsNotParticipated')}</p>;
  }
  if (ballot) {
    return (
      <>
        <p className="w-full text-sm font-medium">
          {t('ballot.validatedOn', {
            date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage),
          })}
        </p>
        {locked ? (
          <Button asChild variant="outline">
            <Link to="/predict">{t('ballot.view')}</Link>
          </Button>
        ) : decided > 0 ? (
          <Button asChild>
            <Link to="/review">{t('ballot.resumeEdit')}</Link>
          </Button>
        ) : (
          <EditBallotButton candidates={election.candidates} ballot={ballot} />
        )}
      </>
    );
  }
  if (locked) return null;
  return (
    <Button asChild>
      <Link to="/predict">
        {decided > 0
          ? t('election.resume', { decided, total: election.candidates.length })
          : t('election.predict')}
      </Link>
    </Button>
  );
}

function WinnerAction({ phase }: { phase: PlayerPhaseDto | undefined }) {
  const { t } = useTranslation();
  const state = usePhaseState(phase);
  if (state === 'TODO') {
    return (
      <Button asChild>
        <Link to="/winner">{t('winner.predict')}</Link>
      </Button>
    );
  }
  if (state === 'DONE') {
    return (
      <Button asChild variant="outline">
        <Link to="/winner" search={{ edit: true }}>
          <Pencil />
          {t('winner.edit')}
        </Link>
      </Button>
    );
  }
  if (state === 'CLOSED') {
    return (
      <Button asChild variant="outline">
        <Link to="/winner">{t('winner.view')}</Link>
      </Button>
    );
  }
  return null;
}

function FirstRoundAction({ phase }: { phase: PlayerPhaseDto | undefined }) {
  const { t } = useTranslation();
  const state = usePhaseState(phase);
  const navigate = useNavigate();
  const startDraft = useStartFirstRoundDraft();
  if (state === 'TODO') {
    return (
      <Button asChild>
        <Link to="/first-round">{t('firstRound.predict')}</Link>
      </Button>
    );
  }
  if (state === 'DONE') {
    return (
      <Button
        variant="outline"
        disabled={startDraft.isPending}
        onClick={() =>
          startDraft.mutate(undefined, { onSuccess: () => navigate({ to: '/first-round' }) })
        }
      >
        <Pencil />
        {t('firstRound.edit')}
      </Button>
    );
  }
  if (state === 'CLOSED') {
    return (
      <Button asChild variant="outline">
        <Link to="/first-round">{t('firstRound.view')}</Link>
      </Button>
    );
  }
  return null;
}
