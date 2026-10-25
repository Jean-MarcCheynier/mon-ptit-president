import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthCard } from '@/components/auth-card';
import { FormAlert } from '@/components/form-alert';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_guest/check-email')({
  validateSearch: z.object({ email: z.string().optional() }),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { t } = useTranslation();
  const { email } = Route.useSearch();

  const resend = useMutation({
    mutationFn: () => api('/auth/resend-verification', { method: 'POST', body: { email } }),
  });

  return (
    <AuthCard
      title={t('checkEmail.title')}
      description={
        email ? t('checkEmail.description', { email }) : t('checkEmail.descriptionNoEmail')
      }
    >
      <p className="text-sm text-muted-foreground">{t('checkEmail.spam')}</p>
      {resend.isSuccess ? <FormAlert variant="success">{t('checkEmail.resent')}</FormAlert> : null}
      {resend.error ? <FormAlert variant="error">{errorMessage(t, resend.error)}</FormAlert> : null}
      {email ? (
        <Button variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>
          {t('checkEmail.resend')}
        </Button>
      ) : null}
      <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
        {t('common.backToLogin')}
      </Link>
    </AuthCard>
  );
}
