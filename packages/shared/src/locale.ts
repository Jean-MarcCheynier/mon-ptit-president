import { z } from 'zod';

export const LOCALES = ['fr', 'en'] as const;
export const DEFAULT_LOCALE = 'fr';
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;
