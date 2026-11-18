import type { GamePhase, PhaseState, PlayerPhaseDto } from '@presidency-bingo/shared';
import { Check, ChevronDown, CircleDashed, Lock, SkipForward } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isWritable, nextPhase, usePhaseState } from '@/lib/phases';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';

interface PhaseTrailProps {
  phases: PlayerPhaseDto[];
  /**
   * What a reachable phase offers to do (open, resume, view…); none for the others. A writable
   * phase's action shows its deadline, which its step then leaves out.
   */
  actions: Partial<Record<GamePhase, ReactNode>>;
}

/** Each state's color, as Tailwind classes (tokens `--phase-*` in index.css). */
const COLORS: Record<PhaseState, { border: string; text: string; bg: string }> = {
  TODO: { border: 'border-phase-todo', text: 'text-phase-todo', bg: 'bg-phase-todo' },
  DONE: { border: 'border-phase-done', text: 'text-phase-done', bg: 'bg-phase-done' },
  CLOSED: { border: 'border-phase-closed', text: 'text-phase-closed', bg: 'bg-phase-closed' },
  SKIPPED: { border: 'border-phase-skipped', text: 'text-phase-skipped', bg: 'bg-phase-skipped' },
  UPCOMING: {
    border: 'border-phase-upcoming',
    text: 'text-phase-upcoming',
    bg: 'bg-phase-upcoming',
  },
};

/** A stretch of the timeline: its color (a state's) and whether it is still ahead (dotted). */
interface Line {
  color: PhaseState;
  dotted: boolean;
}

/**
 * The player's journey: the five phases in order, each with its state and closing, on a
 * timeline running down the middle, behind the cards (seen between them): it starts with a dot
 * above the first card and ends with an arrow below the last one. The line takes the current
 * step's color: solid up to it, dotted after. With no current step (all done or closed), it is
 * solid and neutral. Only reachable phases show their action.
 */
export function PhaseTrail({ phases, actions }: PhaseTrailProps) {
  const { t } = useTranslation();
  const next = nextPhase(phases);
  const current = phases.findIndex((p) => p.phase === next);
  const color: PhaseState = current < 0 ? 'CLOSED' : 'TODO';
  return (
    // Room for the line's start above the first card and its end below the last one.
    <ol className="grid gap-6 pt-6 pb-8" aria-label={t('phases.title')}>
      {phases.map((phase, index) => (
        <PhaseStep
          key={phase.phase}
          phase={phase}
          index={index + 1}
          current={index === current}
          start={index === 0 ? { color, dotted: false } : null}
          // The line below this step: towards the next one, or the end below the last one.
          line={{ color, dotted: current >= 0 && index >= current }}
          last={index === phases.length - 1}
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
  start,
  line,
  last,
  action,
}: {
  phase: PlayerPhaseDto;
  index: number;
  current: boolean;
  /** The line's start, above the first step. */
  start: Line | null;
  line: Line;
  last: boolean;
  action: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const state = usePhaseState(phase);
  const soon = !phase.playable && state === 'UPCOMING';
  const label = soon ? t('phases.soon') : t(`phases.states.${state}`);
  // While writable, the action's button carries the deadline.
  const closing =
    !phase.closesAt || soon || (isWritable(state) && action)
      ? null
      : t(state === 'CLOSED' || state === 'SKIPPED' ? 'phases.closedOn' : 'phases.closesOn', {
          date: formatDateTime(phase.closesAt, i18n.resolvedLanguage),
        });

  return (
    <li aria-current={current ? 'step' : undefined} data-state={state} className="relative">
      {start ? (
        <span
          aria-hidden
          data-slot="phase-line-start"
          className="absolute bottom-full left-1/2 flex h-6 -translate-x-1/2 flex-col items-center"
        >
          <span className={cn('size-3 shrink-0 rounded-full', COLORS[start.color].bg)} />
          <LineStretch line={start} />
        </span>
      ) : null}
      <span
        aria-hidden
        data-slot={last ? 'phase-line-end' : 'phase-line'}
        data-style={line.dotted ? 'dotted' : 'solid'}
        // Across the gap below the card: to the next one, or ending in an arrow.
        className="absolute top-full left-1/2 flex h-6 -translate-x-1/2 flex-col items-center"
      >
        <LineStretch line={line} />
        {last ? (
          <ChevronDown
            className={cn('-mt-2 size-5 shrink-0', COLORS[line.color].text)}
            strokeWidth={3.5}
          />
        ) : null}
      </span>
      <div
        className={cn(
          'grid gap-3 rounded-lg border bg-card p-4 shadow-xs',
          COLORS[state].border,
          current ? 'ring-1 ring-phase-todo' : null,
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
        {state !== 'UPCOMING' && action ? (
          <div
            className={cn(
              'flex flex-wrap gap-3',
              // The current step's buttons take its color.
              current
                ? '[--primary-foreground:var(--phase-todo-foreground)] [--primary:var(--phase-todo)]'
                : null,
            )}
          >
            {action}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function LineStretch({ line }: { line: Line }) {
  return (
    <span
      className={cn(
        'w-0 flex-1 border-l-4',
        line.dotted ? 'border-dotted' : 'border-solid',
        COLORS[line.color].border,
      )}
    />
  );
}

/** The step's icon, in its state's color; the step's number while it is to do. */
function StateIcon({ state, index }: { state: PhaseState; index: number }) {
  const className = cn('mt-0.5 size-5 shrink-0', COLORS[state].text);
  switch (state) {
    case 'DONE':
      return <Check className={className} strokeWidth={3} aria-hidden />;
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
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-phase-todo text-xs font-semibold text-phase-todo-foreground"
        >
          {index}
        </span>
      );
  }
}
