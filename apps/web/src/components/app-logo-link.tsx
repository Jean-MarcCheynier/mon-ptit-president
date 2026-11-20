import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { AppLogo } from './app-logo';

/**
 * The game's logo, leading back to home: with the game's name in the desktop header, alone on
 * phones. Outlines follow the text colour (dark in light theme, light in dark theme); the armchair
 * and the bicorne stay red in both.
 */
export function AppLogoLink({
  withName = false,
  className,
}: {
  /** Shows the game's name next to the logo. */
  withName?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      // Starts with the visible name, so voice control users can say what they see.
      aria-label={t('nav.logo')}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-md font-semibold whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <AppLogo className="size-8" secondaryColor="var(--logo-accent)" secondaryOpacity={1} />
      {withName ? <span>{t('app.name')}</span> : null}
    </Link>
  );
}
