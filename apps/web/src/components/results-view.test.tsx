import type { ResultDto } from '@presidency-bingo/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultsView } from './results-view';

const result: ResultDto = {
  correct: 1,
  decisions: 2,
  points: 58,
  entries: [
    {
      politicianId: 'a',
      name: 'Anne Alpha',
      photoUrl: null,
      isCandidate: true,
      qualified: true,
      agreement: 0.12,
      points: 58,
    },
    {
      politicianId: 'b',
      name: 'Bruno Beta',
      photoUrl: null,
      isCandidate: true,
      qualified: false,
      agreement: null,
      points: 0,
    },
  ],
};

describe('ResultsView', () => {
  it('shows the totals and each decision against reality', () => {
    render(<ResultsView result={result} />);
    expect(screen.getByText('1 / 2 right decisions')).toBeInTheDocument();
    expect(screen.getAllByText('58 points')).toHaveLength(2);
    expect(screen.getByText(/12\s?% of the other players agreed with you/)).toBeInTheDocument();
    expect(screen.getByText('Your pick: Qualified · Reality: Out')).toBeInTheDocument();
    expect(screen.getByText('No other player decided on them')).toBeInTheDocument();
    expect(screen.getByLabelText('Wrong')).toBeInTheDocument();
  });
});
