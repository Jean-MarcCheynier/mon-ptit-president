import type { TFunction } from 'i18next';
import { ApiRequestError } from './api';

/** Translates a dynamic key (API error code, Zod message) that the typed `t` can't check. */
export function translate(t: TFunction, key: string, fallback: string): string {
  return t(key as never, { defaultValue: fallback }) as string;
}

/** User-facing message for an API error code. */
export function errorMessage(t: TFunction, error: unknown): string {
  const generic = t('errors.generic');
  return error instanceof ApiRequestError ? translate(t, `errors.${error.code}`, generic) : generic;
}
