import { ErrorCode, type PublicUser } from '@presidency-bingo/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ApiRequestError, api } from './api';

/** The signed-in user, or null. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<PublicUser | null> => {
    try {
      return await api<PublicUser>('/me');
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.UNAUTHENTICATED) return null;
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
});

export const providersQuery = queryOptions({
  queryKey: ['auth', 'providers'],
  queryFn: () => api<{ google: boolean }>('/auth/providers'),
  staleTime: Number.POSITIVE_INFINITY,
});

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (everywhere: boolean) =>
      api<void>(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }),
    onSettled: async () => {
      queryClient.setQueryData(meQuery.queryKey, null);
      await navigate({ to: '/login' });
      queryClient.clear();
    },
  });
}
