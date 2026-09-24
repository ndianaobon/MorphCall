import type { ApiError as ApiErrorBody, ErrorCode } from '@morphcall/contracts';
import { env } from './env';
import { supabaseBrowser } from './supabase/client';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Calls the MorphCall API with the current Supabase access token. */
export async function api<T>(
  path: string,
  init: { method?: Method; body?: unknown } = {},
): Promise<T> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'server_error',
      "Can't reach MorphCall right now. Check your connection.",
    );
  }

  if (res.ok) return (await res.json()) as T;

  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // non-JSON error
  }
  throw new ApiError(
    res.status,
    body?.error.code ?? 'server_error',
    body?.error.message ?? 'Something went wrong.',
    body?.error.requestId,
    body?.error.details,
  );
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}
