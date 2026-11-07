import type { ElectionCandidateDto, ScoreEntryDto } from '@presidency-bingo/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatScore, parseScore, scoresState } from '@/lib/first-round';

interface ScoreFormProps {
  /** The qualified candidates, in display order. */
  candidates: ElectionCandidateDto[];
  /** The saved draft. */
  entries: ScoreEntryDto[];
  /** Saves one score; null clears it. */
  onSave: (politicianId: string, score: number | null) => Promise<unknown>;
  onValidate: () => void;
  validating: boolean;
}

const INVALID_ID = 'score-invalid';

/** Plain number for an input, in the locale ("23,4"). */
const toInput = (tenths: number, locale: string | undefined) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false }).format(
    tenths / 10,
  );

/**
 * A score per qualified candidate, in steps of 0.1 point, with what remains to share out. Each
 * score is saved when its field loses focus; validation first saves any field still unsaved.
 */
export function ScoreForm({ candidates, entries, onSave, onValidate, validating }: ScoreFormProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const saved = new Map(entries.map((e) => [e.politicianId, e.score]));
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((e) => [e.politicianId, toInput(e.score, locale)])),
  );

  const parsed = candidates.map((c) => {
    const text = texts[c.politicianId] ?? '';
    return { candidate: c, text, score: parseScore(text) };
  });
  const scores: Record<string, number> = {};
  for (const { candidate, score } of parsed)
    if (typeof score === 'number') scores[candidate.politicianId] = score;
  const invalid = parsed.some((p) => p.score === undefined);
  const { remaining, missing, blocker } = scoresState(
    candidates.map((c) => c.politicianId),
    scores,
  );

  /** Saves the fields whose valid value differs from the draft. */
  const unsaved = () =>
    parsed.filter(
      ({ candidate, score }) =>
        score !== undefined && score !== (saved.get(candidate.politicianId) ?? null),
    );
  const save = (politicianId: string) => {
    const field = unsaved().find((p) => p.candidate.politicianId === politicianId);
    if (field) void onSave(politicianId, field.score ?? null).catch(() => {});
  };
  const validate = async () => {
    try {
      await Promise.all(unsaved().map((p) => onSave(p.candidate.politicianId, p.score ?? null)));
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
      <ul className="grid gap-2">
        {parsed.map(({ candidate, text, score }) => {
          const id = `score-${candidate.politicianId}`;
          return (
            <li key={candidate.politicianId} className="flex items-center gap-3">
              <PoliticianAvatar name={candidate.name} photoUrl={candidate.photoUrl} />
              <label htmlFor={id} className="grid flex-1">
                <span className="font-medium">{candidate.name}</span>
                <span className="text-xs text-muted-foreground">{candidate.partyLabel}</span>
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id={id}
                  inputMode="decimal"
                  autoComplete="off"
                  className="w-20 text-right tabular-nums"
                  value={text}
                  aria-label={t('firstRound.scoreLabel', { name: candidate.name })}
                  aria-invalid={score === undefined}
                  aria-describedby={score === undefined ? INVALID_ID : undefined}
                  onChange={(event) =>
                    setTexts((current) => ({
                      ...current,
                      [candidate.politicianId]: event.target.value,
                    }))
                  }
                  onBlur={() => save(candidate.politicianId)}
                />
                <span aria-hidden className="text-muted-foreground">
                  %
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {invalid ? (
        <p id={INVALID_ID} className="text-sm text-destructive">
          {t('firstRound.invalid')}
        </p>
      ) : null}

      <div className="grid gap-1 rounded-md border p-3" aria-live="polite">
        <p
          className={`text-lg font-semibold tabular-nums ${remaining < 0 ? 'text-destructive' : ''}`}
        >
          {remaining < 0
            ? t('firstRound.over', { value: formatScore(-remaining, locale) })
            : t('firstRound.remaining', { value: formatScore(remaining, locale) })}
        </p>
        {missing > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('firstRound.missing', { count: missing })}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={blocker !== null || invalid || validating}>
        {t('firstRound.validate')}
      </Button>
    </form>
  );
}
