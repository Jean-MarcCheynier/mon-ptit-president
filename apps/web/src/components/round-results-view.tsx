import type { RoundResultDto, RoundResultEntryDto } from '@presidency-bingo/shared';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatGap, formatResultScore, formatScore } from '@/lib/first-round';
import { cn } from '@/lib/utils';

const formatPoints = (points: number, locale: string | undefined) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(points);

/**
 * The player's first-round points: total and finalists' bonus, then each candidate's predicted
 * score against the real one, provisional until `final`.
 */
export function RoundResultsView({ result, final }: { result: RoundResultDto; final: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid gap-4">
      <Card className="gap-2">
        <CardHeader>
          <CardTitle>
            <h2>{t('roundResults.title')}</h2>
          </CardTitle>
          <CardDescription>
            {final ? t('roundResults.final') : t('roundResults.provisional')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          <p className="text-3xl font-semibold tabular-nums">
            {t('results.points', { count: result.points })}
          </p>
          <p className="text-sm">
            {t('roundResults.finalists', {
              count: result.finalists,
              bonus: formatPoints(result.bonus, i18n.resolvedLanguage),
            })}
          </p>
        </CardContent>
      </Card>
      <ul className="grid gap-2">
        {result.entries.map((entry) => (
          <RoundResultRow key={entry.politicianId} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

function RoundResultRow({ entry }: { entry: RoundResultEntryDto }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <PoliticianAvatar name={entry.name} photoUrl={entry.photoUrl} />
      <div className="grid flex-1 gap-0.5 text-sm">
        <span className="font-medium">{entry.name}</span>
        <span>
          {t('roundResults.scores', {
            predicted: formatScore(entry.predicted, locale),
            actual: formatResultScore(entry.actual, locale),
          })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('roundResults.gap', { count: entry.gap / 100, value: formatGap(entry.gap, locale) })}
        </span>
        {entry.finalist ? (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            {entry.predictedFinalist ? <Check className="size-3" aria-hidden /> : null}
            {entry.predictedFinalist ? t('roundResults.finalistFound') : t('roundResults.finalist')}
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          'font-semibold tabular-nums',
          entry.points > 0 ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {t('roundResults.points', { value: formatPoints(entry.points, locale) })}
      </span>
    </li>
  );
}
