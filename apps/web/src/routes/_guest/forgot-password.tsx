import { zodResolver } from '@hookform/resolvers/zod';
import { type EmailOnlyInput, emailOnlySchema } from '@presidency-bingo/shared';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/auth-card';
import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_guest/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema) });

  const forgot = useMutation({
    mutationFn: (input: EmailOnlyInput) =>
      api('/auth/forgot-password', { method: 'POST', body: input }),
    onSuccess: (_data, input) => navigate({ to: '/check-email', search: { email: input.email } }),
  });

  return (
    <AuthCard title={t('forgotPassword.title')} description={t('forgotPassword.description')}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => forgot.mutate(values))}
      >
        <FormField
          id="email"
          type="email"
          autoComplete="email"
          label={t('common.email')}
          error={form.formState.errors.email}
          {...form.register('email')}
        />
        {forgot.error ? (
          <FormAlert variant="error">{errorMessage(t, forgot.error)}</FormAlert>
        ) : null}
        <Button type="submit" disabled={forgot.isPending}>
          {t('forgotPassword.submit')}
        </Button>
      </form>
      <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
        {t('common.backToLogin')}
      </Link>
    </AuthCard>
  );
}
