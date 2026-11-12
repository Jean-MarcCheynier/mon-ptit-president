import type { PlayerPhaseDto } from '@presidency-bingo/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseTrail } from './phase-trail';

const LOCK = '2099-03-12T17:00:00Z';
const FIRST_ROUND_CLOSES = '2099-04-16T21:59:59Z';

const journey = (overrides: Partial<Record<string, Partial<PlayerPhaseDto>>> = {}) =>
  (
    [
      { phase: 'PRESENTATION', state: 'UPCOMING', closesAt: null, playable: false },
      { phase: 'QUALIFIERS', state: 'TODO', closesAt: LOCK, playable: true },
      { phase: 'WINNER', state: 'UPCOMING', closesAt: LOCK, playable: false },
      { phase: 'FIRST_ROUND', state: 'UPCOMING', closesAt: FIRST_ROUND_CLOSES, playable: true },
      { phase: 'SECOND_ROUND', state: 'UPCOMING', closesAt: null, playable: false },
    ] satisfies PlayerPhaseDto[]
  ).map((p) => ({ ...p, ...overrides[p.phase] }));

const actions = {
  QUALIFIERS: <button type="button">Qualifiers action</button>,
  FIRST_ROUND: <button type="button">First-round action</button>,
};

const step = (name: string) => {
  const item = screen.getByText(name).closest('li');
  if (!item) throw new Error(`No step ${name}`);
  return item;
};

describe('PhaseTrail', () => {
  it('lists the five phases in order, with their state', () => {
    render(<PhaseTrail phases={journey()} actions={actions} />);
    const steps = within(screen.getByRole('list', { name: 'Your journey' })).getAllByRole(
      'listitem',
    );
    expect(steps.map((s) => s.querySelector('p')?.textContent)).toEqual([
      'Introduction',
      'Qualifiers',
      'Winner',
      'First round',
      'Second round',
    ]);
    // Not built yet: "coming soon", without a closing.
    expect(within(step('Winner')).getByText('Coming soon')).toBeInTheDocument();
    expect(within(step('First round')).getByText(/^Upcoming · closes on/)).toBeInTheDocument();
  });

  it('puts the next phase forward, with its countdown and action', () => {
    render(<PhaseTrail phases={journey()} actions={actions} />);
    const qualifiers = step('Qualifiers');
    expect(qualifiers).toHaveAttribute('aria-current', 'step');
    expect(within(qualifiers).getByText(/^To do · closes in \d+d \d+h \d+m$/)).toBeInTheDocument();
    expect(within(qualifiers).getByRole('button', { name: 'Qualifiers action' })).toBeVisible();
    // An upcoming phase has no action.
    expect(screen.queryByRole('button', { name: 'First-round action' })).not.toBeInTheDocument();
  });

  it('moves on once a phase is done, keeping it open to edits', () => {
    render(
      <PhaseTrail
        phases={journey({ QUALIFIERS: { state: 'DONE' }, FIRST_ROUND: { state: 'TODO' } })}
        actions={actions}
      />,
    );
    expect(step('First round')).toHaveAttribute('aria-current', 'step');
    expect(step('Qualifiers')).not.toHaveAttribute('aria-current');
    expect(within(step('Qualifiers')).getByText(/^Done · closes on/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qualifiers action' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'First-round action' })).toBeVisible();
  });

  it('shows closed and skipped phases', () => {
    const past = '2020-03-12T17:00:00Z';
    render(
      <PhaseTrail
        phases={journey({
          QUALIFIERS: { state: 'SKIPPED', closesAt: past },
          WINNER: { state: 'SKIPPED', closesAt: past },
          FIRST_ROUND: { state: 'CLOSED', closesAt: past },
        })}
        actions={actions}
      />,
    );
    expect(within(step('Qualifiers')).getByText(/^Skipped · closed on/)).toBeInTheDocument();
    expect(within(step('Winner')).getByText(/^Skipped · closed on/)).toBeInTheDocument();
    expect(within(step('First round')).getByText(/^Closed · closed on/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { current: 'step' })).not.toBeInTheDocument();
  });

  it('closes a phase whose closing passed while the page was open', () => {
    const past = '2020-03-12T17:00:00Z';
    render(
      <PhaseTrail
        phases={journey({ QUALIFIERS: { state: 'TODO', closesAt: past } })}
        actions={actions}
      />,
    );
    expect(within(step('Qualifiers')).getByText(/^Skipped · closed on/)).toBeInTheDocument();
  });
});
