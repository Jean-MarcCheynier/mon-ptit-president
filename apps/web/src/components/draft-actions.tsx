import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/time';

interface DraftActionsProps {
  /** When the prediction that counts was validated; null if there is none yet. */
  validatedAt: string | null;
  /** The phase's validate button. */
  validate: ReactNode;
  /** Gives the draft up: the validated prediction counts again. */
  onCancel: () => void;
  cancelling: boolean;
}

/**
 * Below an edit in progress: validate it or, if a prediction was already validated, say that it
 * still counts and offer to give the edit up. On phones, full width, cancel above validate; on the
 * right above.
 */
export function DraftActions({ validatedAt, validate, onCancel, cancelling }: DraftActionsProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid gap-3">
      {validatedAt ? (
        <p className="text-sm text-muted-foreground">
          {t('draft.currentBet', { date: formatDateTime(validatedAt, i18n.resolvedLanguage) })}
        </p>
      ) : null}
      <div className="flex justify-end gap-3 mobile:flex-col">
        {validatedAt ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={onCancel}
            disabled={cancelling}
          >
            {t('draft.cancel')}
          </Button>
        ) : null}
        {validate}
      </div>
    </div>
  );
}
