import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { z } from "zod";

import { createAuth } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

const preferenceSchema = z.object({
  academicSessionId: z.string().uuid(),
});

const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  timezone: z.string().trim().min(1).max(64),
  locale: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
});

const memberRoleSchema = z.object({
  role: z.enum(["admin", "staff", "viewer"]),
});

const invitationSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  role: z.enum(["admin", "staff", "viewer"]),
});

const invitationTokenSchema = z.object({
  token: z.string().min(32).max(256),
});

const transferOwnershipSchema = z.object({
  targetMemberId: z.string().uuid(),
});

const signUpInputSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

const peopleQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  kind: z.enum(["all", "child", "elderly", "staff"]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const personIdSchema = z.uuid();

type SignUpPayload = {
  user?: {
    id?: string;
  };
};

type MembershipContext = {
  memberId: string;
  organizationId: string;
  role: "owner" | "admin" | "staff" | "viewer";
  userId: string;
};

type Invitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: "admin" | "staff" | "viewer";
  expiresAt: string;
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

    if (url.pathname === "/api/people") {
      return getPeopleRegistry(request);
    }

    const personMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
    if (personMatch) {
      return getPersonProfile(request, personMatch[1]);
    }

    if (url.pathname === "/api/invitations/preview") {
      return previewInvitation(request);
    }

    if (url.pathname === "/api/invitations/accept") {
      return acceptInvitationForCurrentUser(request);
    }

    if (url.pathname === "/api/organization") {
      return handleOrganizationRequest(request);
    }

    if (url.pathname === "/api/organization/invitations") {
      return createOrganizationInvitation(request);
    }

    if (url.pathname === "/api/organization/transfer") {
      return transferOrganizationOwnership(request);
    }

    const memberMatch = url.pathname.match(/^\/api\/organization\/members\/([^/]+)$/);
    if (memberMatch) {
      return updateOrganizationMember(request, memberMatch[1]);
    }

    const invitationMatch = url.pathname.match(/^\/api\/organization\/invitations\/([^/]+)$/);
    if (invitationMatch) {
      return revokeOrganizationInvitation(request, invitationMatch[1]);
    }

    return handler.fetch(request);
  },
});

async function handleAuthRequest(request: Request): Promise<Response> {
  const runtime = getRuntimeEnv();
  const url = new URL(request.url);
  const isEmailSignUp = url.pathname.endsWith("/sign-up/email");
  const signUpInput = isEmailSignUp ? await readSignUpInput(request.clone()) : null;
  const invitationToken = isEmailSignUp ? request.headers.get("x-tsewa-invitation") : null;
  const invitation = invitationToken
    ? await findInvitation(runtime.DB, invitationToken, signUpInput?.email)
    : null;
  const userCount = isEmailSignUp
    ? await runtime.DB.prepare('SELECT COUNT(*) AS count FROM "user"').first<{
        count: number;
      }>()
    : null;
  const isFirstUser = isEmailSignUp && Number(userCount?.count ?? 0) === 0;
  const auth = createRequestAuth(request, isFirstUser || Boolean(invitation));
  const accountAuditAction = getAccountAuditAction(url.pathname);
  const actorSession = accountAuditAction
    ? await auth.api.getSession({ headers: request.headers })
    : null;
  const response = await auth.handler(request);

  if (isEmailSignUp && response.ok) {
    const payload = (await response.clone().json()) as SignUpPayload;
    const userId = payload.user?.id;

    if (userId && isFirstUser) {
      await bootstrapFirstOrganization(runtime.DB, userId);
    } else if (userId && invitation) {
      await acceptInvitation(runtime.DB, invitation, userId);
    }
  }

  if (response.ok && accountAuditAction && actorSession?.user.id) {
    await auditAccountAction(runtime.DB, actorSession.user.id, accountAuditAction);
  }

  return response;
}

