import type { ElectionCandidateDto } from '@presidency-bingo/shared';
import {
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { initials } from '@/components/politician-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A drag past this distance (px, velocity included) decides; a shorter one springs back. */
const THRESHOLD = 100;
/** How much the release velocity (px/s) adds to the drag distance, so a quick flick decides. */
const FLICK = 0.2;

export interface SwipeCardHandle {
  /** Throws the card out (right: qualified), then calls onDecide. Ignored while it leaves. */
  swipe: (isCandidate: boolean) => void;
}

interface SwipeCardProps {
  candidate: ElectionCandidateDto;
  onDecide: (isCandidate: boolean) => void;
  /** The side the card comes back from after an undo (true: right); null for a new card. */
  enterFrom: boolean | null;
  ref?: Ref<SwipeCardHandle>;
}

/**
 * The current candidate, draggable like a dating-app card: rotation and stamps follow the drag.
 * Mount one per candidate (key it), so each card starts centered. With reduced motion, decisions
 * apply at once, without rotation, flight or entrance.
 */
export function SwipeCard({ candidate, onDecide, enterFrom, ref }: SwipeCardProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], reduced ? [0, 0] : [-12, 12]);
  const yesOpacity = useTransform(x, [20, THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-THRESHOLD, -20], [1, 0]);
  const leaving = useRef(false);

  const swipe = (isCandidate: boolean) => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduced) return onDecide(isCandidate);
    const distance = window.innerWidth;
    void animate(x, isCandidate ? distance : -distance, { duration: 0.25, ease: 'easeIn' }).then(
      () => onDecide(isCandidate),
    );
  };
  useImperativeHandle(ref, () => ({ swipe }));

  // After an undo, the card flies back from where it left. Runs once: the props are fixed for
  // a given card.
  useEffect(() => {
    if (enterFrom === null || reduced) return;
    x.set(enterFrom ? window.innerWidth : -window.innerWidth);
    void animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
  }, [enterFrom, reduced, x]);

  const onDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    const power = offset.x + velocity.x * FLICK;
    if (Math.abs(power) > THRESHOLD) swipe(power > 0);
    else if (reduced) x.set(0);
    else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
  };

  return (
    <motion.div
      data-testid="swipe-card"
      className="relative cursor-grab touch-pan-y select-none active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      onDragEnd={onDragEnd}
      initial={reduced || enterFrom !== null ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      <Card aria-live="polite">
        <CardContent className="grid justify-items-center gap-4 text-center">
          <figure className="grid justify-items-center gap-1">
            <Avatar className="size-48 rounded-2xl">
              {candidate.photoUrl ? (
                <AvatarImage
                  src={candidate.photoUrl}
                  alt={candidate.name}
                  draggable={false}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="rounded-2xl text-5xl font-medium">
                {initials(candidate.name)}
              </AvatarFallback>
            </Avatar>
            {candidate.photoCredit ? (
              <figcaption className="max-w-48 text-[10px] leading-tight text-muted-foreground">
                {t('predict.photoCredit', { credit: candidate.photoCredit })}
              </figcaption>
            ) : null}
          </figure>
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">{candidate.name}</h2>
            <p className="text-sm font-medium">{candidate.partyLabel}</p>
            <p className="text-sm text-muted-foreground">{candidate.tagline}</p>
          </div>
          <p className="font-medium">{t('predict.question')}</p>
        </CardContent>
      </Card>
      <Stamp
        className="left-4 -rotate-12 text-emerald-700 dark:text-emerald-400"
        opacity={yesOpacity}
      >
        {t('predict.yes')}
      </Stamp>
      <Stamp className="right-4 rotate-12 text-red-700 dark:text-red-400" opacity={noOpacity}>
        {t('predict.no')}
      </Stamp>
    </motion.div>
  );
}

function Stamp({
  className,
  opacity,
  children,
}: {
  className: string;
  opacity: ReturnType<typeof useTransform<number, number>>;
  children: React.ReactNode;
}) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className={cn(
        'pointer-events-none absolute top-6 rounded-lg border-4 border-current bg-card/85 px-3 py-1 text-2xl font-black tracking-widest uppercase',
        className,
      )}
    >
      {children}
    </motion.span>
  );
}
