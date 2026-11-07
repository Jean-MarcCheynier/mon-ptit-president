import type { ElectionCandidateDto, ScoreEntryDto } from '@presidency-bingo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { ScoreInput } from '@/components/score-input';
import { Button } from '@/components/ui/button';
import { formatScore, parseScore, remainingScore, toScoreInput } from '@/lib/first-round';

interface ScoreFormProps {
  /** The qualified candidates, in display order. */
  candidates: ElectionCandidateDto[];
  /** The saved draft. */
  entries: ScoreEntryDto[];
  /** Saves one score. */
  onSave: (politicianId: string, score: number) => Promise<unknown>;
  onValidate: () => void;
  validating: boolean;
}

const INVALID_ID = 'score-invalid';

/**
 * A score per qualified candidate, 0 % by default, with what remains to share out as a guide:
 * the prediction can be validated whatever the total. Each score is saved when its slider is
 * released or its field loses focus; validation first saves any value still unsaved.
 */
export function ScoreForm({ candidates, entries, onSave, onValidate, validating }: ScoreFormProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const saved = new Map(entries.map((e) => [e.politicianId, e.score]));
  const [texts, setTexts] = useState<Record<string, string>>({});

  const parsed = candidates.map((c) => {
    const text = texts[c.politicianId] ?? toScoreInput(saved.get(c.politicianId) ?? 0, locale);
    // An empty field counts as 0 %.
    const score = parseScore(text);
    return { candidate: c, text, score: score === null ? 0 : score };
  });
  const scores: Record<string, number> = {};
  for (const { candidate, score } of parsed)
    if (score !== undefined) scores[candidate.politicianId] = score;
  const invalid = parsed.some((p) => p.score === undefined);
  const remaining = remainingScore(
    candidates.map((c) => c.politicianId),
    scores,
  );

  const isUnsaved = (politicianId: string, score: number) =>
    score !== (saved.get(politicianId) ?? 0);
  const commit = (politicianId: string, score: number | null | undefined) => {
    const value = score === null ? 0 : score;
    if (value !== undefined && isUnsaved(politicianId, value))
      void onSave(politicianId, value).catch(() => {});
  };
  const validate = async () => {
    try {
      await Promise.all(
        parsed
          .filter(
            ({ candidate, score }) =>
              score !== undefined && isUnsaved(candidate.politicianId, score),
          )
          .map(({ candidate, score }) => onSave(candidate.politicianId, score ?? 0)),
      );
    } catch {
      return; // The failed save shows its error.
    }
    onValidate();
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void validate();
      }}
    >
      <ul className="grid gap-4">
        {parsed.map(({ candidate, text }) => (
          <li key={candidate.politicianId} className="grid gap-2">
            <div className="flex items-center gap-3">
              <PoliticianAvatar name={candidate.name} photoUrl={candidate.photoUrl} />
              <div className="grid flex-1">
                <span className="font-medium">{candidate.name}</span>
                <span className="text-xs text-muted-foreground">{candidate.partyLabel}</span>
              </div>
            </div>
            <ScoreInput
              id={`score-${candidate.politicianId}`}
              label={t('firstRound.scoreLabel', { name: candidate.name })}
              text={text}
              describedBy={INVALID_ID}
              onTextChange={(value) =>
                setTexts((current) => ({ ...current, [candidate.politicianId]: value }))
              }
              onCommit={(score) => commit(candidate.politicianId, score)}
            />
          </li>
        ))}
      </ul>

      {invalid ? (
        <p id={INVALID_ID} className="text-sm text-destructive">
          {t('firstRound.invalid')}
        </p>
      ) : null}

      <div className="sticky bottom-0 grid gap-3 border-t bg-background py-3">
        <p
          aria-live="polite"
          className={`text-lg font-semibold tabular-nums ${remaining < 0 ? 'text-destructive' : ''}`}
        >
          {remaining < 0
            ? t('firstRound.over', { value: formatScore(-remaining, locale) })
            : t('firstRound.remaining', { value: formatScore(remaining, locale) })}
        </p>
        <Button type="submit" disabled={invalid || validating}>
          {t('firstRound.validate')}
        </Button>
      </div>
    </form>
  );
}
