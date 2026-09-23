'use client';

import type {
  BlockedUser,
  CallHistoryQuery,
  CallQualityInput,
  CallSummary,
  CallWithCredentials,
  CreateBlockInput,
  CreateReportInput,
  Paginated,
} from '@morphcall/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const callKeys = {
  detail: (id: string) => ['call', id] as const,
  history: (filter?: CallHistoryQuery['filter']) => ['calls', 'history', filter ?? 'all'] as const,
  blocks: ['blocks'] as const,
};

export function useStartCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (calleeId: string) =>
      api<CallWithCredentials>('/calls', { method: 'POST', body: { calleeId } }),
    onSuccess: (call) => {
      qc.setQueryData(callKeys.detail(call.id), call);
      void qc.invalidateQueries({ queryKey: ['calls', 'history'] });
    },
  });
}

export function useAcceptCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) =>
      api<CallWithCredentials>(`/calls/${callId}/accept`, { method: 'POST' }),
    onSuccess: (call) => qc.setQueryData(callKeys.detail(call.id), call),
  });
}

export function useCallAction(action: 'decline' | 'cancel' | 'end') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) =>
      api<CallSummary>(`/calls/${callId}/${action}`, { method: 'POST' }),
    onSuccess: (call) => {
      qc.setQueryData(callKeys.detail(call.id), call);
      void qc.invalidateQueries({ queryKey: ['calls', 'history'] });
    },
  });
}

export function useCall(callId: string, enabled = true) {
  return useQuery({
    queryKey: callKeys.detail(callId),
    queryFn: () => api<CallSummary>(`/calls/${callId}`),
    enabled,
    // Realtime drives this normally; polling while ringing covers a dropped socket.
    refetchInterval: (query) => (query.state.data?.status === 'ringing' ? 2000 : false),
  });
}

export function useCallHistory(filter: CallHistoryQuery['filter']) {
  return useInfiniteQuery({
    queryKey: callKeys.history(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Paginated<CallSummary>>(
        `/calls/history?filter=${filter}&limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const reportQuality = (callId: string, stats: CallQualityInput) =>
  api(`/calls/${callId}/quality`, { method: 'POST', body: stats }).catch(() => undefined);

export const refreshCallToken = (callId: string) =>
  api<CallWithCredentials['credentials']>(`/calls/${callId}/token`, { method: 'POST' });

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlockInput) => api('/blocks', { method: 'POST', body: input }),
    onSuccess: () => {
      // A block changes what this user can see everywhere.
      qc.clear();
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api(`/blocks/${userId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: callKeys.blocks }),
  });
}

export function useBlockedUsers() {
  return useQuery({ queryKey: callKeys.blocks, queryFn: () => api<BlockedUser[]>('/blocks') });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      api<{ id: string }>('/reports', { method: 'POST', body: input }),
  });
}
