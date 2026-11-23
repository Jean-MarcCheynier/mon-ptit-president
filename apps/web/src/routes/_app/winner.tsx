import type { CurrentWinnerDto, FavoriteDto } from '@presidency-bingo/shared';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check, CircleCheck, Pencil, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DraftActions } from '@/components/draft-actions';
import { FormAlert } from '@/components/form-alert';
import { PageHeader } from '@/components/page-header';
import { PoliticianAvatar } from '@/components/politician-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/errors';
import { isWritable, phasesQuery, requirePhase, usePhaseState } from '@/lib/phases';
import { formatDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import {
  favoritesQuery,
  useChooseWinner,
  useDiscardWinnerDraft,
  useValidateWinner,
  winnerBallotQuery,
  winnerDraftQuery,
} from '@/lib/winner';

/** Reachable once the qualifiers are cleared (validated or closed); else back to the journey. */
export const Route = createFileRoute('/_app/winner')({
  // `edit`: change a validated prediction (the draft is only created by the first choice).
  validateSearch: z.object({ edit: z.boolean().optional() }),
  beforeLoad: ({ context }) => requirePhase(context.queryClient, 'WINNER'),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(phasesQuery),
      context.queryClient.query(favoritesQuery),
      context.queryClient.query(winnerDraftQuery),
      context.queryClient.query(winnerBallotQuery),
    ]),
  component: WinnerPage,
});

function WinnerPage() {
  const { t } = useTranslation();
  const [{ data: phases }] = useSuspenseQueries({ queries: [phasesQuery] });

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      {phases.length > 0 ? (
        <Winner />
      ) : (
        <>
          <PageHeader title={t('winner.title')} />
          <p className="text-muted-foreground">{t('election.none')}</p>
        </>
      )}
    </div>
  );
}

function Winner() {
  const { t, i18n } = useTranslation();
  const { edit } = Route.useSearch();
  const [{ data: phases }, { data: favorites }, { data: draft }, { data: current }] =
    useSuspenseQueries({
      queries: [phasesQuery, favoritesQuery, winnerDraftQuery, winnerBallotQuery],
    });
  const phase = phases.find((p) => p.phase === 'WINNER');
  const state = usePhaseState(phase);
  const { ballot } = current;
  const chosen = favorites.find((f) => f.id === ballot?.favoriteId);

  const header = (description: string) => (
    <PageHeader title={t('winner.title')} description={description} />
  );
  if (state === 'UPCOMING') return header(t('winner.upcoming'));
  if (!isWritable(state)) {
    if (!ballot || !chosen) return header(t('winner.notParticipated'));
    return (
      <>
        {header(
          t('winner.closed', { date: formatDateTime(ballot.validatedAt, i18n.resolvedLanguage) }),
        )}
        <div className="grid gap-4">
          <FavoriteRow favorite={chosen} />
          <Points points={current.points} />
        </div>
      </>
    );
  }

  const closesOn = phase?.closesAt
    ? t('winner.closesOn', { date: formatDateTime(phase.closesAt, i18n.resolvedLanguage) })
    : null;
  return (
    <>
      {header(closesOn ? `${t('winner.description')} ${closesOn}` : t('winner.description'))}
      {ballot && chosen && draft === null && !edit ? (
        <ValidatedWinner favorite={chosen} validatedAt={ballot.validatedAt} />
      ) : (
        <ChooseWinner favorites={favorites} draft={draft} ballot={ballot} />
      )}
    </>
  );
}

function ChooseWinner({
  favorites,
  draft,
  ballot,
}: {
  favorites: FavoriteDto[];
  draft: string | null;
  ballot: CurrentWinnerDto['ballot'];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const choose = useChooseWinner();
  const validate = useValidateWinner();
  const discard = useDiscardWinnerDraft();
  const selected = draft ?? ballot?.favoriteId ?? null;
  const error = choose.error ?? validate.error ?? discard.error;
  // Back to the validated choice: nothing to discard while no new choice was made.
  const cancel = () => {
    if (draft === null) return navigate({ search: {} });
    discard.mutate(undefined, { onSuccess: () => navigate({ search: {} }) });
  };

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label={t('winner.title')} className="grid gap-2">
        {favorites.map((favorite) => {
          const checked = favorite.id === selected;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a card-like option, styled as a whole.
            <button
              key={favorite.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={choose.isPending}
              onClick={() => choose.mutate(favorite.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent',
                checked && 'border-primary bg-primary/5 ring-1 ring-primary',
              )}
            >
              <FavoriteRow favorite={favorite} checked={checked} />
            </button>
          );
        })}
      </div>
      <DraftActions
        validatedAt={ballot?.validatedAt ?? null}
        onCancel={() => void cancel()}
        cancelling={discard.isPending}
        validate={
          <Button
            size="lg"
            disabled={draft === null || validate.isPending}
            // Like every phase: back to the journey once validated.
            onClick={() => validate.mutate(undefined, { onSuccess: () => navigate({ to: '/' }) })}
          >
            <CircleCheck />
            {t('winner.validate')}
          </Button>
        }
      />
      {error ? <FormAlert variant="error">{errorMessage(t, error)}</FormAlert> : null}
    </div>
  );
}

/** The validated prediction, with no edit in progress. */
function ValidatedWinner({
  favorite,
  validatedAt,
}: {
  favorite: FavoriteDto;
  validatedAt: string;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('winner.validatedTitle')}</CardTitle>
        <CardDescription>
          {t('winner.validatedOn', { date: formatDateTime(validatedAt, i18n.resolvedLanguage) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FavoriteRow favorite={favorite} />
        <Button variant="outline" onClick={() => navigate({ search: { edit: true } })}>
          <Pencil />
          {t('winner.edit')}
        </Button>
      </CardContent>
    </Card>
  );
}

/** A favorite with its odds; "autre candidat" when it has no politician. */
function FavoriteRow({ favorite, checked }: { favorite: FavoriteDto; checked?: boolean }) {
  const { t, i18n } = useTranslation();
  const { politician } = favorite;
  const odds = new Intl.NumberFormat(i18n.resolvedLanguage).format(favorite.odds);
  return (
    <span className="flex items-center gap-3">
      {politician ? (
        <PoliticianAvatar name={politician.name} photoUrl={politician.photoUrl} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserRound className="size-5 text-muted-foreground" />
        </span>
      )}
      <span className="grid flex-1">
        <span className="font-medium">{politician?.name ?? t('winner.other')}</span>
        {politician ? null : (
          <span className="text-xs text-muted-foreground">{t('winner.otherHint')}</span>
        )}
      </span>
      <span className="font-semibold tabular-nums">{t('winner.odds', { value: odds })}</span>
      {checked ? <Check className="size-4 text-primary" /> : null}
    </span>
  );
}

function Points({ points }: { points: number | null }) {
  const { t, i18n } = useTranslation();
  if (points === null) return null;
  const value = new Intl.NumberFormat(i18n.resolvedLanguage).format(points);
  return <p className="text-lg font-semibold">{t('winner.points', { value })}</p>;
}