async function readSignUpInput(request: { json(): Promise<unknown> }) {
  try {
    const parsed = signUpInputSchema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function createRequestAuth(request: Request, allowSignUp: boolean) {
  const runtime = getRuntimeEnv();
  return createAuth({
    database: runtime.DB,
    secret: runtime.BETTER_AUTH_SECRET,
    baseURL: new URL(request.url).origin,
    allowSignUp,
  });
}

function getAccountAuditAction(pathname: string): string | null {
  if (pathname.endsWith("/update-user")) return "account.profile_updated";
  if (pathname.endsWith("/change-email")) return "account.email_changed";
  if (pathname.endsWith("/change-password")) return "account.password_changed";
  return null;
}

async function auditAccountAction(
  database: D1Database,
  userId: string,
  action: string,
): Promise<void> {
  const membership = await database
    .prepare(
      `SELECT organization_id AS organizationId
       FROM organization_member WHERE user_id = ? ORDER BY created_at LIMIT 1`,
    )
    .bind(userId)
    .first<{ organizationId: string }>();
  if (!membership) return;

  await database
    .prepare(
      `INSERT INTO audit_event
        (id, organization_id, actor_user_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, ?, 'user', ?)`,
    )
    .bind(crypto.randomUUID(), membership.organizationId, userId, action, userId)
    .run();
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

  return methodNotAllowed("GET, POST");
}

async function getPeopleRegistry(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();

  const url = new URL(request.url);
  const parsed = peopleQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") ?? "all",
    status: url.searchParams.get("status") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid People Registry filters" }, { status: 400 });
  }

  const { q, kind, status, page, pageSize } = parsed.data;
  const conditions = ["organization_id = ?"];
  const bindings: Array<string | number> = [context.organizationId];

  if (kind !== "all") {
    conditions.push("kind = ?");
    bindings.push(kind);
  }
  if (status !== "all") {
    conditions.push("status = ?");
    bindings.push(status);
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      `(lower(display_name) LIKE ? ESCAPE '\\' OR lower(primary_identifier) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;
  const runtime = getRuntimeEnv();
  const [count, people, summary, latestImport] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(*) AS total FROM person WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DB.prepare(
      `SELECT id, kind, status, identifier_kind AS identifierKind,
              primary_identifier AS primaryIdentifier, display_name AS displayName,
              gender, date_of_birth AS dateOfBirth,
              admitted_or_joined_on AS admittedOrJoinedOn,
              campus_or_location AS campusOrLocation,
              source_system AS sourceSystem, source_table AS sourceTable,
              source_id AS sourceId, imported_at AS importedAt
       FROM person WHERE ${where}
       ORDER BY display_name COLLATE NOCASE, primary_identifier
       LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, pageSize, offset)
      .all<{
        id: string;
        kind: "child" | "elderly" | "staff";
        status: "active" | "inactive";
        identifierKind: "admission" | "staff";
        primaryIdentifier: string;
        displayName: string;
        gender: "female" | "male" | "other" | "unknown" | null;
        dateOfBirth: string | null;
        admittedOrJoinedOn: string | null;
        campusOrLocation: string | null;
        sourceSystem: string;
        sourceTable: string;
        sourceId: string;
        importedAt: string | null;
      }>(),
    runtime.DB.prepare(
      `SELECT kind, status, COUNT(*) AS count
       FROM person WHERE organization_id = ? GROUP BY kind, status`,
    )
      .bind(context.organizationId)
      .all<{
        kind: "child" | "elderly" | "staff";
        status: "active" | "inactive";
        count: number;
      }>(),
    runtime.DB.prepare(
      `SELECT id, source_system AS sourceSystem, mode, status,
              source_count AS sourceCount, eligible_count AS eligibleCount,
              imported_count AS importedCount,
              skipped_count AS skippedCount, issue_count AS issueCount,
              created_at AS createdAt, finished_at AS finishedAt
       FROM person_import_batch WHERE organization_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(context.organizationId)
      .first<{
        id: string;
        sourceSystem: string;
        mode: "dry_run" | "import";
        status: "pending" | "running" | "completed" | "failed";
        sourceCount: number;
        eligibleCount: number;
        importedCount: number;
        skippedCount: number;
        issueCount: number;
        createdAt: string;
        finishedAt: string | null;
      }>(),
  ]);

  const total = Number(count?.total ?? 0);
  return Response.json({
    people: people.results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: summary.results,
    latestImport,
  });
}

async function getPersonProfile(request: Request, personId: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();

  const parsedId = personIdSchema.safeParse(personId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const person = await runtime.DB.prepare(
    `SELECT id, kind, status, identifier_kind AS identifierKind,
            primary_identifier AS primaryIdentifier, display_name AS displayName,
            gender, date_of_birth AS dateOfBirth,
            admitted_or_joined_on AS admittedOrJoinedOn,
            campus_or_location AS campusOrLocation, nationality,
            CASE WHEN photo_asset_key IS NULL THEN 0 ELSE 1 END AS photoReferencePresent,
            source_system AS sourceSystem, source_table AS sourceTable,
            source_id AS sourceId, imported_at AS importedAt,
            CASE WHEN date_of_birth IS NULL THEN 1 ELSE 0 END AS dateOfBirthMissing,
            CASE WHEN admitted_or_joined_on IS NULL THEN 1 ELSE 0 END AS eventDateMissing,
            CASE WHEN date(admitted_or_joined_on) < '1900-01-01' THEN 1 ELSE 0 END AS eventDateBefore1900,
            CASE WHEN date(admitted_or_joined_on) < date(date_of_birth) THEN 1 ELSE 0 END AS eventBeforeBirth
     FROM person
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{
      id: string;
      kind: "child" | "elderly" | "staff";
      status: "active" | "inactive";
      identifierKind: "admission" | "staff";
      primaryIdentifier: string;
      displayName: string;
      gender: "female" | "male" | "other" | "unknown" | null;
      dateOfBirth: string | null;
      admittedOrJoinedOn: string | null;
      campusOrLocation: string | null;
      nationality: string | null;
      photoReferencePresent: number;
      sourceSystem: string;
      sourceTable: string;
      sourceId: string;
      importedAt: string | null;
      dateOfBirthMissing: number;
      eventDateMissing: number;
      eventDateBefore1900: number;
      eventBeforeBirth: number;
    }>();

  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const reviewFlags = [
    person.dateOfBirthMissing ? "date_of_birth_missing" : null,
    person.eventDateMissing ? "event_date_missing" : null,
    person.eventDateBefore1900 ? "event_date_before_1900" : null,
    person.eventBeforeBirth ? "event_before_birth" : null,
  ].filter((flag): flag is string => Boolean(flag));

  return Response.json({
    person: {
      id: person.id,
      kind: person.kind,
      status: person.status,
      identifierKind: person.identifierKind,
      primaryIdentifier: person.primaryIdentifier,
      displayName: person.displayName,
      gender: person.gender,
      dateOfBirth: person.dateOfBirth,
      admittedOrJoinedOn: person.admittedOrJoinedOn,
      campusOrLocation: person.campusOrLocation,
      nationality: person.nationality,
      photoReferencePresent: Boolean(person.photoReferencePresent),
      sourceSystem: person.sourceSystem,
      sourceTable: person.sourceTable,
      sourceId: person.sourceId,
      importedAt: person.importedAt,
      reviewFlags,
    },
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
  if (!isSameOrigin(request)) return forbidden();

  const runtime = getRuntimeEnv();
  const session = await getSession(request);
  if (!session?.user.id) return unauthorized();

  const body = await readJson(request);
  const parsed = preferenceSchema.safeParse(body);
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

  if (!membership) return forbidden();

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

async function handleOrganizationRequest(request: Request): Promise<Response> {
  if (request.method === "GET") return getOrganization(request);
  if (request.method === "PATCH") return updateOrganization(request);
  return methodNotAllowed("GET, PATCH");
}

async function getOrganization(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();

  const runtime = getRuntimeEnv();
  const [organization, members, invitations] = await Promise.all([
    runtime.DB.prepare(
      `SELECT id, name, slug, timezone, locale
       FROM organization WHERE id = ?`,
    )
      .bind(context.organizationId)
      .first<{
        id: string;
        name: string;
        slug: string;
        timezone: string;
        locale: string;
      }>(),
    runtime.DB.prepare(
      `SELECT om.id, om.role, om.created_at AS joinedAt,
              u.id AS userId, u.name, u.email, u."emailVerified" AS emailVerified
       FROM organization_member om
       JOIN "user" u ON u.id = om.user_id
       WHERE om.organization_id = ?
       ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                lower(u.name)`,
    )
      .bind(context.organizationId)
      .all<{
        id: string;
        role: MembershipContext["role"];
        joinedAt: string;
        userId: string;
        name: string;
        email: string;
        emailVerified: number;
      }>(),
    runtime.DB.prepare(
      `SELECT id, email, role, expires_at AS expiresAt, created_at AS createdAt
       FROM organization_invitation
       WHERE organization_id = ? AND accepted_at IS NULL AND revoked_at IS NULL
         AND unixepoch(expires_at) > unixepoch()
       ORDER BY created_at DESC`,
    )
      .bind(context.organizationId)
      .all<{
        id: string;
        email: string;
        role: "admin" | "staff" | "viewer";
        expiresAt: string;
        createdAt: string;
      }>(),
  ]);

  if (!organization) return Response.json({ error: "Organization not found" }, { status: 404 });

  return Response.json({
    organization,
    currentMember: { id: context.memberId, role: context.role },
    members: members.results.map((member) => ({
      ...member,
      emailVerified: Boolean(member.emailVerified),
    })),
    invitations: invitations.results,
  });
}

async function updateOrganization(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (context.role !== "owner" && context.role !== "admin") return forbidden();

  const parsed = organizationSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success || !isValidTimezone(parsed.data?.timezone)) {
    return Response.json(
      { error: "Check the organization settings and try again." },
      { status: 400 },
    );
  }

  const runtime = getRuntimeEnv();
  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE organization SET name = ?, timezone = ?, locale = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(parsed.data.name, parsed.data.timezone, parsed.data.locale, context.organizationId),
    auditStatement(
      runtime.DB,
      context,
      "organization.updated",
      "organization",
      context.organizationId,
      {
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        locale: parsed.data.locale,
      },
    ),
  ]);

  return Response.json({ ok: true });
}

async function createOrganizationInvitation(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (context.role !== "owner" && context.role !== "admin") return forbidden();

  const parsed = invitationSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email address and role." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const existingUser = await runtime.DB.prepare(
    `SELECT id, name FROM "user" WHERE lower(email) = ?`,
  )
    .bind(parsed.data.email)
    .first<{ id: string; name: string }>();

  if (existingUser) {
    const existingMember = await runtime.DB.prepare(
      `SELECT id FROM organization_member WHERE organization_id = ? AND user_id = ?`,
    )
      .bind(context.organizationId, existingUser.id)
      .first<{ id: string }>();
    if (existingMember) {
      return Response.json({ error: "That person is already a member." }, { status: 409 });
    }

    const memberId = crypto.randomUUID();
    await runtime.DB.batch([
      runtime.DB.prepare(
        `INSERT INTO organization_member (id, organization_id, user_id, role)
         VALUES (?, ?, ?, ?)`,
      ).bind(memberId, context.organizationId, existingUser.id, parsed.data.role),
      auditStatement(runtime.DB, context, "member.added", "organization_member", memberId, {
        email: parsed.data.email,
        role: parsed.data.role,
      }),
    ]);
    return Response.json({ added: true, memberName: existingUser.name });
  }

  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE organization_invitation SET revoked_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND email = ?
         AND accepted_at IS NULL AND revoked_at IS NULL`,
    ).bind(context.organizationId, parsed.data.email),
    runtime.DB.prepare(
      `INSERT INTO organization_invitation
        (id, organization_id, email, role, token_hash, invited_by_user_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      invitationId,
      context.organizationId,
      parsed.data.email,
      parsed.data.role,
      tokenHash,
      context.userId,
      expiresAt,
    ),
    auditStatement(
      runtime.DB,
      context,
      "invitation.created",
      "organization_invitation",
      invitationId,
      {
        email: parsed.data.email,
        role: parsed.data.role,
      },
    ),
  ]);

  const invitationUrl = new URL(request.url);
  invitationUrl.pathname = "/";
  invitationUrl.search = new URLSearchParams({ invite: token }).toString();

  return Response.json({ invitationUrl: invitationUrl.toString(), expiresAt });
}

