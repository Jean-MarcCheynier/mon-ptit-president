import {
  animate,
  type MotionValue,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { Slot } from 'radix-ui';
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * A stack of cards swiped left or right, dating-app style. UI only: it knows nothing about what
 * the cards show nor what a swipe means.
 *
 *   <SwipeCard onSwipeLeft={…} onSwipeRight={…} onUndo={…} canUndo keyboard>
 *     <SwipeCardItem key={item.id}>
 *       …content…
 *       <SwipeCardStamp direction="right">Yes</SwipeCardStamp>
 *     </SwipeCardItem>
 *     <SwipeCardTrigger direction="left" asChild><Button>No</Button></SwipeCardTrigger>
 *     <SwipeCardUndo asChild><Button>Undo</Button></SwipeCardUndo>
 *   </SwipeCard>
 *
 * Key each item: a new item mounts centered. Triggers and arrow keys throw the current item out
 * like a drag; the swipe callback runs once it is gone. With reduced motion, nothing animates.
 */

export type SwipeDirection = 'left' | 'right';

/** A drag past this distance (px, release velocity included) swipes; a shorter one springs back. */
const THRESHOLD = 100;
/** How much the release velocity (px/s) adds to the drag distance, so a quick flick swipes. */
const FLICK = 0.2;

interface SwipeCardContextValue {
  /** Throws the current item out; no-op without one. */
  swipe: (direction: SwipeDirection) => void;
  undo: () => void;
  canUndo: boolean;
  /** Whether an item is mounted (triggers are disabled otherwise). */
  hasItem: boolean;
  /** The current item registers how to throw itself out; returns the unregister function. */
  register: (throwOut: (direction: SwipeDirection) => void) => () => void;
  /** Called by the item once it is gone. */
  swiped: (direction: SwipeDirection) => void;
  /** The side an item undone last comes back from, if any. */
  returning: SwipeDirection | null;
}

const SwipeCardContext = createContext<SwipeCardContextValue | null>(null);

function useSwipeCard() {
  const context = use(SwipeCardContext);
  if (!context) throw new Error('SwipeCard parts must be used inside <SwipeCard>');
  return context;
}

interface SwipeCardProps extends ComponentProps<'div'> {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  /** ← / → swipe and Backspace undoes, unless focus is in a form field. */
  keyboard?: boolean;
}

function SwipeCard({
  onSwipeLeft,
  onSwipeRight,
  onUndo,
  canUndo = false,
  keyboard = false,
  ...props
}: SwipeCardProps) {
  const throwOut = useRef<((direction: SwipeDirection) => void) | null>(null);
  const [hasItem, setHasItem] = useState(false);
  // Directions swiped in this session, so an undone item comes back from where it left.
  const history = useRef<SwipeDirection[]>([]);
  const [returning, setReturning] = useState<SwipeDirection | null>(null);

  // Stable: the item registers in an effect, which must not re-run on every render.
  const register = useCallback((fn: (direction: SwipeDirection) => void) => {
    throwOut.current = fn;
    setHasItem(true);
    return () => {
      if (throwOut.current !== fn) return;
      throwOut.current = null;
      setHasItem(false);
    };
  }, []);

  const context: SwipeCardContextValue = {
    swipe: (direction) => throwOut.current?.(direction),
    undo: () => {
      if (!canUndo) return;
      setReturning(history.current.pop() ?? null);
      onUndo?.();
    },
    canUndo,
    hasItem,
    register,
    swiped: (direction) => {
      history.current.push(direction);
      setReturning(null);
      (direction === 'left' ? onSwipeLeft : onSwipeRight)();
    },
    returning,
  };

  useEffect(() => {
    if (!keyboard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select'))
        return;
      if (event.key === 'ArrowLeft') context.swipe('left');
      else if (event.key === 'ArrowRight') context.swipe('right');
      else if (event.key === 'Backspace') context.undo();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <SwipeCardContext value={context}>
      <div data-slot="swipe-card" {...props} />
    </SwipeCardContext>
  );
}

const SwipeCardItemContext = createContext<MotionValue<number> | null>(null);

/** The draggable card. Rotation and stamps follow the drag. */
function SwipeCardItem({ className, children }: { className?: string; children: ReactNode }) {
  const { register, swiped, returning } = useSwipeCard();
  const reduced = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], reduced ? [0, 0] : [-12, 12]);
  const leaving = useRef(false);
  // Read once: the side this item comes back from after an undo.
  const [enterFrom] = useState(returning);

  const throwOut = (direction: SwipeDirection) => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduced) return swiped(direction);
    const distance = window.innerWidth * (direction === 'right' ? 1 : -1);
    void animate(x, distance, { duration: 0.25, ease: 'easeIn' }).then(() => swiped(direction));
  };
  // The registered function always calls the latest throwOut.
  const latest = useRef(throwOut);
  latest.current = throwOut;
  useEffect(() => register((direction) => latest.current(direction)), [register]);

  useEffect(() => {
    if (enterFrom === null || reduced) return;
    x.set(window.innerWidth * (enterFrom === 'right' ? 1 : -1));
    void animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
  }, [enterFrom, reduced, x]);

  const onDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    const power = offset.x + velocity.x * FLICK;
    if (Math.abs(power) > THRESHOLD) throwOut(power > 0 ? 'right' : 'left');
    else if (reduced) x.set(0);
    else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
  };

  return (
    <SwipeCardItemContext value={x}>
      <motion.div
        data-slot="swipe-card-item"
        className={cn(
          'relative cursor-grab touch-pan-y select-none active:cursor-grabbing [&_img]:pointer-events-none',
          className,
        )}
        style={{ x, rotate }}
        drag="x"
        onDragEnd={onDragEnd}
        initial={reduced || enterFrom !== null ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </SwipeCardItemContext>
  );
}

