import type { ElectionCandidateDto, ValidatedBallotDto } from '@presidency-bingo/shared';
import { useNavigate } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { newProfiles, useStartDraft } from '@/lib/ballot';

interface EditBallotButtonProps {
  candidates: ElectionCandidateDto[];
  ballot: ValidatedBallotDto;
  /** Replaces the default look and content (an icon and "Edit", or the new profiles' count). */
  button?: { props: ComponentProps<typeof Button>; content: ReactNode };
}

/**
 * Opens a draft pre-filled from the current bet. With new profiles in the pool, it goes to the
 * swipe to decide on them only; otherwise straight to the review.
 */
export function EditBallotButton({ candidates, ballot, button }: EditBallotButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startDraft = useStartDraft();
  const count = newProfiles(candidates, ballot).length;
  return (
    <Button
      variant={count > 0 ? 'default' : 'outline'}
      {...button?.props}
      disabled={startDraft.isPending}
      onClick={() =>
        startDraft.mutate(undefined, {
          onSuccess: () => navigate({ to: count > 0 ? '/predict' : '/review' }),
        })
      }
    >
      {button ? (
        button.content
      ) : (
        <>
          <Pencil />
          {count > 0 ? t('ballot.newProfiles', { count }) : t('ballot.edit')}
        </>
      )}
    </Button>
  );
}
