import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TIERS = [
  { key: 'unanimous', points: 1 },
  { key: 'half', points: 10 },
  { key: 'alone', points: 100 },
] as const;

/**
 * How decisions are scored (docs/adr/0001-points-selon-la-rarete.md), without any live figure.
 * Collapsible, so it stays out of the way of the swipe deck.
 */
export function ScoringRules() {
  const { t } = useTranslation();
  return (
    <details className="group rounded-lg border p-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        {t('scoring.title')}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-muted-foreground">{t('scoring.description')}</p>
        <ul className="grid gap-1">
          {TIERS.map(({ key, points }) => (
            <li key={key} className="flex justify-between gap-3">
              <span>{t(`scoring.${key}`)}</span>
              <span className="font-semibold tabular-nums">
                {t('results.points', { count: points })}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">{t('scoring.wrong')}</p>
      </div>
    </details>
  );
}