/** A stamp over the item that fades in while it is dragged towards `direction`. */
function SwipeCardStamp({
  direction,
  className,
  children,
}: {
  direction: SwipeDirection;
  className?: string;
  children: ReactNode;
}) {
  const x = use(SwipeCardItemContext);
  if (!x) throw new Error('SwipeCardStamp must be used inside <SwipeCardItem>');
  const opacity = useTransform(
    x,
    direction === 'right' ? [20, THRESHOLD] : [-THRESHOLD, -20],
    direction === 'right' ? [0, 1] : [1, 0],
  );
  return (
    <motion.span
      aria-hidden
      data-slot="swipe-card-stamp"
      style={{ opacity }}
      className={cn(
        'pointer-events-none absolute top-6 rounded-lg border-4 border-current bg-card/85 px-3 py-1 text-2xl font-black tracking-widest uppercase',
        // Like a dating app: the "yes" stamp sits on the side the card leaves from.
        direction === 'right'
          ? 'left-4 -rotate-12 text-emerald-700 dark:text-emerald-400'
          : 'right-4 rotate-12 text-red-700 dark:text-red-400',
        className,
      )}
    >
      {children}
    </motion.span>
  );
}

type ButtonProps = ComponentProps<'button'> & { asChild?: boolean };

/** Swipes the current item towards `direction`, with the same animation as a drag. */
function SwipeCardTrigger({
  direction,
  asChild = false,
  onClick,
  disabled,
  ...props
}: ButtonProps & { direction: SwipeDirection }) {
  const { swipe, hasItem } = useSwipeCard();
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="swipe-card-trigger"
      type="button"
      disabled={disabled || !hasItem}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) swipe(direction);
      }}
      {...props}
    />
  );
}

/** Calls onUndo; the undone item comes back from the side it left. */
function SwipeCardUndo({ asChild = false, onClick, disabled, ...props }: ButtonProps) {
  const { undo, canUndo } = useSwipeCard();
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="swipe-card-undo"
      type="button"
      disabled={disabled || !canUndo}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) undo();
      }}
      {...props}
    />
  );
}

export { SwipeCard, SwipeCardItem, SwipeCardStamp, SwipeCardTrigger, SwipeCardUndo };
