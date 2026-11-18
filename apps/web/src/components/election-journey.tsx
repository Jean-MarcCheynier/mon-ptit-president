import type {
  CurrentElectionDto,
  PhaseState,
  PlayerPhaseDto,
  ResultDto,
  ValidatedBallotDto,
} from '@presidency-bingo/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EditBallotButton } from '@/components/edit-ballot-button';
import { usePhaseActionButton } from '@/components/phase-action';
import { PhaseTrail } from '@/components/phase-trail';
import { Button } from '@/components/ui/button';
import { newProfiles } from '@/lib/ballot';
import { usePredictionsLocked } from '@/lib/elections';
import { useStartFirstRoundDraft } from '@/lib/first-round';
import { phaseAction, usePhaseState } from '@/lib/phases';

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
              phase={phases.find((p) => p.phase === 'QUALIFIERS')}
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
  phase,
  decided,
  ballot,
  result,
}: Omit<ElectionJourneyProps, 'phases'> & { phase: PlayerPhaseDto | undefined }) {
  const { t } = useTranslation();
  const locked = usePredictionsLocked(election);
  // From the bet and the lock, as the qualifiers' own page does.
  const state: PhaseState = ballot ? (locked ? 'CLOSED' : 'DONE') : locked ? 'SKIPPED' : 'TODO';
  const action =
    election.officialListPublished && !result
      ? null
      : phaseAction(state, { draft: decided > 0, results: result !== null });
  const count = ballot ? newProfiles(election.candidates, ballot).length : 0;
  const button = usePhaseActionButton(
    action,
    phase?.closesAt ?? election.predictionsLockAt,
    action === 'RESUME'
      ? t('phases.actions.resumeProgress', { decided, total: election.candidates.length })
      : action === 'EDIT' && count > 0
        ? t('ballot.newProfiles', { count })
        : undefined,
  );

  if (election.officialListPublished && !result) {
    return <p className="text-sm text-muted-foreground">{t('election.resultsNotParticipated')}</p>;
  }
  if (!button) return null;
  if (action === 'EDIT' && ballot) {
    return (
      <EditBallotButton
        candidates={election.candidates}
        ballot={ballot}
        // New profiles to decide on: it moves the journey on, as a filled button.
        button={{
          ...button,
          props: { ...button.props, variant: count > 0 ? 'default' : button.props.variant },
        }}
      />
    );
  }
  const link = (
    <Button asChild {...button.props}>
      <Link to={action === 'RESUME' && ballot ? '/review' : '/predict'}>{button.content}</Link>
    </Button>
  );
  if (!result) return link;
  return (
    <>
      <div className="grid w-full gap-1">
        <p className="text-sm font-medium">{t('results.home', { ...result })}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {t('results.points', { count: result.points })}
        </p>
      </div>
      {link}
    </>
  );
}

function WinnerAction({ phase }: { phase: PlayerPhaseDto | undefined }) {
  const action = phaseAction(usePhaseState(phase));
  const button = usePhaseActionButton(action, phase?.closesAt);
  if (!button) return null;
  return (
    <Button asChild {...button.props}>
      {action === 'EDIT' ? (
        <Link to="/winner" search={{ edit: true }}>
          {button.content}
        </Link>
      ) : (
        <Link to="/winner">{button.content}</Link>
      )}
    </Button>
  );
}

function FirstRoundAction({ phase }: { phase: PlayerPhaseDto | undefined }) {
  const action = phaseAction(usePhaseState(phase));
  const button = usePhaseActionButton(action, phase?.closesAt);
  const navigate = useNavigate();
  const startDraft = useStartFirstRoundDraft();
  if (!button) return null;
  if (action === 'EDIT') {
    return (
      <Button
        {...button.props}
        disabled={startDraft.isPending}
        onClick={() =>
          startDraft.mutate(undefined, { onSuccess: () => navigate({ to: '/first-round' }) })
        }
      >
        {button.content}
      </Button>
    );
  }
  return (
    <Button asChild {...button.props}>
      <Link to="/first-round">{button.content}</Link>
    </Button>
  );
}
