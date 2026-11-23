import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form-alert';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
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

/** The `mobile:` variant of index.css: on phones, tapping a half of the slide moves. */
const MOBILE = '(max-width: 639px), (pointer: coarse) and (max-height: 500px)';

/** How much a neighbouring slide, one step away from the center, shrinks and fades. */
const NEIGHBOUR_SCALE = 0.08;
const NEIGHBOUR_FADE = 0.55;

/**
 * The game's presentation, the journey's first phase: a carousel of the game and its phases.
 * Finishing or skipping it records the current version and goes back to the journey. Always
 * open, to read it again. The current slide is always centered, its neighbours peeking, smaller
 * and faded the farther they are; the slides follow the finger (Embla). On phones, swiping or
 * tapping the slide's left or right half is the only way to move (no previous / next buttons),
 * the slide centered on the screen and no bottom bar (see the app layout). On desktop, three
 * slides are seen whole and clicking a neighbour brings it to the center.
 */
export const Route = createFileRoute('/_app/presentation')({
  component: PresentationPage,
});

function PresentationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const reduced = useReducedMotion() ?? false;
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  const finish = () => complete.mutate(undefined, { onSuccess: () => navigate({ to: '/' }) });
  const go = (to: number) => api?.scrollTo(Math.min(Math.max(to, 0), SLIDES.length - 1));

  // Each slide shrinks and fades with its distance to the center, frame by frame while it
  // moves. With reduced motion, only the selected slide counts: the change is instant.
  const tween = useCallback(
    (carousel: NonNullable<CarouselApi>) => {
      const snaps = carousel.scrollSnapList();
      const center = reduced ? snaps[carousel.selectedScrollSnap()] : carousel.scrollProgress();
      snaps.forEach((snap, i) => {
        const card = cards.current[i];
        if (!card || center === undefined) return;
        // Snaps are evenly spaced (same-width slides): one step is 1 / (count - 1) of progress.
        const distance = Math.min(Math.abs(snap - center) * (snaps.length - 1), 1);
        card.style.transform = `scale(${1 - NEIGHBOUR_SCALE * distance})`;
        card.style.opacity = `${1 - NEIGHBOUR_FADE * distance}`;
      });
    },
    [reduced],
  );

  useEffect(() => {
    if (!api) return;
    const select = () => setIndex(api.selectedScrollSnap());
    select();
    tween(api);
    api.on('select', select).on('reInit', select).on('scroll', tween).on('reInit', tween);
    if (reduced) api.on('select', tween);
    return () => {
      api.off('select', select).off('reInit', select).off('scroll', tween).off('reInit', tween);
      api.off('select', tween);
    };
  }, [api, tween, reduced]);

  // A click ending a drag never gets here (Embla swallows it). A neighbour comes to the center;
  // on phones, the current slide's halves move back and forth.
  const onSlideClick = (i: number, event: MouseEvent<HTMLElement>) => {
    if (i !== index) return go(i);
    if (!window.matchMedia(MOBILE).matches) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    go(i + (event.clientX < left + width / 2 ? -1 : 1));
  };

  return (
    // Centered on the screen. On phones, the slide itself is: the title pinned above, the controls
    // below.
    <div className="mx-auto my-auto grid w-full max-w-4xl grid-cols-1 gap-6 mobile:my-0 mobile:flex-1 mobile:grid-rows-[1fr_auto_1fr]">
      <div className="flex items-center justify-between gap-3 mobile:self-start">
        <PageTitle className="mobile:text-xl">{t('presentation.title')}</PageTitle>
        {last ? null : (
          <Button variant="ghost" onClick={finish} disabled={complete.isPending}>
            {t('presentation.skip')}
          </Button>
        )}
      </div>

      {/* Focusable: the arrow keys move between slides. Vertical scroll left to the browser.
          Edge to edge below desktop, so that the neighbours peek from the screen's sides. */}
      <Carousel
        setApi={setApi}
        opts={{ align: 'center', containScroll: false, duration: reduced ? 0 : 28 }}
        aria-roledescription={t('presentation.carousel')}
        aria-label={t('presentation.title')}
        tabIndex={0}
        className="-mx-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring lg:mx-0"
      >
        {/* Symmetric gutters, so that the centered slide's card is centered too. */}
        <CarouselContent className="ml-0 touch-pan-y py-1">
          {SLIDES.map((slide, i) => {
            const current = i === index;
            return (
              <CarouselItem
                key={slide}
                // Only the current slide is announced; the neighbours are a visual hint.
                role="article"
                aria-roledescription={t('presentation.slide')}
                aria-label={t('presentation.position', { index: i + 1, total: SLIDES.length })}
                aria-hidden={current ? undefined : true}
                aria-live={current ? 'polite' : undefined}
                onClick={(event) => onSlideClick(i, event)}
                className={cn(
                  'basis-[78%] select-none px-2 sm:basis-[70%] lg:basis-1/3',
                  !current && 'cursor-pointer',
                )}
              >
                <div
                  ref={(node) => {
                    cards.current[i] = node;
                  }}
                  className="grid h-full min-h-64 content-start gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm will-change-transform"
                >
                  <h2 className="text-xl font-semibold">
                    {t(`presentation.slides.${slide}.title`)}
                  </h2>
                  <p className="text-muted-foreground">{t(`presentation.slides.${slide}.body`)}</p>
                  <SlideDetails slide={slide} />
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      <div className="grid content-end gap-3">
        <div className="flex items-center justify-between gap-3 mobile:flex-col">
          <Button
            variant="outline"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="mobile:hidden"
          >
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
                    'block h-2.5 w-2.5 rounded-full bg-muted-foreground/30 transition-[width,background-color] duration-300 motion-reduce:transition-none',
                    i === index && 'w-6 bg-primary',
                  )}
                />
              </li>
            ))}
          </ol>
          {last ? (
            <Button onClick={finish} disabled={complete.isPending} className="mobile:w-full">
              <Rocket aria-hidden />
              {t('presentation.start')}
            </Button>
          ) : (
            <Button onClick={() => go(index + 1)} className="mobile:hidden">
              {t('presentation.next')}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
        {complete.error ? (
          <FormAlert variant="error">{errorMessage(t, complete.error)}</FormAlert>
        ) : null}
      </div>
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
              <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
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
