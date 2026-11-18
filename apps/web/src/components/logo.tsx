import { useTranslation } from 'react-i18next';
// Variants b and c sit next to it in assets/logo, pending the final choice (#50).
import logoUrl from '@/assets/logo/logo-a.svg';
import { cn } from '@/lib/utils';

/**
 * The game's logo: a runny tricolour camembert, followed by its name as text.
 * The drawing is decorative; the name carries the accessible label.
 */
export function Logo({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', className)}>
      <img src={logoUrl} alt="" aria-hidden className={cn('size-8 shrink-0', iconClassName)} />
      {t('app.name')}
    </span>
  );
}
