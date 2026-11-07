import type { ResultDto, ResultEntryDto } from '@presidency-bingo/shared';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** The player's result: totals, then each decision against the official list. */
export function ResultsView({ result }: { result: ResultDto }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4">
      <Card className="gap-2">
        <CardHeader>
          <CardTitle>
            <h2>{t('results.title')}</h2>
          </CardTitle>
          <CardDescription>{t('results.summary', { ...result })}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">
            {t('results.points', { count: result.points })}
          </p>
        </CardContent>
      </Card>
      <ul className="grid gap-2">
        {result.entries.map((entry) => (
          <ResultRow key={entry.politicianId} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

function ResultRow({ entry }: { entry: ResultEntryDto }) {
  const { t, i18n } = useTranslation();
  const correct = entry.isCandidate === entry.qualified;
  const decision = (qualified: boolean) => (qualified ? t('predict.yes') : t('predict.no'));
  const percent = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: 'percent',
    maximumFractionDigits: 0,
  });

  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <PoliticianAvatar name={entry.name} photoUrl={entry.photoUrl} />
      <div className="grid flex-1 gap-0.5 text-sm">
        <span className="font-medium">{entry.name}</span>
        <span>
          {t('results.yourChoice', { choice: decision(entry.isCandidate) })} ·{' '}
          {t('results.reality', { reality: decision(entry.qualified) })}
        </span>
        <span className="text-xs text-muted-foreground">
          {entry.agreement === null
            ? t('results.alone')
            : t('results.agreement', { percent: percent.format(entry.agreement) })}
        </span>
      </div>
      <span
        className={cn(
          'flex items-center gap-1 font-semibold tabular-nums',
          correct ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {correct ? (
          <Check className="size-4" aria-label={t('results.right')} />
        ) : (
          <X className="size-4" aria-label={t('results.wrong')} />
        )}
        {t('results.points', { count: entry.points })}
      </span>
    </li>
  );
}
