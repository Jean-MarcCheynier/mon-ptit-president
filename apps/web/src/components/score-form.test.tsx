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
  const field = (name: string) => screen.getByRole('textbox', { name: `Score of ${name}` });
  const slider = (name: string) => screen.getByRole('slider', { name: `Score of ${name}` });
  const validate = screen.getByRole('button', { name: 'Validate my prediction' });
  return { onSave, onValidate, field, slider, validate };
};

describe('ScoreForm', () => {
  it('starts every score at 0 % and shows what remains to share out', () => {
    const { field, slider, validate } = setup();
    expect(field('Anne Alpha')).toHaveValue('60');
    expect(slider('Anne Alpha')).toHaveAttribute('aria-valuenow', '600');
    expect(field('Bruno Beta')).toHaveValue('0');
    expect(slider('Bruno Beta')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Left to share out: 40.0%')).toBeInTheDocument();
    // The total is only a guide.
    expect(validate).toBeEnabled();
  });

  it('keeps the slider and the field in sync', () => {
    const { field, slider, onSave } = setup();
    fireEvent.change(field('Bruno Beta'), { target: { value: '39,5' } });
    expect(slider('Bruno Beta')).toHaveAttribute('aria-valuenow', '395');

    // Keyboard on the slider: one step is 0.1 point, saved at once.
    fireEvent.keyDown(slider('Anne Alpha'), { key: 'ArrowRight' });
    expect(field('Anne Alpha')).toHaveValue('60.1');
    expect(onSave).toHaveBeenCalledWith('a', 601);
  });

  it('saves a score when its field loses focus', () => {
    const { field, onSave } = setup();
    fireEvent.change(field('Bruno Beta'), { target: { value: '39,5' } });
    expect(screen.getByText('Left to share out: 0.5%')).toBeInTheDocument();
    fireEvent.blur(field('Bruno Beta'));
    expect(onSave).toHaveBeenCalledWith('b', 395);

    // Unchanged fields aren't saved again; an emptied one counts as 0 %.
    fireEvent.blur(field('Anne Alpha'));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.change(field('Anne Alpha'), { target: { value: '' } });
    fireEvent.blur(field('Anne Alpha'));
    expect(onSave).toHaveBeenLastCalledWith('a', 0);
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
    expect(validate).toBeDisabled();

    fireEvent.change(field('Bruno Beta'), { target: { value: '50' } });
    expect(screen.getByText('Total exceeded by 10.0%')).toBeInTheDocument();
    expect(validate).toBeEnabled();
  });

  it('saves the pending fields, then validates whatever the total', async () => {
    const { field, validate, onSave, onValidate } = setup();
    fireEvent.change(field('Bruno Beta'), { target: { value: '25' } });
    fireEvent.click(validate);
    await waitFor(() => expect(onValidate).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('b', 250);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
