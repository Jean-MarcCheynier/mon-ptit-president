import { Eye, type LucideIcon, Pencil, Play, Sparkles, Trophy } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Button } from '@/components/ui/button';
import { isWriting, type PhaseAction } from '@/lib/phases';
import { formatDeadline } from '@/lib/time';

const ICONS: Record<PhaseAction, LucideIcon> = {
  PREDICT: Sparkles,
  RESUME: Play,
  EDIT: Pencil,
  VIEW: Eye,
  RESULTS: Trophy,
};

interface PhaseActionButton {
  /** For the Button: filled to move on, outlined to come back, an icon alone to view. */
  props: Pick<ComponentProps<typeof Button>, 'variant' | 'size' | 'className' | 'aria-label'>;
  /** The Button's content: its icon and label, with the phase's deadline below while writing. */
  content: ReactNode;
}

/**
 * The button of a phase's action on the journey, to spread on a Button wrapping its Link (or
 * its click):
 * `<Button asChild {...button.props}><Link to="…">{button.content}</Link></Button>`.
 * `label` replaces the action's own (e.g. with the draft's progress). Null without an action.
 */
export function usePhaseActionButton(
  action: PhaseAction | null,
  closesAt: string | null | undefined,
  label?: string,
): PhaseActionButton | null {
  const { t, i18n } = useTranslation();
  if (!action) return null;
  const Icon = ICONS[action];
  if (action === 'VIEW') {
    return {
      props: { variant: 'outline', size: 'icon', 'aria-label': t('phases.actions.VIEW') },
      content: <Icon aria-hidden />,
    };
  }
  const text = label ?? t(`phases.actions.${action}`);
  const deadline =
    closesAt && isWriting(action)
      ? t('phases.deadline', { ...formatDeadline(closesAt, i18n.resolvedLanguage) })
      : null;
  return {
    props: {
      variant: action === 'EDIT' ? 'outline' : 'default',
      className: deadline ? 'h-auto min-h-9 py-1.5' : undefined,
    },
    content: (
      <>
        <Icon aria-hidden />
        {deadline ? (
          <span className="grid text-left leading-tight">
            <span>{text}</span>
            {/* Separates both lines in the accessible name; not laid out between grid items. */}{' '}
            <span className="text-xs font-normal opacity-80">{deadline}</span>
          </span>
        ) : (
          text
        )}
      </>
    ),
  };
}
