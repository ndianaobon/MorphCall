'use client';

import type {
  AdminMe,
  AdminOverview,
  AdminUserDetail,
  AuditLogEntry,
  ModerationActionInput,
  Paginated,
  ReportDetail,
  ReportListItem,
  ReportStatus,
  UpdateReportInput,
} from '@morphcall/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const adminKeys = {
  me: ['admin', 'me'] as const,
  overview: ['admin', 'overview'] as const,
  reports: (status: string, reason?: string) =>
    ['admin', 'reports', status, reason ?? 'any'] as const,
  report: (id: string) => ['admin', 'report', id] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  users: (q: string, status: string) => ['admin', 'users', q, status] as const,
  audit: ['admin', 'audit'] as const,
};

export const useAdminMe = () =>
  useQuery({ queryKey: adminKeys.me, queryFn: () => api<AdminMe>('/admin/me'), retry: false });

export const useOverview = () =>
  useQuery({
    queryKey: adminKeys.overview,
    queryFn: () => api<AdminOverview>('/admin/metrics/overview'),
    refetchInterval: 30_000,
  });

export const useReports = (status: ReportStatus | 'all', reason?: string) =>
  useQuery({
    queryKey: adminKeys.reports(status, reason),
    queryFn: () =>
      api<Paginated<ReportListItem>>(
        `/admin/reports?status=${status}&limit=50${reason ? `&reason=${reason}` : ''}`,
      ),
    refetchInterval: 20_000,
  });

export const useReport = (id: string) =>
  useQuery({
    queryKey: adminKeys.report(id),
    queryFn: () => api<ReportDetail>(`/admin/reports/${id}`),
  });

export const useAdminUser = (id: string) =>
  useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => api<AdminUserDetail>(`/admin/users/${id}`),
  });

export const useUserSearch = (q: string, status: string) =>
  useQuery({
    queryKey: adminKeys.users(q, status),
    queryFn: () =>
      api<Paginated<AdminUserDetail & { reportsAgainst: number }>>(
        `/admin/users?status=${status}&limit=30${q.length >= 2 ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

export const useAuditLog = () =>
  useQuery({
    queryKey: adminKeys.audit,
    queryFn: () => api<Paginated<AuditLogEntry>>('/admin/audit-log?limit=50'),
  });

export function useUpdateReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReportInput) =>
      api<ReportDetail>(`/admin/reports/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (report) => {
      qc.setQueryData(adminKeys.report(id), report);
      void qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
    },
  });
}

export function useModerateUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ModerationActionInput) =>
      api<AdminUserDetail>(`/admin/users/${userId}/actions`, { method: 'POST', body: input }),
    onSuccess: (user) => {
      qc.setQueryData(adminKeys.user(userId), user);
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
