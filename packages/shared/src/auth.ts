import { z } from 'zod';
import { localeSchema } from './locale.js';

// Messages are i18n keys, translated by the front.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'validation.email.invalid' }));

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: 'validation.password.min' })
  .max(PASSWORD_MAX_LENGTH, { error: 'validation.password.max' });

export const nameSchema = z
  .string()
  .trim()
  .min(1, { error: 'validation.name.required' })
  .max(100, { error: 'validation.name.max' });

const tokenSchema = z.string().min(1, { error: 'validation.token.required' });

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // No length rule on login: only the stored hash decides.
  password: z.string().min(1, { error: 'validation.password.required' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({ token: tokenSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  // Optional for Google-only accounts that have no password yet.
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: nameSchema,
  locale: localeSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const AUTH_PROVIDERS = ['google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
  providers: AuthProvider[];
  createdAt: string;
}

export const ErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  OAUTH_FAILED: 'OAUTH_FAILED',
  NO_CURRENT_ELECTION: 'NO_CURRENT_ELECTION',
  UNKNOWN_CANDIDATE: 'UNKNOWN_CANDIDATE',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  issues?: { path: string; message: string }[];
}

export interface MessageResponse {
  message: string;
}
