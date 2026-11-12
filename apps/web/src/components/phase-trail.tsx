import type { GamePhase, PhaseState, PlayerPhaseDto } from '@presidency-bingo/shared';
import { Check, CircleDashed, Lock, SkipForward } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { nextPhase, usePhaseState } from '@/lib/phases';
import { formatDateTime, timeUntil, useNow } from '@/lib/time';
import { cn } from '@/lib/utils';

interface PhaseTrailProps {
  phases: PlayerPhaseDto[];
  /** What a reachable phase offers to do (open, resume, view…); none for the others. */
  actions: Partial<Record<GamePhase, ReactNode>>;
}

/**
 * The player's journey: the five phases in order, each with its state and closing. The next
 * phase to do is put forward; only reachable phases show their action.
 */
export function PhaseTrail({ phases, actions }: PhaseTrailProps) {
  const { t } = useTranslation();
  const next = nextPhase(phases);
  return (
    <ol className="grid gap-3" aria-label={t('phases.title')}>
      {phases.map((phase, index) => (
        <PhaseStep
          key={phase.phase}
          phase={phase}
          index={index + 1}
          current={phase.phase === next}
          action={actions[phase.phase]}
        />
      ))}
    </ol>
  );
}

function PhaseStep({
  phase,
  index,
  current,
  action,
}: {
  phase: PlayerPhaseDto;
  index: number;
  current: boolean;
  action: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const state = usePhaseState(phase);
  const soon = !phase.playable && state === 'UPCOMING';
  const remaining = current && phase.closesAt ? timeUntil(new Date(phase.closesAt), now) : null;
  const label = soon ? t('phases.soon') : t(`phases.states.${state}`);
  const closing =
    !phase.closesAt || soon
      ? null
      : remaining
        ? t('phases.closesIn', { ...remaining })
        : t(state === 'CLOSED' || state === 'SKIPPED' ? 'phases.closedOn' : 'phases.closesOn', {
            date: formatDateTime(phase.closesAt, i18n.resolvedLanguage),
          });

  return (
    <li
      aria-current={current ? 'step' : undefined}
      className={cn(
        'grid gap-3 rounded-lg border p-4',
        current ? 'border-primary ring-1 ring-primary' : null,
        state === 'UPCOMING' || state === 'SKIPPED' ? 'text-muted-foreground' : null,
      )}
    >
      <div className="flex items-start gap-3">
        <StateIcon state={state} index={index} />
        <div className="grid flex-1 gap-0.5">
          <p className="font-medium">{t(`phases.names.${phase.phase}`)}</p>
          <p className="text-sm text-muted-foreground">
            {closing ? `${label} · ${closing}` : label}
          </p>
        </div>
      </div>
      {state !== 'UPCOMING' && action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </li>
  );
}

function StateIcon({ state, index }: { state: PhaseState; index: number }) {
  const className = 'mt-0.5 size-5 shrink-0';
  switch (state) {
    case 'DONE':
      return <Check className={cn(className, 'text-primary')} aria-hidden />;
    case 'CLOSED':
      return <Lock className={className} aria-hidden />;
    case 'SKIPPED':
      return <SkipForward className={className} aria-hidden />;
    case 'UPCOMING':
      return <CircleDashed className={className} aria-hidden />;
    case 'TODO':
      return (
        <span
          aria-hidden
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {index}
        </span>
      );
  }
}
