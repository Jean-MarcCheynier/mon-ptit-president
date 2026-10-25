import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { meQuery } from '@/lib/auth';

export const Route = createFileRoute('/_app/')({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  return (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold">{t('home.title', { name: user?.name })}</h1>
      <p className="text-muted-foreground">{t('home.description')}</p>
    </div>
  );
}
