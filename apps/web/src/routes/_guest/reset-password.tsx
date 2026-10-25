import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@presidency-bingo/shared';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthCard } from '@/components/auth-card';
import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_guest/reset-password')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPasswordPage,
});

const formSchema = z.object({ password: passwordSchema });
type FormValues = z.infer<typeof formSchema>;

function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const reset = useMutation({
    mutationFn: ({ password }: FormValues) =>
      api('/auth/reset-password', { method: 'POST', body: { token, password } }),
  });

  if (!token) {
    return (
      <AuthCard title={t('resetPassword.title')}>
        <FormAlert variant="error">{t('resetPassword.missingToken')}</FormAlert>
        <Button asChild variant="outline">
          <Link to="/forgot-password">{t('forgotPassword.submit')}</Link>
        </Button>
      </AuthCard>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthCard title={t('resetPassword.title')}>
        <FormAlert variant="success">{t('resetPassword.success')}</FormAlert>
        <Button asChild>
          <Link to="/login">{t('login.submit')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('resetPassword.title')} description={t('resetPassword.description')}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => reset.mutate(values))}
      >
        <FormField
          id="password"
          type="password"
          autoComplete="new-password"
          label={t('settings.password.new')}
          error={form.formState.errors.password}
          {...form.register('password')}
        />
        {reset.error ? <FormAlert variant="error">{errorMessage(t, reset.error)}</FormAlert> : null}
        <Button type="submit" disabled={reset.isPending}>
          {t('resetPassword.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
