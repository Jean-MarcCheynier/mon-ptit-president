import type { ElectionCandidateDto } from '@presidency-bingo/shared';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BallotColumnProps {
  title: string;
  candidates: ElectionCandidateDto[];
  /** Makes each candidate a button moving them to the other column; read-only without it. */
  onMove?: (candidate: ElectionCandidateDto) => void;
  moveLabel?: (name: string) => string;
}

/** One side of a ballot: the kept or the dropped candidates. */
export function BallotColumn({ title, candidates, onMove, moveLabel }: BallotColumnProps) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('review.empty')}</p>
        ) : (
          <ul className="grid gap-1">
            {candidates.map((candidate) => {
              const content = (
                <>
                  <PoliticianAvatar name={candidate.name} photoUrl={candidate.photoUrl} />
                  <span className="grid flex-1">
                    <span className="font-medium">{candidate.name}</span>
                    <span className="text-xs text-muted-foreground">{candidate.partyLabel}</span>
                  </span>
                </>
              );
              return (
                <li key={candidate.politicianId}>
                  {onMove ? (
                    <button
                      type="button"
                      aria-label={moveLabel?.(candidate.name)}
                      onClick={() => onMove(candidate)}
                      className="group flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {content}
                      <ArrowLeftRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
