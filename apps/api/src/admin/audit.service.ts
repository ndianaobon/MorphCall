import { Inject, Injectable } from '@nestjs/common';
import type { AuditLogEntry } from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../common/cursor.js';
import { DB, type Db } from '../db/db.module.js';
import type { StaffContext } from './staff.guard.js';

/** Append-only record of every staff action (docs/05 §4: repudiation). */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async record(input: {
    staff: StaffContext;
    action: string;
    targetType: string;
    targetId: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.db.execute(sql`
      insert into app.admin_logs (admin_id, action, target_type, target_id, before, after, reason, ip_address, user_agent)
      values (${input.staff.userId}, ${input.action}, ${input.targetType}, ${input.targetId},
              ${input.before ? JSON.stringify(input.before) : null}::jsonb,
              ${input.after ? JSON.stringify(input.after) : null}::jsonb,
              ${input.reason ?? null}, ${input.ip ?? null}::inet, ${input.userAgent ?? null})
    `);
  }

  async list(page: { cursor?: string; limit: number }) {
    const cursor = decodeCursor(page.cursor, 1);
    const rows = await this.db.execute<{
      id: string;
      action: string;
      target_type: string;
      target_id: string;
      reason: string | null;
      created_at: string;
      admin_id: string;
      admin_email: string | null;
    }>(sql`
      select al.id::text as id, al.action, al.target_type, al.target_id, al.reason, al.created_at,
             al.admin_id, u.email::text as admin_email
      from app.admin_logs al
      left join app.users u on u.id = al.admin_id
      ${cursor ? sql`where al.id < ${cursor[0]}::bigint` : sql``}
      order by al.id desc
      limit ${page.limit + 1}
    `);
    const data = rows.slice(0, page.limit);
    const last = data.at(-1);
    return {
      data: data.map((r): AuditLogEntry => ({
        id: r.id,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        createdAt: new Date(r.created_at).toISOString(),
        admin: { id: r.admin_id, email: r.admin_email },
      })),
      nextCursor: rows.length > page.limit && last ? encodeCursor([last.id]) : null,
    };
  }
}
