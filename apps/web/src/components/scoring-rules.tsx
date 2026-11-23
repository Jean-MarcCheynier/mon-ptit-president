import { useTranslation } from 'react-i18next';
import { PageInfo } from './page-info';

const TIERS = [
  { key: 'unanimous', points: 1 },
  { key: 'half', points: 10 },
  { key: 'alone', points: 100 },
] as const;

/**
 * How decisions are scored (docs/adr/0001-points-selon-la-rarete.md), without any live figure.
 * The page's info: below the swipe deck, out of its way.
 */
export function ScoringRules() {
  const { t } = useTranslation();
  return (
    <PageInfo title={t('scoring.title')}>
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
    </PageInfo>
  );
}
