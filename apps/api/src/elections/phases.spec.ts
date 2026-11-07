import { type PhaseSchedule, phaseStatus, phaseWindow } from './phases.js';

const at = (iso: string) => new Date(iso);

const election: PhaseSchedule = {
  createdAt: at('2026-07-01T00:00:00Z'),
  predictionsLockAt: at('2027-03-12T22:59:59Z'),
  officialListPublishedAt: at('2027-03-20T12:00:00Z'),
  firstRoundClosesAt: at('2027-04-16T21:59:59Z'),
};

const status = (schedule: PhaseSchedule, phase: Parameters<typeof phaseWindow>[1], now: string) =>
  phaseStatus(phaseWindow(schedule, phase), at(now));

describe('phase status', () => {
  it('opens the qualifiers at creation and closes them at predictionsLockAt', () => {
    expect(status(election, 'QUALIFIERS', '2026-11-07T00:00:00Z')).toBe('OPEN');
    expect(status(election, 'QUALIFIERS', '2027-03-12T22:59:59Z')).toBe('CLOSED');
  });

  it('opens the first round at the publication of the official list', () => {
    expect(status(election, 'FIRST_ROUND', '2027-03-20T11:59:59Z')).toBe('UPCOMING');
    expect(status(election, 'FIRST_ROUND', '2027-03-20T12:00:00Z')).toBe('OPEN');
    expect(status(election, 'FIRST_ROUND', '2027-04-16T21:59:58Z')).toBe('OPEN');
    expect(status(election, 'FIRST_ROUND', '2027-04-16T21:59:59Z')).toBe('CLOSED');
  });

  it('keeps the first round upcoming while a date is unknown', () => {
    const unpublished = { ...election, officialListPublishedAt: null };
    expect(status(unpublished, 'FIRST_ROUND', '2027-04-01T00:00:00Z')).toBe('UPCOMING');
    const unscheduled = { ...election, firstRoundClosesAt: null };
    expect(status(unscheduled, 'FIRST_ROUND', '2027-04-01T00:00:00Z')).toBe('UPCOMING');
  });

  it('closes a phase whose closing has passed, even if it never opened', () => {
    const unpublished = { ...election, officialListPublishedAt: null };
    expect(status(unpublished, 'FIRST_ROUND', '2027-04-17T00:00:00Z')).toBe('CLOSED');
  });

  it('does not open the second round yet', () => {
    expect(status(election, 'SECOND_ROUND', '2027-04-25T00:00:00Z')).toBe('UPCOMING');
  });
});
