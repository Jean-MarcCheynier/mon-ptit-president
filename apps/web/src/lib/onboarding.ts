import type { PublicUser } from '@presidency-bingo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { meQuery } from './auth';
import { phasesQuery } from './phases';

/**
 * Records that the player went through (or skipped) the presentation: it no longer holds the
 * qualifiers back, nor is it proposed again until its next version. Resolves once the phases are
 * refetched, so the journey shows what it opened.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<PublicUser>('/me/onboarding', { method: 'POST' }),
    onSuccess: async (user) => {
      queryClient.setQueryData(meQuery.queryKey, user);
      await queryClient.invalidateQueries({ queryKey: phasesQuery.queryKey });
    },
  });
}
