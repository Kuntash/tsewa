import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { z } from "zod";

import { createAuth } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

const preferenceSchema = z.object({
  academicSessionId: z.string().uuid(),
});

type SignUpPayload = {
  user?: {
    id?: string;
  };
};

export default createServerEntry({
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      return handleAuthRequest(request);
    }

    if (url.pathname === "/api/platform") {
      return handlePlatformRequest(request);
    }

    return handler.fetch(request);
  },
});

async function handleAuthRequest(request: Request): Promise<Response> {
  const runtime = getRuntimeEnv();
  const url = new URL(request.url);
  const isEmailSignUp = url.pathname.endsWith("/sign-up/email");
  const userCount = isEmailSignUp
    ? await runtime.DB.prepare('SELECT COUNT(*) AS count FROM "user"').first<{
        count: number;
      }>()
    : null;
  const isFirstUser = isEmailSignUp && Number(userCount?.count ?? 0) === 0;
  const auth = createAuth({
    database: runtime.DB,
    secret: runtime.BETTER_AUTH_SECRET,
    baseURL: url.origin,
    allowSignUp: isFirstUser,
  });
  const response = await auth.handler(request);

  if (isFirstUser && response.ok) {
    const payload = (await response.clone().json()) as SignUpPayload;
    const userId = payload.user?.id;

    if (userId) {
      await bootstrapFirstOrganization(runtime.DB, userId);
    }
  }

  return response;
}

async function bootstrapFirstOrganization(database: D1Database, userId: string): Promise<void> {
  const organizationId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO organization (id, name, slug)
         VALUES (?, 'Tibetan Homes Foundation', 'tibetan-homes-foundation')`,
      )
      .bind(organizationId),
    database
      .prepare(
        `INSERT OR IGNORE INTO organization_member
          (id, organization_id, user_id, role)
         SELECT ?, id, ?, 'owner' FROM organization
         WHERE slug = 'tibetan-homes-foundation'`,
      )
      .bind(memberId, userId),
    database
      .prepare(
        `INSERT OR IGNORE INTO academic_session
          (id, organization_id, name, starts_on, ends_on, is_active)
         SELECT ?, id, '2026–27', '2026-04-01', '2027-03-31', 1
         FROM organization WHERE slug = 'tibetan-homes-foundation'`,
      )
      .bind(sessionId),
    database
      .prepare(
        `INSERT INTO audit_event
          (id, organization_id, actor_user_id, action, entity_type, entity_id)
         SELECT ?, id, ?, 'platform.bootstrap', 'organization', id
         FROM organization WHERE slug = 'tibetan-homes-foundation'`,
      )
      .bind(auditId, userId),
  ]);
}

async function handlePlatformRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return getPlatformStatus();
  }

  if (request.method === "POST") {
    return savePlatformPreference(request);
  }

  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, POST" },
  });
}

async function getPlatformStatus(): Promise<Response> {
  const runtime = getRuntimeEnv();
  const [userCount, sessions] = await Promise.all([
    runtime.DB.prepare('SELECT COUNT(*) AS count FROM "user"').first<{
      count: number;
    }>(),
    runtime.DB.prepare(
      `SELECT id, name, starts_on AS startsOn, ends_on AS endsOn
       FROM academic_session WHERE is_active = 1
       ORDER BY starts_on DESC`,
    ).all<{
      id: string;
      name: string;
      startsOn: string;
      endsOn: string;
    }>(),
  ]);

  return Response.json({
    needsSetup: Number(userCount?.count ?? 0) === 0,
    sessions: sessions.results,
  });
}

async function savePlatformPreference(request: Request): Promise<Response> {
  const runtime = getRuntimeEnv();
  const url = new URL(request.url);
  const auth = createAuth({
    database: runtime.DB,
    secret: runtime.BETTER_AUTH_SECRET,
    baseURL: url.origin,
    allowSignUp: false,
  });
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = preferenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid academic session" }, { status: 400 });
  }

  const membership = await runtime.DB.prepare(
    `SELECT om.organization_id AS organizationId
     FROM organization_member om
     JOIN academic_session s ON s.organization_id = om.organization_id
     WHERE om.user_id = ? AND s.id = ?`,
  )
    .bind(session.user.id, parsed.data.academicSessionId)
    .first<{ organizationId: string }>();

  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await runtime.DB.prepare(
    `INSERT INTO user_preference
      (user_id, active_organization_id, active_academic_session_id, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       active_organization_id = excluded.active_organization_id,
       active_academic_session_id = excluded.active_academic_session_id,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(session.user.id, membership.organizationId, parsed.data.academicSessionId)
    .run();

  return Response.json({ ok: true });
}
