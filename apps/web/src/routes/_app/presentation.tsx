import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form-alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { useCompleteOnboarding } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

/** The presentation's slides, in order (`presentation.slides.<key>` in the locales). */
const SLIDES = ['game', 'qualifiers', 'winner', 'rounds', 'closing'] as const;
type Slide = (typeof SLIDES)[number];

/** The qualifiers' points by rarity (docs/adr/0001), as on the qualifiers' page. */
const TIERS = [
  { key: 'unanimous', points: 1 },
  { key: 'half', points: 10 },
  { key: 'alone', points: 100 },
] as const;

/**
 * The game's presentation, the journey's first phase: a carousel of the game and its phases.
 * Finishing or skipping it records the current version and goes back to the journey. Always
 * open, to read it again.
 */
export const Route = createFileRoute('/_app/presentation')({
  component: PresentationPage,
});

function PresentationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index] as Slide;

  const finish = () => complete.mutate(undefined, { onSuccess: () => navigate({ to: '/' }) });
  const go = (to: number) => setIndex(Math.min(Math.max(to, 0), SLIDES.length - 1));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') go(index + 1);
    if (event.key === 'ArrowLeft') go(index - 1);
  };

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('presentation.title')}</h1>
        {last ? null : (
          <Button variant="ghost" onClick={finish} disabled={complete.isPending}>
            {t('presentation.skip')}
          </Button>
        )}
      </div>

      {/* Focusable: the arrow keys move between slides. */}
      <section
        aria-roledescription={t('presentation.carousel')}
        aria-label={t('presentation.title')}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a carousel takes the arrow keys.
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="rounded-lg border bg-card p-6 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <article
          aria-roledescription={t('presentation.slide')}
          aria-label={t('presentation.position', { index: index + 1, total: SLIDES.length })}
          aria-live="polite"
          className="grid min-h-64 content-start gap-4"
        >
          <h2 className="text-xl font-semibold">{t(`presentation.slides.${slide}.title`)}</h2>
          <p className="text-muted-foreground">{t(`presentation.slides.${slide}.body`)}</p>
          <SlideDetails slide={slide} />
        </article>
      </section>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
          <ArrowLeft aria-hidden />
          {t('presentation.previous')}
        </Button>
        <ol className="flex gap-2" aria-label={t('presentation.progress')}>
          {SLIDES.map((key, i) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t('presentation.position', { index: i + 1, total: SLIDES.length })}
                aria-current={i === index ? 'step' : undefined}
                className={cn(
                  'block size-2.5 rounded-full bg-muted-foreground/30',
                  i === index && 'bg-primary',
                )}
              />
            </li>
          ))}
        </ol>
        {last ? (
          <Button onClick={finish} disabled={complete.isPending}>
            <Rocket aria-hidden />
            {t('presentation.start')}
          </Button>
        ) : (
          <Button onClick={() => go(index + 1)}>
            {t('presentation.next')}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
      {complete.error ? (
        <FormAlert variant="error">{errorMessage(t, complete.error)}</FormAlert>
      ) : null}
    </div>
  );
}

/** What a slide adds below its text: the phases, or the points at stake. */
function SlideDetails({ slide }: { slide: Slide }) {
  const { t } = useTranslation();
  switch (slide) {
    case 'game':
      return (
        <ol className="grid gap-2 text-sm">
          {(['QUALIFIERS', 'WINNER', 'FIRST_ROUND', 'SECOND_ROUND'] as const).map((phase, i) => (
            <li key={phase} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-phase-todo text-xs font-semibold text-phase-todo-foreground">
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{t(`phases.names.${phase}`)}</span>
                {' · '}
                {t(`presentation.phases.${phase}`)}
              </span>
            </li>
          ))}
        </ol>
      );
    case 'qualifiers':
      return (
        <ul className="grid gap-1 text-sm">
          {TIERS.map(({ key, points }) => (
            <li key={key} className="flex justify-between gap-3">
              <span>{t(`scoring.${key}`)}</span>
              <span className="font-semibold tabular-nums">
                {t('results.points', { count: points })}
              </span>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}
