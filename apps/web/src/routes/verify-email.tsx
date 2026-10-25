import type { PublicUser } from '@presidency-bingo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthCard } from '@/components/auth-card';
import { FormAlert } from '@/components/form-alert';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { meQuery } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

// Outside the guest layout: the link may be opened while signed in to another account.
export const Route = createFileRoute('/verify-email')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: VerifyEmailPage,
});

/**
 * The email link only opens this page; verification is a POST so that link scanners
 * in mail clients can't consume the token by prefetching it.
 */
function VerifyEmailPage() {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: (value: string) =>
      api<PublicUser>('/auth/verify-email', { method: 'POST', body: { token: value } }),
    onSuccess: async (user) => {
      queryClient.setQueryData(meQuery.queryKey, user);
      await navigate({ to: '/', replace: true });
    },
  });
  const { mutate } = verify;

  useEffect(() => {
    // StrictMode runs effects twice; the token is single-use.
    if (!token || started.current) return;
    started.current = true;
    mutate(token);
  }, [token, mutate]);

  const failed = !token || verify.isError;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <AuthCard title={t('verifyEmail.title')}>
          {failed ? (
            <>
              <FormAlert variant="error">
                {verify.error ? errorMessage(t, verify.error) : t('verifyEmail.failed')}
              </FormAlert>
              <Button asChild variant="outline">
                <Link to="/login">{t('common.backToLogin')}</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('verifyEmail.pending')}</p>
          )}
        </AuthCard>
      </div>
    </div>
  );
}
