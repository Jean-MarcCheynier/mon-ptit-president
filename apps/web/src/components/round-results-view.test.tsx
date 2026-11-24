import type { RoundResultDto } from '@presidency-bingo/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundResultsView } from './round-results-view';

const result: RoundResultDto = {
  points: 140,
  finalists: 1,
  bonus: 50,
  entries: [
    {
      politicianId: 'a',
      name: 'Anne Alpha',
      photoUrl: null,
      predicted: 400,
      actual: 4000,
      gap: 0,
      points: 30,
      predictedFinalist: true,
      finalist: true,
    },
    {
      politicianId: 'b',
      name: 'Bruno Beta',
      photoUrl: null,
      predicted: 252,
      actual: 3500,
      gap: 980,
      points: 0,
      predictedFinalist: false,
      finalist: true,
    },
    {
      politicianId: 'c',
      name: 'Chloé Gamma',
      photoUrl: null,
      predicted: 300,
      actual: 2500,
      gap: 20,
      points: 28.8,
      predictedFinalist: true,
      finalist: false,
    },
  ],
};

describe('RoundResultsView', () => {
  it('shows the total, the finalists and each score against the real one', () => {
    render(<RoundResultsView result={result} final={false} />);
    expect(screen.getByText('140 points')).toBeInTheDocument();
    expect(screen.getByText('Finalists found: 1 / 2, a 50-point bonus')).toBeInTheDocument();
    expect(screen.getByText(/provisional results/)).toBeInTheDocument();
    expect(screen.getByText('Your score: 40.0% · Actual: 40.00%')).toBeInTheDocument();
    expect(screen.getByText('Gap: 0.20 points')).toBeInTheDocument();
    expect(screen.getByText('Gap: 9.80 points')).toBeInTheDocument();
    expect(screen.getByText('28.8 pts')).toBeInTheDocument();
    expect(screen.getByText('Finalist, and you saw it coming')).toBeInTheDocument();
    expect(screen.getByText('Finalist')).toBeInTheDocument();
  });

  it('says when the results are the official ones', () => {
    render(<RoundResultsView result={result} final />);
    expect(screen.getByText(/official results/)).toBeInTheDocument();
  });
});
