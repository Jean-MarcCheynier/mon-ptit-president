import { ErrorCode } from '@presidency-bingo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, api } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const unauthenticated = () =>
  json(401, {
    statusCode: 401,
    code: ErrorCode.UNAUTHENTICATED,
    message: 'Authentication required',
  });

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof mockFetch>, url: string) =>
  fetchMock.mock.calls.filter(([input]) => String(input) === url).length;

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes the session once and replays the request after a 401', async () => {
    let refreshed = false;
    const fetchMock = mockFetch((url) => {
      if (url === '/api/auth/refresh') {
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed ? json(200, { id: '1' }) : unauthenticated();
    });

    await expect(api('/me')).resolves.toEqual({ id: '1' });
    expect(calls(fetchMock, '/api/auth/refresh')).toBe(1);
    expect(calls(fetchMock, '/api/me')).toBe(2);
  });

  it('shares a single refresh between concurrent requests', async () => {
    let refreshed = false;
    const fetchMock = mockFetch(async (url) => {
      if (url === '/api/auth/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 10));
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed ? json(200, {}) : unauthenticated();
    });

    await Promise.all([api('/a'), api('/b'), api('/c')]);
    expect(calls(fetchMock, '/api/auth/refresh')).toBe(1);
  });

  it('does not refresh on business 401s such as wrong credentials', async () => {
    const fetchMock = mockFetch(() =>
      json(401, { statusCode: 401, code: ErrorCode.INVALID_CREDENTIALS, message: 'nope' }),
    );

    const error = await api<never>('/auth/login', { method: 'POST', body: {} }).catch(
      (e: unknown) => e as ApiRequestError,
    );
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    expect(calls(fetchMock, '/api/auth/refresh')).toBe(0);
  });

  it('returns undefined for 204 responses', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
