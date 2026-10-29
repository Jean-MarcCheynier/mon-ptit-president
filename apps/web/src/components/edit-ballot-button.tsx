import { useNavigate } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useStartDraft } from '@/lib/ballot';

/** Opens a draft pre-filled from the current bet and goes to its review. */
export function EditBallotButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startDraft = useStartDraft();
  return (
    <Button
      variant="outline"
      disabled={startDraft.isPending}
      onClick={() => startDraft.mutate(undefined, { onSuccess: () => navigate({ to: '/review' }) })}
    >
      <Pencil />
      {t('ballot.edit')}
    </Button>
  );
}
