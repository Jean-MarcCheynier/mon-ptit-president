import { SCORE_TOTAL } from '@presidency-bingo/shared';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { formatScore, parseScore, SCORE_STEP, toScoreInput } from '@/lib/first-round';

interface ScoreInputProps {
  id: string;
  /** Accessible name of both controls, e.g. "Score of Anne Alpha". */
  label: string;
  /** What the field shows; the slider follows it while it parses. */
  text: string;
  onTextChange: (text: string) => void;
  /** The user is done with a value: the slider was released or the field lost focus. */
  onCommit: (score: number | null | undefined) => void;
  describedBy?: string;
}

/**
 * A score, in steps of 0.1 point, entered with a slider (like a volume control) or typed in the
 * field on its right; both stay in sync. Shared by the first and second rounds (#34).
 */
export function ScoreInput({
  id,
  label,
  text,
  onTextChange,
  onCommit,
  describedBy,
}: ScoreInputProps) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;
  const score = parseScore(text);
  const sliderValue = typeof score === 'number' ? score : 0;

  return (
    <div className="flex items-center gap-3">
      <Slider
        min={0}
        max={SCORE_TOTAL}
        step={SCORE_STEP}
        value={[sliderValue]}
        aria-label={label}
        aria-valuetext={formatScore(sliderValue, locale)}
        className="flex-1 py-2"
        onValueChange={([value]) => onTextChange(toScoreInput(value ?? 0, locale))}
        onValueCommit={([value]) => onCommit(value ?? 0)}
      />
      <div className="flex items-center gap-1">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="w-20 text-right tabular-nums"
          value={text}
          aria-label={label}
          aria-invalid={score === undefined}
          aria-describedby={score === undefined ? describedBy : undefined}
          onChange={(event) => onTextChange(event.target.value)}
          onBlur={() => onCommit(score)}
        />
        <span aria-hidden className="text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
}
