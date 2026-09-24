/**
 * Grants (or updates) staff access for an existing account.
 *
 *   pnpm --filter @morphcall/api staff:grant you@example.com super_admin
 *
 * Roles: support | moderator | admin | super_admin. Pass --revoke to disable access.
 * Every grant is recorded in admin_logs with the actor "cli".
 */
import { STAFF_ROLES, type StaffRole } from '@morphcall/contracts';
import postgres from 'postgres';

const [email, role = 'moderator', ...flags] = process.argv.slice(2);
const revoke = flags.includes('--revoke');

if (!email) {
  console.error('Usage: staff:grant <email> [role] [--revoke]');
  process.exit(1);
}
if (!STAFF_ROLES.includes(role as StaffRole)) {
  console.error(`Unknown role "${role}". Use one of: ${STAFF_ROLES.join(', ')}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (run through pnpm so .env is loaded).');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 30 });

try {
  const [user] = await sql<{ id: string }[]>`
    select id from app.users where email = ${email}
  `;
  if (!user) {
    console.error(`No account found for ${email}. Sign up in the app first, then run this again.`);
    process.exit(1);
  }

  if (revoke) {
    await sql`update app.admin_users set disabled_at = now() where user_id = ${user.id}`;
    console.log(`Revoked staff access for ${email}.`);
  } else {
    await sql`
      insert into app.admin_users (user_id, role)
      values (${user.id}, ${role})
      on conflict (user_id) do update set role = ${role}, disabled_at = null
    `;
    console.log(`${email} is now ${role}. Sign in at the admin app.`);
  }

  await sql`
    insert into app.admin_logs (admin_id, action, target_type, target_id, reason)
    values (${user.id}, ${revoke ? 'staff.revoke' : 'staff.grant'}, 'user', ${user.id}, 'cli')
  `;
} finally {
  await sql.end();
}
