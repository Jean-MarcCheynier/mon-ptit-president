import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@presidency-bingo/shared';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/auth-card';
import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { GoogleButton } from '@/components/google-button';
import { Button } from '@/components/ui/button';
import { currentLocale } from '@/i18n';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_guest/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const register = useMutation({
    mutationFn: (input: RegisterInput) =>
      api('/auth/register', { method: 'POST', body: { ...input, locale: currentLocale() } }),
    onSuccess: (_data, input) => navigate({ to: '/check-email', search: { email: input.email } }),
  });

  return (
    <AuthCard title={t('register.title')} description={t('register.description')}>
      <GoogleButton />
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => register.mutate(values))}
      >
        <FormField
          id="name"
          autoComplete="name"
          label={t('common.name')}
          error={form.formState.errors.name}
          {...form.register('name')}
        />
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
          autoComplete="new-password"
          label={t('common.password')}
          hint={t('register.passwordHint')}
          error={form.formState.errors.password}
          {...form.register('password')}
        />
        {register.error ? (
          <FormAlert variant="error">{errorMessage(t, register.error)}</FormAlert>
        ) : null}
        <Button type="submit" disabled={register.isPending}>
          {t('register.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('register.hasAccount')}{' '}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          {t('register.login')}
        </Link>
      </p>
    </AuthCard>
  );
}
