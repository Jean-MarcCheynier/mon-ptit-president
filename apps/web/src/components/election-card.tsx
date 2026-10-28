import type { CurrentElectionDto } from '@presidency-bingo/shared';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { timeUntil, useNow } from '@/lib/time';

const PREVIEW_SIZE = 8;

interface ElectionCardProps {
  election: CurrentElectionDto;
  /** Candidates already decided in the user's draft. */
  decided: number;
}

export function ElectionCard({ election, decided }: ElectionCardProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const remaining = timeUntil(new Date(election.predictionsLockAt), now);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long' }).format(new Date(iso));

  const preview = election.candidates.slice(0, PREVIEW_SIZE);
  const hidden = election.candidates.length - preview.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{election.name}</CardTitle>
        <CardDescription>
          {t('election.rounds', {
            first: formatDate(election.firstRoundAt),
            second: formatDate(election.secondRoundAt),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {remaining ? t('election.closesIn') : t('election.closed')}
          </p>
          {remaining ? (
            <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
              {t('election.countdown', { ...remaining })}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            {t('election.pool', { count: election.candidates.length })}
          </p>
          <div className="flex flex-wrap items-center -space-x-2">
            {preview.map((candidate) => (
              <PoliticianAvatar
                key={candidate.politicianId}
                name={candidate.name}
                photoUrl={candidate.photoUrl}
                className="ring-2 ring-card"
              />
            ))}
            {hidden > 0 ? (
              <span className="ml-4 text-sm text-muted-foreground">+{hidden}</span>
            ) : null}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link to="/predict">
            {decided > 0
              ? t('election.resume', { decided, total: election.candidates.length })
              : t('election.predict')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
