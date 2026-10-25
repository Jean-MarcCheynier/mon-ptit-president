import { type ApiError, ErrorCode } from '@presidency-bingo/shared';

export class ApiRequestError extends Error {
  constructor(readonly body: ApiError) {
    super(body.message);
  }

  get code() {
    return this.body.code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

// Shared by concurrent requests so a burst of 401s triggers a single refresh.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function readError(res: Response): Promise<ApiError> {
  try {
    return (await res.json()) as ApiError;
  } catch {
    return { statusCode: res.status, code: 'NETWORK_ERROR', message: res.statusText };
  }
}

/**
 * Calls the API (same origin, cookies sent automatically). When the access token has
 * expired, refreshes the session once and replays the request.
 */
export async function api<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send();
  if (res.status === 401) {
    const error = await readError(res.clone());
    if (error.code === ErrorCode.UNAUTHENTICATED) {
      await refreshSession();
      // Replay even if our refresh lost a race: another tab may have refreshed the cookies.
      res = await send();
    }
  }

  if (!res.ok) throw new ApiRequestError(await readError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
