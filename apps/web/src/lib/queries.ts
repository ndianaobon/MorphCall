'use client';

import type {
  AccountBasicsInput,
  DiscoverQuery,
  FollowResult,
  Interest,
  Me,
  Paginated,
  ProfileCard,
  ProfileUpdateInput,
  PublicProfile,
  SettingsUpdateInput,
} from '@morphcall/contracts';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './api';

export const keys = {
  me: ['me'] as const,
  interests: ['interests'] as const,
  discover: (q: Partial<DiscoverQuery>) => ['discover', q] as const,
  search: (q: string) => ['search', q] as const,
  profile: (handle: string) => ['profile', handle] as const,
  followRequests: ['follow-requests'] as const,
  connections: (id: string, dir: string) => ['connections', id, dir] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/me'), staleTime: 30_000 });
}

export function useInterests() {
  return useQuery({
    queryKey: keys.interests,
    queryFn: () => api<Interest[]>('/interests'),
    staleTime: Infinity,
  });
}

function toQueryString(q: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== '' && v !== false) params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function useDiscover(q: {
  q?: string;
  interests?: string[];
  online?: boolean;
  limit?: number;
}) {
  return useInfiniteQuery({
    queryKey: keys.discover(q),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Paginated<ProfileCard>>(
        `/discover${toQueryString({
          q: q.q && q.q.length >= 2 ? q.q : undefined,
          interests: q.interests?.join(','),
          online: q.online,
          limit: q.limit ?? 12,
          cursor: pageParam,
        })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useProfile(handle: string) {
  return useQuery({
    queryKey: keys.profile(handle),
    queryFn: () => api<PublicProfile>(`/users/${encodeURIComponent(handle)}`),
  });
}

export function useConnections(userId: string | undefined, direction: 'followers' | 'following') {
  return useInfiniteQuery({
    queryKey: keys.connections(userId ?? '', direction),
    enabled: Boolean(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Paginated<ProfileCard>>(
        `/users/${userId}/${direction}${toQueryString({ cursor: pageParam, limit: 20 })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useFollowRequests() {
  return useQuery({
    queryKey: keys.followRequests,
    queryFn: () => api<Paginated<ProfileCard>>('/follow-requests?limit=50'),
  });
}

function useMeMutation<TInput>(fn: (input: TInput) => Promise<Me>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export const useSetBasics = () =>
  useMeMutation((input: AccountBasicsInput) =>
    api<Me>('/me/basics', { method: 'PUT', body: input }),
  );
export const useUpdateProfile = () =>
  useMeMutation((input: ProfileUpdateInput) =>
    api<Me>('/me/profile', { method: 'PUT', body: input }),
  );
export const useUpdateSettings = () =>
  useMeMutation((input: SettingsUpdateInput) =>
    api<Me>('/me/settings', { method: 'PATCH', body: input }),
  );
export const useCompleteOnboarding = () =>
  useMeMutation((_: void) => api<Me>('/me/onboarding/complete', { method: 'POST' }));
export const useSetAvatar = () =>
  useMeMutation((path: string) => api<Me>('/me/avatar', { method: 'PUT', body: { path } }));
export const useRemoveAvatar = () =>
  useMeMutation((_: void) => api<Me>('/me/avatar', { method: 'DELETE' }));

/** Follow / unfollow with an optimistic update of every cached card and profile for that user. */
export function useFollow() {
  const qc = useQueryClient();

  const patch = (userId: string, status: FollowResult['status']) => {
    const following = status === 'active';
    const followRequested = status === 'requested';
    qc.setQueriesData<InfiniteData<Paginated<ProfileCard>>>({ queryKey: ['discover'] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              data: p.data.map((c) => (c.id === userId ? { ...c, following, followRequested } : c)),
            })),
          }
        : data,
    );
    qc.setQueriesData<PublicProfile>({ queryKey: ['profile'] }, (p) =>
      p && p.id === userId && p.relationship
        ? {
            ...p,
            relationship: { ...p.relationship, following, followRequested },
          }
        : p,
    );
  };

  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) =>
      api<FollowResult>(`/users/${userId}/follow`, { method: follow ? 'POST' : 'DELETE' }),
    onMutate: ({ userId, follow }) => patch(userId, follow ? 'active' : 'none'),
    onSuccess: (res, { userId }) => {
      patch(userId, res.status);
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: keys.me });
    },
    onError: (_err, { userId, follow }) => patch(userId, follow ? 'none' : 'active'),
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ followerId, accept }: { followerId: string; accept: boolean }) =>
      api<FollowResult>(`/follow-requests/${followerId}/${accept ? 'accept' : 'decline'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.followRequests });
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export async function checkUsername(username: string) {
  return api<{ username: string; available: boolean; reason: string | null }>(
    `/usernames/${encodeURIComponent(username)}/availability`,
  );
}
