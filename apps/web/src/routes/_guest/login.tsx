import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorCode, type LoginInput, loginSchema, type PublicUser } from '@presidency-bingo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthCard } from '@/components/auth-card';
import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { GoogleButton } from '@/components/google-button';
import { Button } from '@/components/ui/button';
import { ApiRequestError, api } from '@/lib/api';
import { meQuery } from '@/lib/auth';
import { errorMessage, translate } from '@/lib/errors';

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute('/_guest/login')({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      api<PublicUser>('/auth/login', { method: 'POST', body: input }),
    onSuccess: async (user) => {
      queryClient.setQueryData(meQuery.queryKey, user);
      // Only follow same-app paths.
      const target = search.redirect?.startsWith('/') ? search.redirect : '/';
      await navigate({ to: target });
    },
  });

  const notVerified =
    login.error instanceof ApiRequestError && login.error.code === ErrorCode.EMAIL_NOT_VERIFIED;

  return (
    <AuthCard title={t('login.title')} description={t('login.description')}>
      {search.error ? (
        <FormAlert variant="error">
          {translate(t, `errors.${search.error}`, t('errors.generic'))}
        </FormAlert>
      ) : null}
      <GoogleButton />
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
      >
        <FormField
          id="email"
          type="email"
          autoComplete="email"
          label={t('common.email')}
          error={form.formState.errors.email}
          {...form.register('email')}
        />
        <FormField
          id="password"
          type="password"
          autoComplete="current-password"
          label={t('common.password')}
          error={form.formState.errors.password}
          {...form.register('password')}
        />
        <Link to="/forgot-password" className="-mt-2 text-sm text-muted-foreground hover:underline">
          {t('login.forgot')}
        </Link>
        {login.error ? (
          <FormAlert variant="error">
            {errorMessage(t, login.error)}
            {notVerified ? (
              <Link
                to="/check-email"
                search={{ email: form.getValues('email') }}
                className="mt-1 block font-medium underline"
              >
                {t('login.resend')}
              </Link>
            ) : null}
          </FormAlert>
        ) : null}
        <Button type="submit" disabled={login.isPending}>
          {t('login.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-foreground hover:underline">
          {t('login.register')}
        </Link>
      </p>
    </AuthCard>
  );
}
