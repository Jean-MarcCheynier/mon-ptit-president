import { LOCALES } from '@presidency-bingo/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div className={cn('flex gap-1 text-sm', className)}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => i18n.changeLanguage(locale)}
          aria-pressed={i18n.resolvedLanguage === locale}
          className="rounded px-2 py-1 text-muted-foreground hover:text-foreground aria-pressed:font-semibold aria-pressed:text-foreground"
        >
          {t(`languages.${locale}`)}
        </button>
      ))}
    </div>
  );
}
