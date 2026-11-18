import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import type { PhaseAction } from '@/lib/phases';
import { usePhaseActionButton } from './phase-action';

const CLOSES = '2099-03-12T12:00:00Z';

function ActionButton({
  action,
  closesAt = CLOSES,
  label,
}: {
  action: PhaseAction | null;
  closesAt?: string | null;
  label?: string;
}) {
  const button = usePhaseActionButton(action, closesAt, label);
  if (!button) return null;
  return <Button {...button.props}>{button.content}</Button>;
}

describe('usePhaseActionButton', () => {
  it('invites to predict, with the deadline below', () => {
    render(<ActionButton action="PREDICT" />);
    const button = screen.getByRole('button', { name: /^Make your prediction! by March 12, / });
    expect(button).toHaveTextContent(/by March 12, \d{1,2}(:\d{2})? (AM|PM)$/);
  });

  it('labels a draft or an edit, still with the deadline', () => {
    render(
      <>
        <ActionButton action="RESUME" label="Resume your prediction (5/44)" />
        <ActionButton action="EDIT" />
      </>,
    );
    expect(
      screen.getByRole('button', { name: /^Resume your prediction \(5\/44\) by March 12/ }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /^Edit your prediction by March 12/ })).toBeVisible();
  });

  it('views a closed phase with an icon alone', () => {
    render(<ActionButton action="VIEW" />);
    const button = screen.getByRole('button', { name: 'View your prediction' });
    expect(button).toHaveTextContent(/^$/);
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the results without a deadline', () => {
    render(<ActionButton action="RESULTS" />);
    expect(screen.getByRole('button', { name: 'See your results!' })).toBeVisible();
  });

  it('leaves the deadline out without a closing, and renders nothing without an action', () => {
    const { container } = render(
      <>
        <ActionButton action="PREDICT" closesAt={null} />
        <ActionButton action={null} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Make your prediction!' })).toBeVisible();
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });
});