async function previewInvitation(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Invitation not found" }, { status: 404 });

  const invitation = await findInvitation(getRuntimeEnv().DB, token);
  if (!invitation)
    return Response.json({ error: "This invitation is invalid or expired." }, { status: 404 });

  return Response.json({
    organizationName: invitation.organizationName,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  });
}

async function acceptInvitationForCurrentUser(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const session = await getSession(request);
  if (!session?.user.id || !session.user.email) return unauthorized();

  const parsed = invitationTokenSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Invalid invitation" }, { status: 400 });

  const runtime = getRuntimeEnv();
  const invitation = await findInvitation(runtime.DB, parsed.data.token, session.user.email);
  if (!invitation) {
    return Response.json({ error: "This invitation is invalid or expired." }, { status: 404 });
  }

  await acceptInvitation(runtime.DB, invitation, session.user.id);
  return Response.json({ ok: true });
}

async function updateOrganizationMember(request: Request, memberId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (context.role !== "owner") return forbidden();
  if (context.memberId === memberId) {
    return Response.json(
      { error: "Use ownership transfer to change your own role." },
      { status: 400 },
    );
  }

  const parsed = memberRoleSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Invalid role" }, { status: 400 });

  const runtime = getRuntimeEnv();
  const target = await runtime.DB.prepare(
    `SELECT id, role FROM organization_member WHERE id = ? AND organization_id = ?`,
  )
    .bind(memberId, context.organizationId)
    .first<{ id: string; role: MembershipContext["role"] }>();
  if (!target) return Response.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "owner") {
    return Response.json(
      { error: "Transfer ownership before changing an owner role." },
      { status: 400 },
    );
  }

  await runtime.DB.batch([
    runtime.DB.prepare(`UPDATE organization_member SET role = ? WHERE id = ?`).bind(
      parsed.data.role,
      target.id,
    ),
    auditStatement(runtime.DB, context, "member.role_changed", "organization_member", target.id, {
      from: target.role,
      to: parsed.data.role,
    }),
  ]);

  return Response.json({ ok: true });
}

