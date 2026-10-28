import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initials, PoliticianAvatar } from './politician-avatar';

describe('initials', () => {
  it('uses the first and last words', () => {
    expect(initials('Édouard Philippe')).toBe('ÉP');
    expect(initials('Jean-Luc Mélenchon')).toBe('JM');
    expect(initials('Marion Maréchal')).toBe('MM');
    expect(initials('Cher')).toBe('C');
  });
});

describe('PoliticianAvatar', () => {
  it('falls back to initials without a photo', () => {
    render(<PoliticianAvatar name="Raphaël Glucksmann" photoUrl={null} />);
    expect(screen.getByText('RG')).toBeInTheDocument();
  });
});
