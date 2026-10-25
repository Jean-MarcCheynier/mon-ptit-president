import { zodResolver } from '@hookform/resolvers/zod';
import {
  LOCALES,
  type PublicUser,
  passwordSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@presidency-bingo/shared';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { meQuery, useLogout } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  if (!user) return null;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      <ProfileCard user={user} />
      <PasswordCard user={user} />
      <AccountsCard user={user} />
      <SessionsCard />
    </div>
  );
}

function ProfileCard({ user }: { user: PublicUser }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name, locale: user.locale as UpdateProfileInput['locale'] },
  });

  const update = useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<PublicUser>('/me', { method: 'PATCH', body: input }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(meQuery.queryKey, updated);
      await i18n.changeLanguage(updated.locale);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.profile.title')}</CardTitle>
        <CardDescription>{t('settings.profile.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-sm gap-4"
          noValidate
          onSubmit={form.handleSubmit((values) => update.mutate(values))}
        >
          <FormField
            id="name"
            label={t('common.name')}
            error={form.formState.errors.name}
            {...form.register('name')}
          />
          <div className="grid gap-2">
            <Label htmlFor="locale">{t('common.language')}</Label>
            <select
              id="locale"
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              {...form.register('locale')}
            >
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {t(`languages.${locale}`)}
                </option>
              ))}
            </select>
          </div>
          {update.isSuccess ? <FormAlert variant="success">{t('common.saved')}</FormAlert> : null}
          {update.error ? (
            <FormAlert variant="error">{errorMessage(t, update.error)}</FormAlert>
          ) : null}
          <Button type="submit" className="justify-self-start" disabled={update.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const passwordFormSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function PasswordCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema) });

  const change = useMutation({
    mutationFn: (input: PasswordFormValues) =>
      api('/auth/password', { method: 'POST', body: input }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries(meQuery);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.password.title')}</CardTitle>
        <CardDescription>
          {user.hasPassword
            ? t('settings.password.descriptionChange')
            : t('settings.password.descriptionSet')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-sm gap-4"
          noValidate
          onSubmit={form.handleSubmit((values) => change.mutate(values))}
        >
          {user.hasPassword ? (
            <FormField
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              label={t('settings.password.current')}
              error={form.formState.errors.currentPassword}
              {...form.register('currentPassword')}
            />
          ) : null}
          <FormField
            id="newPassword"
            type="password"
            autoComplete="new-password"
            label={t('settings.password.new')}
            error={form.formState.errors.newPassword}
            {...form.register('newPassword')}
          />
          {change.isSuccess ? (
            <FormAlert variant="success">{t('settings.password.success')}</FormAlert>
          ) : null}
          {change.error ? (
            <FormAlert variant="error">{errorMessage(t, change.error)}</FormAlert>
          ) : null}
          <Button type="submit" className="justify-self-start" disabled={change.isPending}>
            {t('settings.password.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountsCard({ user }: { user: PublicUser }) {
  const { t } = useTranslation();
  const googleLinked = user.providers.includes('google');
  const rows = [
    { label: t('settings.accounts.password'), linked: user.hasPassword },
    { label: t('settings.accounts.google'), linked: googleLinked },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.accounts.title')}</CardTitle>
        <CardDescription>{t('settings.accounts.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="grid gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex max-w-sm justify-between">
              <span>{row.label}</span>
              <span className={row.linked ? 'font-medium' : 'text-muted-foreground'}>
                {row.linked ? t('settings.accounts.linked') : t('settings.accounts.notLinked')}
              </span>
            </li>
          ))}
        </ul>
        {googleLinked ? null : (
          <p className="text-sm text-muted-foreground">{t('settings.accounts.googleHint')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const { t } = useTranslation();
  const logout = useLogout();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sessions.title')}</CardTitle>
        <CardDescription>{t('settings.sessions.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={() => logout.mutate(true)}
          disabled={logout.isPending}
        >
          {t('settings.sessions.logoutAll')}
        </Button>
      </CardContent>
    </Card>
  );
}
