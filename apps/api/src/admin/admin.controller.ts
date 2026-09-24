import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  type AdminMe,
  adminReportsQuery,
  type AdminReportsQuery,
  adminUsersQuery,
  moderationActionInput,
  type ModerationActionInput,
  paginationQuery,
  type PaginationQuery,
  updateReportInput,
  type UpdateReportInput,
} from '@morphcall/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { ApiException } from '../common/api-exception.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AuditService } from './audit.service.js';
import { ModerationService } from './moderation.service.js';
import { RequireStaff, type StaffContext } from './staff.guard.js';

const idParam = new ZodPipe(z.uuid());

/** Staff-only. Every route declares the minimum role it needs. */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  @RequireStaff('support')
  me(@Req() request: FastifyRequest, @CurrentUser() auth: AuthContext): AdminMe {
    const staff = request.staff as StaffContext;
    return { userId: staff.userId, email: auth.email, role: staff.role, mfa: staff.mfa };
  }

  @Get('metrics/overview')
  @RequireStaff('support')
  overview() {
    return this.moderation.overview();
  }

  @Get('reports')
  @RequireStaff('support')
  reports(@Query(new ZodPipe(adminReportsQuery)) query: AdminReportsQuery) {
    return this.moderation.listReports(query);
  }

  @Get('reports/:id')
  @RequireStaff('support')
  report(@Param('id', idParam) id: string) {
    return this.moderation.getReport(id);
  }

  @Patch('reports/:id')
  @RequireStaff('moderator')
  updateReport(
    @Req() request: FastifyRequest,
    @Param('id', idParam) id: string,
    @Body(new ZodPipe(updateReportInput)) input: UpdateReportInput,
  ) {
    return this.moderation.updateReport(request.staff as StaffContext, id, input);
  }

  @Get('users')
  @RequireStaff('support')
  users(@Query(new ZodPipe(adminUsersQuery)) query: z.output<typeof adminUsersQuery>) {
    return this.moderation.searchUsers(query);
  }

  @Get('users/:id')
  @RequireStaff('support')
  user(@Param('id', idParam) id: string) {
    return this.moderation.getUser(id);
  }

  /** Bans need an admin; warnings and suspensions are open to moderators. */
  @Post('users/:id/actions')
  @RequireStaff('moderator')
  act(
    @Req() request: FastifyRequest,
    @Param('id', idParam) id: string,
    @Body(new ZodPipe(moderationActionInput)) input: ModerationActionInput,
  ) {
    const staff = request.staff as StaffContext;
    if ((input.action === 'ban' || input.action === 'unban') && staff.role === 'moderator') {
      throw new ApiException(403, 'account_restricted', 'Bans and unbans need an admin.');
    }
    return this.moderation.actOnUser(staff, id, input);
  }

  @Get('audit-log')
  @RequireStaff('admin')
  auditLog(@Query(new ZodPipe(paginationQuery)) page: PaginationQuery) {
    return this.audit.list(page);
  }
}
