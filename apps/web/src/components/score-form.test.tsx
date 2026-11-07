import type { ElectionCandidateDto } from '@presidency-bingo/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScoreForm } from './score-form';

const candidate = (politicianId: string, name: string): ElectionCandidateDto => ({
  politicianId,
  name,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status: 'QUALIFIED',
});

const candidates = [candidate('a', 'Anne Alpha'), candidate('b', 'Bruno Beta')];

const setup = (entries = [{ politicianId: 'a', score: 600 }]) => {
  const onSave = vi.fn(() => Promise.resolve());
  const onValidate = vi.fn();
  render(
    <ScoreForm
      candidates={candidates}
      entries={entries}
      onSave={onSave}
      onValidate={onValidate}
      validating={false}
    />,
  );
  const field = (name: string) => screen.getByLabelText(`Score of ${name}`);
  const validate = screen.getByRole('button', { name: 'Validate my prediction' });
  return { onSave, onValidate, field, validate };
};

describe('ScoreForm', () => {
  it('shows the saved scores and what remains to share out', () => {
    const { field, validate } = setup();
    expect(field('Anne Alpha')).toHaveValue('60');
    expect(screen.getByText('Left to share out: 40.0%')).toBeInTheDocument();
    expect(screen.getByText('1 candidate without a score.')).toBeInTheDocument();
    expect(validate).toBeDisabled();
  });

  it('saves a score when its field loses focus', () => {
    const { field, onSave } = setup();
    fireEvent.change(field('Bruno Beta'), { target: { value: '39,5' } });
    expect(screen.getByText('Left to share out: 0.5%')).toBeInTheDocument();
    fireEvent.blur(field('Bruno Beta'));
    expect(onSave).toHaveBeenCalledWith('b', 395);

    // Unchanged fields aren't saved again; an emptied one is cleared.
    fireEvent.blur(field('Anne Alpha'));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.change(field('Anne Alpha'), { target: { value: '' } });
    fireEvent.blur(field('Anne Alpha'));
    expect(onSave).toHaveBeenLastCalledWith('a', null);
  });

  it('flags an invalid score and an exceeded total', () => {
    const { field, validate, onSave } = setup();
    fireEvent.change(field('Bruno Beta'), { target: { value: '12.34' } });
    fireEvent.blur(field('Bruno Beta'));
    expect(onSave).not.toHaveBeenCalled();
    expect(field('Bruno Beta')).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a number between 0 and 100, with at most one decimal.'),
    ).toBeInTheDocument();

    fireEvent.change(field('Bruno Beta'), { target: { value: '50' } });
    expect(screen.getByText('Total exceeded by 10.0%')).toBeInTheDocument();
    expect(validate).toBeDisabled();
  });

  it('saves the pending fields, then validates at exactly 100 %', async () => {
    const { field, validate, onSave, onValidate } = setup();
    fireEvent.change(field('Bruno Beta'), { target: { value: '40' } });
    expect(validate).toBeEnabled();
    fireEvent.click(validate);
    await waitFor(() => expect(onValidate).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('b', 400);
  });
});
