import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { DraftActions } from './draft-actions';

const setup = (validatedAt: string | null) => {
  const onCancel = vi.fn();
  render(
    <DraftActions
      validatedAt={validatedAt}
      onCancel={onCancel}
      cancelling={false}
      validate={<Button>Validate my prediction</Button>}
    />,
  );
  return { onCancel };
};

describe('DraftActions', () => {
  it('without a validated prediction, offers to validate only', () => {
    setup(null);
    expect(screen.getByRole('button', { name: 'Validate my prediction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByText(/stays the one validated/)).not.toBeInTheDocument();
  });

  it('recalls the validated prediction above the buttons, cancel before validate', async () => {
    const { onCancel } = setup('2026-11-23T09:07:00.000Z');
    const sentence = screen.getByText(/^Your prediction stays the one validated on .+ until/);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const validate = screen.getByRole('button', { name: 'Validate my prediction' });
    expect(sentence.compareDocumentPosition(cancel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(cancel.compareDocumentPosition(validate)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await userEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