async function transferOrganizationOwnership(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (context.role !== "owner") return forbidden();

  const parsed = transferOwnershipSchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.targetMemberId === context.memberId) {
    return Response.json({ error: "Choose another organization member." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const target = await runtime.DB.prepare(
    `SELECT id, user_id AS userId, role
     FROM organization_member WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsed.data.targetMemberId, context.organizationId)
    .first<{ id: string; userId: string; role: MembershipContext["role"] }>();
  if (!target) return Response.json({ error: "Member not found" }, { status: 404 });

  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE organization_member SET role = 'owner'
       WHERE id = ? AND organization_id = ?`,
    ).bind(target.id, context.organizationId),
    runtime.DB.prepare(
      `UPDATE organization_member SET role = 'admin'
       WHERE id = ? AND organization_id = ? AND role = 'owner'`,
    ).bind(context.memberId, context.organizationId),
    auditStatement(runtime.DB, context, "ownership.transferred", "organization_member", target.id, {
      previousOwnerMemberId: context.memberId,
      newOwnerUserId: target.userId,
    }),
  ]);

  return Response.json({ ok: true });
}

async function revokeOrganizationInvitation(
  request: Request,
  invitationId: string,
): Promise<Response> {
  if (request.method !== "DELETE") return methodNotAllowed("DELETE");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (context.role !== "owner" && context.role !== "admin") return forbidden();

  const runtime = getRuntimeEnv();
  const invitation = await runtime.DB.prepare(
    `SELECT id FROM organization_invitation
     WHERE id = ? AND organization_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
  )
    .bind(invitationId, context.organizationId)
    .first<{ id: string }>();
  if (!invitation) return Response.json({ error: "Invitation not found" }, { status: 404 });

  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE organization_invitation SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(invitation.id),
    auditStatement(
      runtime.DB,
      context,
      "invitation.revoked",
      "organization_invitation",
      invitation.id,
    ),
  ]);

  return Response.json({ ok: true });
}

async function getSession(request: Request) {
  return createRequestAuth(request, false).api.getSession({ headers: request.headers });
}

async function getMembershipContext(request: Request): Promise<MembershipContext | null> {
  const session = await getSession(request);
  if (!session?.user.id) return null;

  const runtime = getRuntimeEnv();
  const membership = await runtime.DB.prepare(
    `SELECT om.id AS memberId, om.organization_id AS organizationId, om.role
     FROM organization_member om
     LEFT JOIN user_preference up ON up.user_id = om.user_id
     WHERE om.user_id = ?
     ORDER BY CASE WHEN up.active_organization_id = om.organization_id THEN 0 ELSE 1 END,
              om.created_at
     LIMIT 1`,
  )
    .bind(session.user.id)
    .first<Omit<MembershipContext, "userId">>();

  return membership ? { ...membership, userId: session.user.id } : null;
}

async function findInvitation(
  database: D1Database,
  token: string,
  expectedEmail?: string,
): Promise<Invitation | null> {
  if (token.length < 32 || token.length > 256) return null;
  const tokenHash = await hashInvitationToken(token);
  const invitation = await database
    .prepare(
      `SELECT i.id, i.organization_id AS organizationId, o.name AS organizationName,
              i.email, i.role, i.expires_at AS expiresAt
       FROM organization_invitation i
       JOIN organization o ON o.id = i.organization_id
       WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL
         AND unixepoch(i.expires_at) > unixepoch()`,
    )
    .bind(tokenHash)
    .first<Invitation>();

  if (!invitation) return null;
  if (expectedEmail && invitation.email !== expectedEmail.trim().toLowerCase()) return null;
  return invitation;
}

async function acceptInvitation(
  database: D1Database,
  invitation: Invitation,
  userId: string,
): Promise<void> {
  const memberId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO organization_member (id, organization_id, user_id, role)
         SELECT ?, organization_id, ?, role FROM organization_invitation
         WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL
           AND unixepoch(expires_at) > unixepoch()`,
      )
      .bind(memberId, userId, invitation.id),
    database
      .prepare(
        `UPDATE organization_invitation
         SET accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = ?
         WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
      )
      .bind(userId, invitation.id),
    database
      .prepare(
        `INSERT INTO audit_event
          (id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json)
         VALUES (?, ?, ?, 'invitation.accepted', 'organization_invitation', ?, ?)`,
      )
      .bind(
        auditId,
        invitation.organizationId,
        userId,
        invitation.id,
        JSON.stringify({ email: invitation.email, role: invitation.role }),
      ),
  ]);
}

function auditStatement(
  database: D1Database,
  context: MembershipContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, string>,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO audit_event
        (id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      context.organizationId,
      context.userId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
    );
}

function createInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidTimezone(timezone: string | undefined): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden(): Response {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

function methodNotAllowed(allow: string): Response {
  return new Response(null, { status: 405, headers: { Allow: allow } });
}
