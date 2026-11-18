import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SwipeCard,
  SwipeCardItem,
  SwipeCardStack,
  SwipeCardStamp,
  SwipeCardTrigger,
  SwipeCardUndo,
} from './swipe-card';

/** A deck of names swiped in order: the current one on top, the next one behind it. */
function Deck({ names, onSwipe }: { names: string[]; onSwipe?: (name: string) => void }) {
  const [index, setIndex] = useState(0);
  const swiped = () => {
    onSwipe?.(names[index] ?? '');
    setIndex((i) => i + 1);
  };
  return (
    <SwipeCard
      onSwipeLeft={swiped}
      onSwipeRight={swiped}
      onUndo={() => setIndex((i) => i - 1)}
      canUndo={index > 0}
    >
      <SwipeCardStack>
        {[names[index], names[index + 1]].map((name, position) =>
          name ? (
            <SwipeCardItem key={name} behind={position === 1}>
              <h2>{name}</h2>
              <SwipeCardStamp direction="right">Stamp {name}</SwipeCardStamp>
            </SwipeCardItem>
          ) : null,
        )}
      </SwipeCardStack>
      <SwipeCardTrigger direction="right">Yes</SwipeCardTrigger>
      <SwipeCardUndo>Undo</SwipeCardUndo>
    </SwipeCard>
  );
}

const items = () => [...document.querySelectorAll('[data-slot="swipe-card-item"]')];
const item = (name: string) => screen.getByText(name).closest('[data-slot="swipe-card-item"]');

describe('SwipeCard', () => {
  // Reduced motion: swipes and undos happen at once, without waiting for animations.
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stacks the next item under the current one, hidden, inert and without stamp', () => {
    render(<Deck names={['Anne', 'Bruno', 'Chloé']} />);
    expect(items()).toHaveLength(2);
    expect(screen.getByRole('heading')).toHaveTextContent('Anne');
    expect(item('Bruno')).toHaveAttribute('aria-hidden', 'true');
    expect(item('Bruno')).toHaveAttribute('inert');
    expect(item('Anne')).not.toHaveAttribute('aria-hidden');
    expect(screen.queryByText('Stamp Bruno')).not.toBeInTheDocument();
    expect(screen.getByText('Stamp Anne')).toBeInTheDocument();
  });

  it('swipes the current item; the one behind comes to the front, same node', () => {
    const onSwipe = vi.fn();
    render(<Deck names={['Anne', 'Bruno', 'Chloé']} onSwipe={onSwipe} />);
    const bruno = item('Bruno');

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Yes' })));

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith('Anne');
    // Not remounted: its photo is already loaded.
    expect(item('Bruno')).toBe(bruno);
    expect(bruno).not.toHaveAttribute('aria-hidden');
    expect(bruno).not.toHaveAttribute('inert');
    expect(screen.getByText('Stamp Bruno')).toBeInTheDocument();
    expect(item('Chloé')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has nothing behind the last item, and nothing to swipe once all are gone', () => {
    render(<Deck names={['Anne', 'Bruno']} />);
    const yes = screen.getByRole('button', { name: 'Yes' });
    act(() => fireEvent.click(yes));
    expect(items()).toHaveLength(1);
    act(() => fireEvent.click(yes));
    expect(items()).toHaveLength(0);
    expect(yes).toBeDisabled();
  });

  it('puts an undone item back on top of the stack', () => {
    render(<Deck names={['Anne', 'Bruno', 'Chloé']} />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Yes' })));
    const bruno = item('Bruno');

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Undo' })));

    expect(screen.getByRole('heading')).toHaveTextContent('Anne');
    expect(item('Anne')).toHaveClass('z-10');
    expect(item('Bruno')).toBe(bruno);
    expect(bruno).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText('Chloé')).not.toBeInTheDocument();

    // The item put back is the one swiped next.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Yes' })));
    expect(screen.getByRole('heading')).toHaveTextContent('Bruno');
  });
});
