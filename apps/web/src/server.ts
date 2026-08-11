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

const schoolOverviewQuerySchema = z.object({
  sessionId: z.uuid(),
});

const schoolStudentFiltersSchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
  className: z.string().trim().max(100).default("all"),
  house: z.string().trim().max(100).default("all"),
  status: z
    .enum(["all", "recorded", "enrolled", "transferred", "withdrawn", "completed"])
    .default("all"),
});

const schoolStudentsQuerySchema = schoolStudentFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const schoolStudentReportQuerySchema = schoolStudentFiltersSchema;

const schoolRostersQuerySchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
});

const schoolMasterSchema = z.object({
  name: z.string().trim().min(2).max(160),
  locationName: z
    .string()
    .trim()
    .max(160)
    .nullable()
    .transform((value) => value || null),
  affiliationNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((value) => value || null),
  isActive: z.boolean(),
});

const academicClassMasterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  section: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .transform((value) => value || null),
  level: z.number().int().min(0).max(30).nullable(),
  sortOrder: z.number().int().min(0).max(1_000).nullable(),
  isActive: z.boolean(),
});

const houseMasterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
});

const schoolAssignmentsSchema = z.object({
  sessionId: z.uuid(),
  classIds: z.array(z.uuid()).max(500),
  houseIds: z.array(z.uuid()).max(500),
});

const isoDateSchema = z.iso.date();

const admissionSchema = z.object({
  sessionId: z.uuid(),
  admissionNumber: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(2).max(120),
  gender: z.enum(["female", "male", "other", "unknown"]).optional(),
  dateOfBirth: isoDateSchema.optional(),
  admittedOn: isoDateSchema,
  schoolId: z.uuid(),
  academicClassId: z.uuid(),
  houseId: z.uuid().optional(),
  rollNumber: z.string().trim().max(50).optional(),
});

const enrollmentIdSchema = z.uuid();

const enrollmentChangeSchema = z.object({
  action: z.enum([
    "placement_changed",
    "internal_transfer",
    "transferred_out",
    "withdrawn",
    "completed",
  ]),
  effectiveOn: isoDateSchema,
  schoolId: z.uuid().optional(),
  academicClassId: z.uuid().optional(),
  houseId: z.uuid().nullable().optional(),
  rollNumber: z.string().trim().max(50).nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

const historicalResultsOverviewQuerySchema = z.object({
  sessionId: z.uuid().optional(),
});

const historicalResultsQuerySchema = z.object({
  sessionId: z.uuid(),
  q: z.string().trim().max(100).default(""),
  school: z.string().trim().max(160).default("all"),
  className: z.string().trim().max(160).default("all"),
  subject: z.string().trim().max(160).default("all"),
  term: z.string().trim().max(160).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const personIdSchema = z.uuid();
const fileIdSchema = z.uuid();
const personFileCategorySchema = z.enum([
  "profile_photo",
  "parents_photo",
  "guardian_1_photo",
  "guardian_2_photo",
  "document",
]);
const personFileNameSchema = z.string().trim().min(1).max(160);

const nullablePersonText = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.null()]).transform((value) => (value ? value : null));

const nullablePersonDate = z
  .union([isoDateSchema, z.literal(""), z.null()])
  .transform((value) => (value ? value : null));

const personCoreDetailsSchema = z.object({
  primaryIdentifier: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(2).max(120),
  gender: z.enum(["female", "male", "other", "unknown"]),
  dateOfBirth: nullablePersonDate,
  admittedOrJoinedOn: nullablePersonDate,
  campusOrLocation: nullablePersonText(160),
  nationality: nullablePersonText(100),
});

const personFamilyDetailsSchema = z.object({
  parentageStatus: nullablePersonText(100),
  motherName: nullablePersonText(160),
  fatherName: nullablePersonText(160),
  motherOccupation: nullablePersonText(160),
  fatherOccupation: nullablePersonText(160),
  parentsPhone: nullablePersonText(60),
  parentsPermanentAddress: nullablePersonText(500),
  guardian1Name: nullablePersonText(160),
  guardian1Address: nullablePersonText(500),
  guardian1Email: nullablePersonText(254),
  guardian1Phone: nullablePersonText(60),
  guardian1Mobile: nullablePersonText(60),
  guardian2Name: nullablePersonText(160),
  guardian2Address: nullablePersonText(500),
  guardian2Email: nullablePersonText(254),
  guardian2Phone: nullablePersonText(60),
  guardian2Mobile: nullablePersonText(60),
  maritalStatus: nullablePersonText(100),
  spouseName: nullablePersonText(160),
  numberOfChildren: nullablePersonText(50),
});

const homePlacementSchema = z.object({
  homeName: z.string().trim().min(1).max(160),
  locationName: nullablePersonText(160),
  placementType: nullablePersonText(100),
  startedOn: isoDateSchema,
  reason: nullablePersonText(500),
  remarks: nullablePersonText(1_000),
});

const siblingOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
});

const siblingLinkSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), relatedPersonId: z.uuid() }),
  z.object({
    mode: z.literal("new"),
    displayName: z.string().trim().min(2).max(120),
    primaryIdentifier: z.string().trim().min(1).max(50),
    gender: z.enum(["female", "male", "other", "unknown"]),
  }),
]);

function classDisplayName(alias: "class" | "offering_class" | "from_class" | "to_class"): string {
  return `CASE
    WHEN lower(trim(coalesce(${alias}.section, ''))) NOT IN ('', 'none', '0', 'n/a', 'null')
      AND lower(replace(replace(trim(coalesce(nullif(${alias}.title, ''), ${alias}.name)), '''', ''), '"', ''))
        NOT LIKE '% ' || lower(trim(${alias}.section))
    THEN trim(coalesce(nullif(${alias}.title, ''), ${alias}.name)) || ' ' || trim(${alias}.section)
    ELSE trim(coalesce(nullif(${alias}.title, ''), ${alias}.name))
  END`;
}

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

    if (url.pathname === "/api/school-operations/overview") {
      return getSchoolOperationsOverview(request);
    }

    if (url.pathname === "/api/school-operations/students") {
      return getSchoolOperationsStudents(request);
    }

    if (url.pathname === "/api/school-operations/student-report") {
      return getSchoolOperationsStudentReport(request);
    }

    if (url.pathname === "/api/school-operations/master-data") {
      return getSchoolMasterData(request);
    }

    const academicClassMatch = url.pathname.match(/^\/api\/school-operations\/classes\/([^/]+)$/);
    if (academicClassMatch) {
      return updateAcademicClassMaster(request, academicClassMatch[1]);
    }

    if (url.pathname === "/api/school-operations/classes") {
      return createAcademicClassMaster(request);
    }

    const houseMasterMatch = url.pathname.match(/^\/api\/school-operations\/houses\/([^/]+)$/);
    if (houseMasterMatch) {
      return updateHouseMaster(request, houseMasterMatch[1]);
    }

    if (url.pathname === "/api/school-operations/houses") {
      return createHouseMaster(request);
    }

    const schoolAssignmentsMatch = url.pathname.match(
      /^\/api\/school-operations\/schools\/([^/]+)\/assignments$/,
    );
    if (schoolAssignmentsMatch) {
      return handleSchoolAssignments(request, schoolAssignmentsMatch[1]);
    }

    const schoolMasterMatch = url.pathname.match(/^\/api\/school-operations\/schools\/([^/]+)$/);
    if (schoolMasterMatch) {
      return updateSchoolMaster(request, schoolMasterMatch[1]);
    }

    if (url.pathname === "/api/school-operations/schools") {
      return request.method === "POST"
        ? createSchoolMaster(request)
        : getSchoolOperationsSchools(request);
    }

    if (url.pathname === "/api/school-operations/rosters") {
      return getSchoolOperationsRosters(request);
    }

    if (url.pathname === "/api/school-operations/setup") {
      return getSchoolOperationsSetup(request);
    }

    if (url.pathname === "/api/school-operations/admissions") {
      return createStudentAdmission(request);
    }

    const enrollmentMatch = url.pathname.match(/^\/api\/school-operations\/enrollments\/([^/]+)$/);
    if (enrollmentMatch) {
      return handleStudentEnrollment(request, enrollmentMatch[1]);
    }

    if (url.pathname === "/api/school-operations/results/overview") {
      return getHistoricalResultsOverview(request);
    }

    if (url.pathname === "/api/school-operations/results") {
      return getHistoricalResults(request);
    }

    const siblingItemMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/siblings\/([^/]+)$/);
    if (siblingItemMatch) {
      return removeSiblingRelationship(request, siblingItemMatch[1], siblingItemMatch[2]);
    }

    const siblingCollectionMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/siblings$/);
    if (siblingCollectionMatch) {
      return addSiblingRelationship(request, siblingCollectionMatch[1]);
    }

    const siblingOptionsMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/sibling-options$/);
    if (siblingOptionsMatch) {
      return getSiblingOptions(request, siblingOptionsMatch[1]);
    }

    const familyMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/family$/);
    if (familyMatch) {
      return updatePersonFamily(request, familyMatch[1]);
    }

    const placementMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/placements$/);
    if (placementMatch) {
      return addHomePlacement(request, placementMatch[1]);
    }

    const personFileItemMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/files\/([^/]+)$/);
    if (personFileItemMatch) {
      return handlePersonFile(request, personFileItemMatch[1], personFileItemMatch[2]);
    }

    const personFilesMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/files$/);
    if (personFilesMatch) {
      return addPersonFile(request, personFilesMatch[1]);
    }

    const personMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
    if (personMatch) {
      return handlePersonProfile(request, personMatch[1]);
    }

    const fileMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/);
    if (fileMatch) {
      return getPersonFile(request, fileMatch[1]);
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
    return getPlatformStatus(request);
  }

  if (request.method === "POST") {
    return savePlatformPreference(request);
  }

  return methodNotAllowed("GET, POST");
}

async function getSchoolOperationsOverview(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolOverviewQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const bindings = [scope.organizationId, scope.session.id];
  const [summary, schools, classes, houses] = await Promise.all([
    runtime.DB.prepare(
      `SELECT COUNT(*) AS students,
              SUM(CASE WHEN person.status = 'active' THEN 1 ELSE 0 END) AS activeStudents,
              SUM(CASE WHEN person.status = 'inactive' THEN 1 ELSE 0 END) AS inactiveStudents,
              COUNT(DISTINCT enrollment.school_id) AS schools,
              COUNT(DISTINCT coalesce(enrollment.school_id, 'unmapped') || '|' ||
                ${classDisplayName("class")}) AS classes,
              COUNT(DISTINCT enrollment.house_id) AS houses,
              SUM(CASE WHEN enrollment.school_id IS NULL THEN 1 ELSE 0 END) AS unmappedSchools
       FROM student_enrollment enrollment
       JOIN person ON person.id = enrollment.person_id
         AND person.organization_id = enrollment.organization_id
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?`,
    )
      .bind(...bindings)
      .first<{
        students: number;
        activeStudents: number;
        inactiveStudents: number;
        schools: number;
        classes: number;
        houses: number;
        unmappedSchools: number;
      }>(),
    runtime.DB.prepare(
      `SELECT coalesce(school.id, 'unmapped') AS id,
              coalesce(school.name, 'School not set') AS name, COUNT(*) AS count
       FROM student_enrollment enrollment
       LEFT JOIN school_master school ON school.id = enrollment.school_id
         AND school.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?
       GROUP BY school.id, school.name
       ORDER BY count DESC, name COLLATE NOCASE`,
    )
      .bind(...bindings)
      .all<{ id: string; name: string; count: number }>(),
    runtime.DB.prepare(
      `SELECT ${classDisplayName("class")} AS id,
              ${classDisplayName("class")} AS name,
              COUNT(*) AS count
       FROM student_enrollment enrollment
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?
       GROUP BY ${classDisplayName("class")}
       ORDER BY coalesce(max(class.level), 999), name COLLATE NOCASE`,
    )
      .bind(...bindings)
      .all<{ id: string; name: string; count: number }>(),
    runtime.DB.prepare(
      `SELECT coalesce(house.id, 'none') AS id,
              coalesce(house.name, 'No house') AS name, COUNT(*) AS count
       FROM student_enrollment enrollment
       LEFT JOIN house_master house ON house.id = enrollment.house_id
         AND house.organization_id = enrollment.organization_id
       WHERE enrollment.organization_id = ? AND enrollment.academic_session_id = ?
       GROUP BY house.id, house.name
       ORDER BY count DESC, name COLLATE NOCASE`,
    )
      .bind(...bindings)
      .all<{ id: string; name: string; count: number }>(),
  ]);

  return Response.json({
    session: scope.session,
    canEdit: canManageSchool(scope.role),
    summary: {
      students: Number(summary?.students ?? 0),
      activeStudents: Number(summary?.activeStudents ?? 0),
      inactiveStudents: Number(summary?.inactiveStudents ?? 0),
      schools: Number(summary?.schools ?? 0),
      classes: Number(summary?.classes ?? 0),
      houses: Number(summary?.houses ?? 0),
      unmappedSchools: Number(summary?.unmappedSchools ?? 0),
    },
    filters: {
      schools: schools.results,
      classes: classes.results,
      houses: houses.results,
    },
  });
}

async function getSchoolOperationsSetup(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = schoolOverviewQuerySchema.safeParse({ sessionId });
  if (!parsed.success) {
    return Response.json({ error: "Select an academic session." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const [schools, classes, houses] = await Promise.all([
    runtime.DB.prepare(
      `SELECT id, name FROM school_master
       WHERE organization_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string }>(),
    runtime.DB.prepare(
      `SELECT class.id, ${classDisplayName("class")} AS name, offering.school_id AS schoolId
       FROM school_class_offering offering
       JOIN academic_class_master class ON class.id = offering.academic_class_id
         AND class.organization_id = offering.organization_id
       WHERE offering.organization_id = ? AND offering.academic_session_id = ?
         AND offering.is_active = 1 AND class.is_active = 1
       ORDER BY offering.school_id, coalesce(class.sort_order, 999),
                coalesce(class.level, 999), name COLLATE NOCASE`,
    )
      .bind(scope.organizationId, scope.session.id)
      .all<{ id: string; name: string; schoolId: string }>(),
    runtime.DB.prepare(
      `SELECT house.id, house.name, school_house.school_id AS schoolId
       FROM school_house_master school_house
       JOIN house_master house ON house.id = school_house.house_id
         AND house.organization_id = school_house.organization_id
       WHERE school_house.organization_id = ? AND house.is_active = 1
       ORDER BY school_house.school_id, house.name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string; schoolId: string }>(),
  ]);

  return Response.json({
    canEdit: canManageSchool(scope.role),
    session: scope.session,
    schools: schools.results,
    classes: classes.results,
    houses: houses.results,
  });
}

async function createStudentAdmission(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();

  const parsed = admissionSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the student details and try again." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  if (!canManageSchool(scope.role)) return forbidden();

  const runtime = getRuntimeEnv();
  const { academicClassId, admissionNumber, admittedOn, displayName, houseId, schoolId } =
    parsed.data;
  const [school, offering, house, existingPerson] = await Promise.all([
    runtime.DB.prepare(
      `SELECT id FROM school_master WHERE id = ? AND organization_id = ? AND is_active = 1`,
    )
      .bind(schoolId, scope.organizationId)
      .first<{ id: string }>(),
    runtime.DB.prepare(
      `SELECT offering.id FROM school_class_offering offering
       JOIN academic_class_master class ON class.id = offering.academic_class_id
         AND class.organization_id = offering.organization_id
       WHERE offering.organization_id = ? AND offering.academic_session_id = ?
         AND offering.school_id = ? AND offering.academic_class_id = ?
         AND offering.is_active = 1 AND class.is_active = 1`,
    )
      .bind(scope.organizationId, scope.session.id, schoolId, academicClassId)
      .first<{ id: string }>(),
    houseId
      ? runtime.DB.prepare(
          `SELECT house.id FROM school_house_master school_house
           JOIN house_master house ON house.id = school_house.house_id
             AND house.organization_id = school_house.organization_id
           WHERE school_house.organization_id = ? AND school_house.school_id = ?
             AND house.id = ? AND house.is_active = 1`,
        )
          .bind(scope.organizationId, schoolId, houseId)
          .first<{ id: string }>()
      : Promise.resolve(null),
    runtime.DB.prepare(
      `SELECT id FROM person
       WHERE organization_id = ? AND identifier_kind = 'admission'
         AND lower(primary_identifier) = lower(?)`,
    )
      .bind(scope.organizationId, admissionNumber)
      .first<{ id: string }>(),
  ]);

  if (!school) return Response.json({ error: "Choose an active school." }, { status: 400 });
  if (!offering)
    return Response.json({ error: "Choose a class assigned to this school." }, { status: 400 });
  if (houseId && !house)
    return Response.json({ error: "Choose a house assigned to this school." }, { status: 400 });
  if (existingPerson) {
    return Response.json({ error: "That admission number is already in use." }, { status: 409 });
  }

  const personId = crypto.randomUUID();
  const enrollmentId = crypto.randomUUID();
  const changeId = crypto.randomUUID();
  await runtime.DB.batch([
    runtime.DB.prepare(
      `INSERT INTO person
        (id, organization_id, kind, status, identifier_kind, primary_identifier,
         display_name, gender, date_of_birth, admitted_or_joined_on, campus_or_location,
         source_system, source_table, source_id, created_by_user_id, updated_by_user_id)
       VALUES (?, ?, 'child', 'active', 'admission', ?, ?, ?, ?, ?,
         (SELECT name FROM school_master WHERE id = ?), 'tsewa', 'person', ?, ?, ?)`,
    ).bind(
      personId,
      scope.organizationId,
      admissionNumber,
      displayName,
      parsed.data.gender ?? "unknown",
      parsed.data.dateOfBirth ?? null,
      admittedOn,
      schoolId,
      personId,
      scope.userId,
      scope.userId,
    ),
    runtime.DB.prepare(
      `INSERT INTO student_enrollment
        (id, organization_id, person_id, academic_session_id, school_id,
         academic_class_id, house_id, school_class_offering_id, status, status_source,
         started_on, roll_number, source_system, source_table, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', 'explicit', ?, ?,
         'tsewa', 'student_enrollment', ?)`,
    ).bind(
      enrollmentId,
      scope.organizationId,
      personId,
      scope.session.id,
      schoolId,
      academicClassId,
      houseId ?? null,
      offering.id,
      admittedOn,
      parsed.data.rollNumber || null,
      enrollmentId,
    ),
    runtime.DB.prepare(
      `INSERT INTO student_enrollment_change
        (id, organization_id, enrollment_id, person_id, academic_session_id,
         change_type, effective_on, to_school_id, to_academic_class_id, to_house_id,
         to_status, to_roll_number, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'admitted', ?, ?, ?, ?, 'enrolled', ?, ?)`,
    ).bind(
      changeId,
      scope.organizationId,
      enrollmentId,
      personId,
      scope.session.id,
      admittedOn,
      schoolId,
      academicClassId,
      houseId ?? null,
      parsed.data.rollNumber || null,
      scope.userId,
    ),
    auditStatement(runtime.DB, scope, "student.admitted", "person", personId, {
      admissionNumber,
      academicSessionId: scope.session.id,
      schoolId,
      academicClassId,
    }),
  ]);

  return Response.json({ personId, enrollmentId, displayName }, { status: 201 });
}

async function handleStudentEnrollment(request: Request, enrollmentId: string): Promise<Response> {
  const parsedId = enrollmentIdSchema.safeParse(enrollmentId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid enrollment." }, { status: 400 });
  }
  if (request.method === "GET") return getStudentEnrollment(request, parsedId.data);
  if (request.method === "PATCH") return changeStudentEnrollment(request, parsedId.data);
  return methodNotAllowed("GET, PATCH");
}

async function getStudentEnrollment(request: Request, enrollmentId: string): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const runtime = getRuntimeEnv();
  const enrollment = await readStudentEnrollment(runtime.DB, context.organizationId, enrollmentId);
  if (!enrollment) return Response.json({ error: "Enrollment not found." }, { status: 404 });

  const [schools, classes, houses, changes] = await Promise.all([
    runtime.DB.prepare(
      `SELECT id, name FROM school_master
       WHERE organization_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE`,
    )
      .bind(context.organizationId)
      .all<{ id: string; name: string }>(),
    runtime.DB.prepare(
      `SELECT class.id, ${classDisplayName("class")} AS name, offering.school_id AS schoolId
       FROM school_class_offering offering
       JOIN academic_class_master class ON class.id = offering.academic_class_id
         AND class.organization_id = offering.organization_id
       WHERE offering.organization_id = ? AND offering.academic_session_id = ?
         AND offering.is_active = 1 AND class.is_active = 1
       ORDER BY offering.school_id, coalesce(class.sort_order, 999),
                coalesce(class.level, 999), name COLLATE NOCASE`,
    )
      .bind(context.organizationId, enrollment.academicSessionId)
      .all<{ id: string; name: string; schoolId: string }>(),
    runtime.DB.prepare(
      `SELECT house.id, house.name, school_house.school_id AS schoolId
       FROM school_house_master school_house
       JOIN house_master house ON house.id = school_house.house_id
         AND house.organization_id = school_house.organization_id
       WHERE school_house.organization_id = ? AND house.is_active = 1
       ORDER BY school_house.school_id, house.name COLLATE NOCASE`,
    )
      .bind(context.organizationId)
      .all<{ id: string; name: string; schoolId: string }>(),
    runtime.DB.prepare(
      `SELECT change.id, change.change_type AS changeType,
              change.effective_on AS effectiveOn, change.from_status AS fromStatus,
              change.to_status AS toStatus, change.note, change.created_at AS createdAt,
              from_school.name AS fromSchoolName, to_school.name AS toSchoolName,
              ${classDisplayName("from_class")} AS fromClassName,
              ${classDisplayName("to_class")} AS toClassName,
              from_house.name AS fromHouseName, to_house.name AS toHouseName,
              change.from_roll_number AS fromRollNumber,
              change.to_roll_number AS toRollNumber,
              actor.name AS changedBy
       FROM student_enrollment_change change
       LEFT JOIN school_master from_school ON from_school.id = change.from_school_id
       LEFT JOIN school_master to_school ON to_school.id = change.to_school_id
       LEFT JOIN academic_class_master from_class
         ON from_class.id = change.from_academic_class_id
       LEFT JOIN academic_class_master to_class ON to_class.id = change.to_academic_class_id
       LEFT JOIN house_master from_house ON from_house.id = change.from_house_id
       LEFT JOIN house_master to_house ON to_house.id = change.to_house_id
       LEFT JOIN "user" actor ON actor.id = change.created_by_user_id
       WHERE change.organization_id = ? AND change.enrollment_id = ?
       ORDER BY change.effective_on DESC, change.created_at DESC`,
    )
      .bind(context.organizationId, enrollmentId)
      .all(),
  ]);

  const classOptions = [...classes.results];
  if (!classOptions.some((item) => item.id === enrollment.academicClassId)) {
    classOptions.push({
      id: enrollment.academicClassId,
      name: enrollment.className,
      schoolId: enrollment.schoolId ?? "",
    });
  }
  const houseOptions = [...houses.results];
  if (
    enrollment.houseId &&
    enrollment.houseName &&
    !houseOptions.some((item) => item.id === enrollment.houseId)
  ) {
    houseOptions.push({
      id: enrollment.houseId,
      name: enrollment.houseName,
      schoolId: enrollment.schoolId ?? "",
    });
  }

  return Response.json({
    enrollment: {
      ...enrollment,
      canEdit: canManageSchool(context.role) && isOpenEnrollment(enrollment.status),
    },
    options: {
      schools: schools.results,
      classes: classOptions,
      houses: houseOptions,
    },
    changes: changes.results,
  });
}

async function changeStudentEnrollment(request: Request, enrollmentId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const parsed = enrollmentChangeSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the enrollment change and try again." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const enrollment = await readStudentEnrollment(runtime.DB, context.organizationId, enrollmentId);
  if (!enrollment) return Response.json({ error: "Enrollment not found." }, { status: 404 });
  if (!isOpenEnrollment(enrollment.status)) {
    return Response.json({ error: "This enrollment has already ended." }, { status: 409 });
  }
  if (
    parsed.data.effectiveOn < enrollment.sessionStartsOn ||
    parsed.data.effectiveOn > enrollment.sessionEndsOn
  ) {
    return Response.json(
      { error: `Choose a date within the ${enrollment.sessionName} session.` },
      { status: 400 },
    );
  }

  const action = parsed.data.action;
  const keepsStudentEnrolled = action === "placement_changed" || action === "internal_transfer";
  const targetSchoolId = keepsStudentEnrolled
    ? action === "placement_changed"
      ? enrollment.schoolId
      : parsed.data.schoolId
    : enrollment.schoolId;
  const targetClassId = keepsStudentEnrolled
    ? (parsed.data.academicClassId ?? enrollment.academicClassId)
    : enrollment.academicClassId;
  const targetHouseId = keepsStudentEnrolled
    ? parsed.data.houseId === undefined
      ? enrollment.houseId
      : parsed.data.houseId
    : enrollment.houseId;

  if (keepsStudentEnrolled && (!targetSchoolId || !targetClassId)) {
    return Response.json({ error: "Choose a school and class." }, { status: 400 });
  }
  if (action === "internal_transfer" && targetSchoolId === enrollment.schoolId) {
    return Response.json({ error: "Choose a different school for a transfer." }, { status: 400 });
  }

  let offeringId = enrollment.schoolClassOfferingId;
  if (keepsStudentEnrolled && targetSchoolId && targetClassId) {
    const [school, offering, house] = await Promise.all([
      runtime.DB.prepare(
        `SELECT id FROM school_master WHERE id = ? AND organization_id = ? AND is_active = 1`,
      )
        .bind(targetSchoolId, context.organizationId)
        .first<{ id: string }>(),
      runtime.DB.prepare(
        `SELECT offering.id FROM school_class_offering offering
         JOIN academic_class_master class ON class.id = offering.academic_class_id
           AND class.organization_id = offering.organization_id
         WHERE offering.organization_id = ? AND offering.academic_session_id = ?
           AND offering.school_id = ? AND offering.academic_class_id = ?
           AND offering.is_active = 1 AND class.is_active = 1`,
      )
        .bind(context.organizationId, enrollment.academicSessionId, targetSchoolId, targetClassId)
        .first<{ id: string }>(),
      targetHouseId
        ? runtime.DB.prepare(
            `SELECT house.id FROM school_house_master school_house
             JOIN house_master house ON house.id = school_house.house_id
               AND house.organization_id = school_house.organization_id
             WHERE school_house.organization_id = ? AND school_house.school_id = ?
               AND house.id = ? AND house.is_active = 1`,
          )
            .bind(context.organizationId, targetSchoolId, targetHouseId)
            .first<{ id: string }>()
        : Promise.resolve(null),
    ]);
    if (!school) return Response.json({ error: "Choose an active school." }, { status: 400 });
    if (!offering)
      return Response.json({ error: "Choose a class assigned to this school." }, { status: 400 });
    if (targetHouseId && !house)
      return Response.json({ error: "Choose a house assigned to this school." }, { status: 400 });
    offeringId = offering.id;
  }

  const nextStatus =
    action === "transferred_out"
      ? "transferred"
      : action === "withdrawn"
        ? "withdrawn"
        : action === "completed"
          ? "completed"
          : "enrolled";
  const changeType =
    action === "internal_transfer" || action === "transferred_out" ? "transferred" : action;
  const changeId = crypto.randomUUID();
  const statements = [
    runtime.DB.prepare(
      `UPDATE student_enrollment SET school_id = ?, academic_class_id = ?, house_id = ?,
         school_class_offering_id = ?, status = ?, status_source = 'explicit',
         ended_on = ?, roll_number = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? AND status IN ('recorded', 'enrolled')`,
    ).bind(
      targetSchoolId,
      targetClassId,
      targetHouseId,
      offeringId,
      nextStatus,
      keepsStudentEnrolled ? null : parsed.data.effectiveOn,
      keepsStudentEnrolled
        ? parsed.data.rollNumber === undefined
          ? enrollment.rollNumber
          : parsed.data.rollNumber
        : enrollment.rollNumber,
      enrollmentId,
      context.organizationId,
    ),
    runtime.DB.prepare(
      `INSERT INTO student_enrollment_change
        (id, organization_id, enrollment_id, person_id, academic_session_id, change_type,
         effective_on, from_school_id, to_school_id, from_academic_class_id,
         to_academic_class_id, from_house_id, to_house_id, from_status, to_status,
         from_roll_number, to_roll_number, note, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      changeId,
      context.organizationId,
      enrollmentId,
      enrollment.personId,
      enrollment.academicSessionId,
      changeType,
      parsed.data.effectiveOn,
      enrollment.schoolId,
      targetSchoolId,
      enrollment.academicClassId,
      targetClassId,
      enrollment.houseId,
      targetHouseId,
      enrollment.status,
      nextStatus,
      enrollment.rollNumber,
      keepsStudentEnrolled
        ? parsed.data.rollNumber === undefined
          ? enrollment.rollNumber
          : parsed.data.rollNumber
        : enrollment.rollNumber,
      parsed.data.note || null,
      context.userId,
    ),
  ];

  if (!keepsStudentEnrolled && enrollment.academicSessionId === enrollment.latestSessionId) {
    statements.push(
      runtime.DB.prepare(
        `UPDATE person SET status = 'inactive', updated_by_user_id = ?,
           updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      ).bind(context.userId, enrollment.personId, context.organizationId),
    );
  }
  statements.push(
    auditStatement(
      runtime.DB,
      context,
      `student.${changeType}`,
      "student_enrollment",
      enrollmentId,
      {
        personId: enrollment.personId,
        effectiveOn: parsed.data.effectiveOn,
        fromStatus: enrollment.status,
        toStatus: nextStatus,
      },
    ),
  );
  await runtime.DB.batch(statements);

  return Response.json({ ok: true, status: nextStatus, changeId });
}

function isOpenEnrollment(status: StudentEnrollmentRecord["status"]): boolean {
  return status === "recorded" || status === "enrolled";
}

type StudentEnrollmentRecord = {
  id: string;
  personId: string;
  displayName: string;
  admissionNumber: string;
  academicSessionId: string;
  sessionName: string;
  sessionStartsOn: string;
  sessionEndsOn: string;
  latestSessionId: string;
  schoolId: string | null;
  schoolName: string | null;
  academicClassId: string;
  className: string;
  houseId: string | null;
  houseName: string | null;
  schoolClassOfferingId: string | null;
  rollNumber: string | null;
  status: "recorded" | "enrolled" | "transferred" | "withdrawn" | "completed" | "graduated";
  statusSource: "legacy_allocation" | "explicit";
  startedOn: string | null;
  endedOn: string | null;
};

async function readStudentEnrollment(
  database: D1Database,
  organizationId: string,
  enrollmentId: string,
): Promise<StudentEnrollmentRecord | null> {
  return database
    .prepare(
      `SELECT enrollment.id, enrollment.person_id AS personId,
              person.display_name AS displayName,
              person.primary_identifier AS admissionNumber,
              enrollment.academic_session_id AS academicSessionId,
              session.name AS sessionName, session.starts_on AS sessionStartsOn,
              session.ends_on AS sessionEndsOn,
              (SELECT latest.id FROM academic_session latest
               WHERE latest.organization_id = enrollment.organization_id AND latest.is_active = 1
               ORDER BY latest.starts_on DESC LIMIT 1) AS latestSessionId,
              enrollment.school_id AS schoolId, school.name AS schoolName,
              enrollment.academic_class_id AS academicClassId,
              ${classDisplayName("class")} AS className,
              enrollment.house_id AS houseId, house.name AS houseName,
              enrollment.school_class_offering_id AS schoolClassOfferingId,
              enrollment.roll_number AS rollNumber, enrollment.status,
              enrollment.status_source AS statusSource, enrollment.started_on AS startedOn,
              enrollment.ended_on AS endedOn
       FROM student_enrollment enrollment
       JOIN person ON person.id = enrollment.person_id
         AND person.organization_id = enrollment.organization_id
       JOIN academic_session session ON session.id = enrollment.academic_session_id
         AND session.organization_id = enrollment.organization_id
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       LEFT JOIN school_master school ON school.id = enrollment.school_id
       LEFT JOIN house_master house ON house.id = enrollment.house_id
       WHERE enrollment.id = ? AND enrollment.organization_id = ?`,
    )
    .bind(enrollmentId, organizationId)
    .first<StudentEnrollmentRecord>();
}

type SchoolStudentFilters = z.infer<typeof schoolStudentFiltersSchema>;

type SchoolStudentRow = {
  personId: string;
  enrollmentId: string;
  displayName: string;
  primaryIdentifier: string;
  status: "active" | "inactive";
  gender: "female" | "male" | "other" | "unknown" | null;
  schoolName: string | null;
  className: string;
  classSection: string | null;
  classTitle: string | null;
  houseName: string | null;
  rollNumber: string | null;
  boardRegistrationNumber: string | null;
  result: string | null;
  enrollmentStatus: StudentEnrollmentRecord["status"];
  statusSource: StudentEnrollmentRecord["statusSource"];
};

function buildSchoolStudentFilters(
  scope: { organizationId: string; session: { id: string } },
  filters: SchoolStudentFilters,
) {
  const conditions = [
    "enrollment.organization_id = ?",
    "enrollment.academic_session_id = ?",
    "person.organization_id = ?",
  ];
  const bindings: Array<string | number> = [
    scope.organizationId,
    scope.session.id,
    scope.organizationId,
  ];
  if (filters.q) {
    const search = `%${escapeLikePattern(filters.q.toLowerCase())}%`;
    conditions.push(
      `(lower(person.display_name) LIKE ? ESCAPE '\\' OR lower(person.primary_identifier) LIKE ? ESCAPE '\\' OR lower(coalesce(enrollment.roll_number, '')) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search, search);
  }
  if (filters.school !== "all") {
    if (filters.school === "unmapped") {
      conditions.push("enrollment.school_id IS NULL");
    } else {
      conditions.push("school.id = ?");
      bindings.push(filters.school);
    }
  }
  if (filters.className !== "all") {
    conditions.push(`${classDisplayName("class")} = ?`);
    bindings.push(filters.className);
  }
  if (filters.house !== "all") {
    if (filters.house === "none") {
      conditions.push("enrollment.house_id IS NULL");
    } else {
      conditions.push("house.id = ?");
      bindings.push(filters.house);
    }
  }
  if (filters.status !== "all") {
    if (filters.status === "completed") {
      conditions.push("enrollment.status IN ('completed', 'graduated')");
    } else {
      conditions.push("enrollment.status = ?");
      bindings.push(filters.status);
    }
  }
  return { bindings, where: conditions.join(" AND ") };
}

const schoolStudentFromSql = `FROM student_enrollment enrollment
       JOIN person ON person.id = enrollment.person_id
         AND person.organization_id = enrollment.organization_id
       JOIN academic_class_master class ON class.id = enrollment.academic_class_id
         AND class.organization_id = enrollment.organization_id
       LEFT JOIN school_master school ON school.id = enrollment.school_id
         AND school.organization_id = enrollment.organization_id
       LEFT JOIN house_master house ON house.id = enrollment.house_id
         AND house.organization_id = enrollment.organization_id`;

const schoolStudentSelectSql = `SELECT person.id AS personId, enrollment.id AS enrollmentId,
              person.display_name AS displayName,
              person.primary_identifier AS primaryIdentifier, person.status, person.gender,
              school.name AS schoolName, class.name AS className,
              class.section AS classSection, ${classDisplayName("class")} AS classTitle,
              house.name AS houseName, enrollment.roll_number AS rollNumber,
              enrollment.board_registration_number AS boardRegistrationNumber,
              enrollment.result, enrollment.status AS enrollmentStatus,
              enrollment.status_source AS statusSource`;

async function getSchoolOperationsStudents(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolStudentsQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    house: url.searchParams.get("house") ?? "all",
    status: url.searchParams.get("status") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the filters and try again." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const { page, pageSize } = parsed.data;
  const { bindings: filterBindings, where } = buildSchoolStudentFilters(scope, parsed.data);
  const runtime = getRuntimeEnv();
  const offset = (page - 1) * pageSize;
  const [count, students] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(*) AS total ${schoolStudentFromSql} WHERE ${where}`)
      .bind(...filterBindings)
      .first<{ total: number }>(),
    runtime.DB.prepare(
      `${schoolStudentSelectSql} ${schoolStudentFromSql} WHERE ${where}
       ORDER BY person.display_name COLLATE NOCASE, person.primary_identifier
       LIMIT ? OFFSET ?`,
    )
      .bind(...filterBindings, pageSize, offset)
      .all<SchoolStudentRow>(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    students: students.results.map((student) => ({
      ...student,
      canEdit: canManageSchool(scope.role) && isOpenEnrollment(student.enrollmentStatus),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

const MAX_STUDENT_REPORT_ROWS = 5_000;

async function getSchoolOperationsStudentReport(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolStudentReportQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    house: url.searchParams.get("house") ?? "all",
    status: url.searchParams.get("status") ?? "all",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the report filters and try again." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const { bindings, where } = buildSchoolStudentFilters(scope, parsed.data);
  const runtime = getRuntimeEnv();
  const [count, organization] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(*) AS total ${schoolStudentFromSql} WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DB.prepare("SELECT name FROM organization WHERE id = ?")
      .bind(scope.organizationId)
      .first<{ name: string }>(),
  ]);
  const total = Number(count?.total ?? 0);
  if (total > MAX_STUDENT_REPORT_ROWS) {
    return Response.json(
      {
        error: `This list has ${total.toLocaleString()} students. Narrow the filters to ${MAX_STUDENT_REPORT_ROWS.toLocaleString()} or fewer before printing or downloading.`,
      },
      { status: 422 },
    );
  }

  const students = await runtime.DB.prepare(
    `${schoolStudentSelectSql} ${schoolStudentFromSql} WHERE ${where}
     ORDER BY school.name COLLATE NOCASE, coalesce(class.sort_order, 999),
              classTitle COLLATE NOCASE, person.display_name COLLATE NOCASE,
              person.primary_identifier
     LIMIT ?`,
  )
    .bind(...bindings, MAX_STUDENT_REPORT_ROWS)
    .all<SchoolStudentRow>();

  return Response.json({
    generatedAt: new Date().toISOString(),
    organizationName: organization?.name ?? "School",
    session: scope.session,
    students: students.results,
    total,
  });
}

async function getSchoolOperationsSchools(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolOverviewQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const schools = await runtime.DB.prepare(
    `WITH session_enrollments AS (
       SELECT * FROM student_enrollment
       WHERE organization_id = ? AND academic_session_id = ?
     ), session_offerings AS (
       SELECT * FROM school_class_offering
       WHERE organization_id = ? AND academic_session_id = ? AND is_active = 1
     )
     SELECT school.id, school.name, school.location_name AS locationName,
            school.affiliation_number AS affiliationNumber,
            school.is_active AS isActive,
            COUNT(DISTINCT enrollment.id) AS students,
            COUNT(DISTINCT CASE WHEN person.status = 'active' THEN enrollment.person_id END)
              AS currentActiveStudents,
            COUNT(DISTINCT ${classDisplayName("offering_class")}) AS classes,
            COUNT(DISTINCT school_house.house_id) AS houses
     FROM school_master school
     LEFT JOIN session_enrollments enrollment ON enrollment.school_id = school.id
     LEFT JOIN person ON person.id = enrollment.person_id
       AND person.organization_id = enrollment.organization_id
     LEFT JOIN session_offerings offering ON offering.school_id = school.id
     LEFT JOIN academic_class_master offering_class
       ON offering_class.id = offering.academic_class_id
      AND offering_class.organization_id = school.organization_id
     LEFT JOIN school_house_master school_house ON school_house.school_id = school.id
       AND school_house.organization_id = school.organization_id
     WHERE school.organization_id = ?
     GROUP BY school.id
     ORDER BY school.is_active DESC, school.name COLLATE NOCASE`,
  )
    .bind(
      scope.organizationId,
      scope.session.id,
      scope.organizationId,
      scope.session.id,
      scope.organizationId,
    )
    .all<{
      id: string;
      name: string;
      locationName: string | null;
      affiliationNumber: string | null;
      isActive: number;
      students: number;
      currentActiveStudents: number;
      classes: number;
      houses: number;
    }>();

  return Response.json({
    session: scope.session,
    schools: schools.results.map((school) => ({ ...school, isActive: Boolean(school.isActive) })),
  });
}

type AcademicClassRow = {
  id: string;
  name: string;
  title: string | null;
  section: string | null;
  level: number | null;
  sortOrder: number | null;
  isActive: number;
};

async function getSchoolMasterData(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = schoolOverviewQuerySchema.safeParse({ sessionId });
  if (!parsed.success) {
    return Response.json({ error: "Select an academic session." }, { status: 400 });
  }
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const [classRows, houses] = await Promise.all([
    runtime.DB.prepare(
      `SELECT id, name, title, section, level, sort_order AS sortOrder, is_active AS isActive
       FROM academic_class_master WHERE organization_id = ?
       ORDER BY coalesce(sort_order, 999), coalesce(level, 999), name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<AcademicClassRow>(),
    runtime.DB.prepare(
      `SELECT id, name, is_active AS isActive
       FROM house_master WHERE organization_id = ?
       ORDER BY is_active DESC, name COLLATE NOCASE`,
    )
      .bind(scope.organizationId)
      .all<{ id: string; name: string; isActive: number }>(),
  ]);

  return Response.json({
    canEdit: canManageSchool(scope.role),
    session: scope.session,
    classes: groupAcademicClasses(classRows.results),
    houses: houses.results.map((house) => ({ ...house, isActive: Boolean(house.isActive) })),
  });
}

async function createAcademicClassMaster(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();
  const parsed = academicClassMasterSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Check the class details." }, { status: 400 });

  const runtime = getRuntimeEnv();
  const rows = await readAcademicClassRows(runtime.DB, context.organizationId);
  const displayName = academicClassName(parsed.data.name, parsed.data.section);
  if (
    rows.some(
      (row) => canonicalMasterName(academicClassRowName(row)) === canonicalMasterName(displayName),
    )
  ) {
    return Response.json({ error: "This class and section already exists." }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await runtime.DB.batch([
    runtime.DB.prepare(
      `INSERT INTO academic_class_master (
         id, organization_id, name, level, section, title, sort_order, is_active,
         source_system, source_table, source_id
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'tsewa', 'academic_class_master', ?)`,
    ).bind(
      id,
      context.organizationId,
      parsed.data.name,
      parsed.data.level,
      parsed.data.section,
      parsed.data.sortOrder,
      parsed.data.isActive ? 1 : 0,
      id,
    ),
    auditStatement(runtime.DB, context, "class.created", "academic_class_master", id, {
      name: displayName,
    }),
  ]);
  return Response.json({ id, name: displayName }, { status: 201 });
}

async function updateAcademicClassMaster(request: Request, classId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();
  const parsedId = z.uuid().safeParse(classId);
  const parsed = academicClassMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the class details." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const rows = await readAcademicClassRows(runtime.DB, context.organizationId);
  const selected = rows.find((row) => row.id === parsedId.data);
  if (!selected) return Response.json({ error: "Class not found" }, { status: 404 });
  const oldKey = canonicalMasterName(academicClassRowName(selected));
  const group = rows.filter((row) => canonicalMasterName(academicClassRowName(row)) === oldKey);
  const newName = academicClassName(parsed.data.name, parsed.data.section);
  const newKey = canonicalMasterName(newName);
  if (
    rows.some(
      (row) => !group.includes(row) && canonicalMasterName(academicClassRowName(row)) === newKey,
    )
  ) {
    return Response.json({ error: "This class and section already exists." }, { status: 409 });
  }

  await runtime.DB.batch([
    ...group.map((row) =>
      runtime.DB.prepare(
        `UPDATE academic_class_master
         SET name = ?, title = NULL, section = ?, level = ?, sort_order = ?, is_active = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
      ).bind(
        parsed.data.name,
        parsed.data.section,
        parsed.data.level,
        parsed.data.sortOrder,
        parsed.data.isActive ? 1 : 0,
        row.id,
        context.organizationId,
      ),
    ),
    auditStatement(runtime.DB, context, "class.updated", "academic_class_master", selected.id, {
      previousName: academicClassRowName(selected),
      name: newName,
      matchingRecords: String(group.length),
      active: String(parsed.data.isActive),
    }),
  ]);
  return Response.json({ ok: true, id: selected.id, updatedRows: group.length });
}

async function createHouseMaster(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();
  const parsed = houseMasterSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Check the house details." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const duplicate = await runtime.DB.prepare(
    "SELECT id FROM house_master WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?))",
  )
    .bind(context.organizationId, parsed.data.name)
    .first<{ id: string }>();
  if (duplicate)
    return Response.json({ error: "A house with this name already exists." }, { status: 409 });
  const id = crypto.randomUUID();
  await runtime.DB.batch([
    runtime.DB.prepare(
      `INSERT INTO house_master
        (id, organization_id, name, is_active, source_system, source_table, source_id)
       VALUES (?, ?, ?, ?, 'tsewa', 'house_master', ?)`,
    ).bind(id, context.organizationId, parsed.data.name, parsed.data.isActive ? 1 : 0, id),
    auditStatement(runtime.DB, context, "house.created", "house_master", id, {
      name: parsed.data.name,
    }),
  ]);
  return Response.json({ id, name: parsed.data.name }, { status: 201 });
}

async function updateHouseMaster(request: Request, houseId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();
  const parsedId = z.uuid().safeParse(houseId);
  const parsed = houseMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success)
    return Response.json({ error: "Check the house details." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const [house, duplicate] = await Promise.all([
    runtime.DB.prepare("SELECT id, name FROM house_master WHERE id = ? AND organization_id = ?")
      .bind(parsedId.data, context.organizationId)
      .first<{ id: string; name: string }>(),
    runtime.DB.prepare(
      "SELECT id FROM house_master WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?)) AND id <> ?",
    )
      .bind(context.organizationId, parsed.data.name, parsedId.data)
      .first<{ id: string }>(),
  ]);
  if (!house) return Response.json({ error: "House not found" }, { status: 404 });
  if (duplicate)
    return Response.json({ error: "A house with this name already exists." }, { status: 409 });
  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE house_master SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(parsed.data.name, parsed.data.isActive ? 1 : 0, parsedId.data, context.organizationId),
    auditStatement(runtime.DB, context, "house.updated", "house_master", parsedId.data, {
      previousName: house.name,
      name: parsed.data.name,
      active: String(parsed.data.isActive),
    }),
  ]);
  return Response.json({ ok: true, id: parsedId.data });
}

async function readAcademicClassRows(database: D1Database, organizationId: string) {
  const result = await database
    .prepare(
      `SELECT id, name, title, section, level, sort_order AS sortOrder, is_active AS isActive
     FROM academic_class_master WHERE organization_id = ?`,
    )
    .bind(organizationId)
    .all<AcademicClassRow>();
  return result.results;
}

function groupAcademicClasses(rows: AcademicClassRow[]) {
  return groupAcademicClassRows(rows)
    .map((group) => {
      const representative = [...group].sort((left, right) => left.id.localeCompare(right.id))[0];
      return {
        id: representative.id,
        name: academicClassRowName(representative),
        baseName: representative.title?.trim() || representative.name.trim(),
        section: representative.section,
        level: representative.level,
        sortOrder: representative.sortOrder,
        isActive: group.some((row) => Boolean(row.isActive)),
        matchingRecords: group.length,
      };
    })
    .sort(
      (left, right) =>
        (left.sortOrder ?? 999) - (right.sortOrder ?? 999) || left.name.localeCompare(right.name),
    );
}

function groupAcademicClassRows(rows: AcademicClassRow[]) {
  const groups = new Map<string, AcademicClassRow[]>();
  for (const row of rows) {
    const key = canonicalMasterName(academicClassRowName(row));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

function academicClassRowName(row: Pick<AcademicClassRow, "name" | "title" | "section">) {
  return academicClassName(row.title?.trim() || row.name.trim(), row.section);
}

function academicClassName(name: string, section: string | null) {
  const cleanName = name.trim();
  const cleanSection = section?.trim();
  if (!cleanSection || ["none", "0", "n/a", "null"].includes(cleanSection.toLowerCase()))
    return cleanName;
  return cleanName.toLowerCase().endsWith(` ${cleanSection.toLowerCase()}`)
    ? cleanName
    : `${cleanName} ${cleanSection}`;
}

function canonicalMasterName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

async function createSchoolMaster(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const parsed = schoolMasterSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the school details." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const duplicate = await runtime.DB.prepare(
    "SELECT id FROM school_master WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?))",
  )
    .bind(context.organizationId, parsed.data.name)
    .first<{ id: string }>();
  if (duplicate) {
    return Response.json({ error: "A school with this name already exists." }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await runtime.DB.batch([
    runtime.DB.prepare(
      `INSERT INTO school_master (
         id, organization_id, name, location_name, affiliation_number, is_active,
         source_system, source_table, source_id
       ) VALUES (?, ?, ?, ?, ?, ?, 'tsewa', 'school_master', ?)`,
    ).bind(
      id,
      context.organizationId,
      parsed.data.name,
      parsed.data.locationName,
      parsed.data.affiliationNumber,
      parsed.data.isActive ? 1 : 0,
      id,
    ),
    auditStatement(runtime.DB, context, "school.created", "school_master", id, {
      name: parsed.data.name,
    }),
  ]);

  return Response.json({ id, name: parsed.data.name }, { status: 201 });
}

async function updateSchoolMaster(request: Request, schoolId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const parsedId = z.uuid().safeParse(schoolId);
  const parsed = schoolMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the school details." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const [school, duplicate] = await Promise.all([
    runtime.DB.prepare("SELECT id, name FROM school_master WHERE id = ? AND organization_id = ?")
      .bind(parsedId.data, context.organizationId)
      .first<{ id: string; name: string }>(),
    runtime.DB.prepare(
      `SELECT id FROM school_master
       WHERE organization_id = ? AND lower(trim(name)) = lower(trim(?)) AND id <> ?`,
    )
      .bind(context.organizationId, parsed.data.name, parsedId.data)
      .first<{ id: string }>(),
  ]);
  if (!school) return Response.json({ error: "School not found" }, { status: 404 });
  if (duplicate) {
    return Response.json({ error: "A school with this name already exists." }, { status: 409 });
  }

  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE school_master
       SET name = ?, location_name = ?, affiliation_number = ?, is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(
      parsed.data.name,
      parsed.data.locationName,
      parsed.data.affiliationNumber,
      parsed.data.isActive ? 1 : 0,
      parsedId.data,
      context.organizationId,
    ),
    auditStatement(runtime.DB, context, "school.updated", "school_master", parsedId.data, {
      previousName: school.name,
      name: parsed.data.name,
      active: String(parsed.data.isActive),
    }),
  ]);

  return Response.json({ ok: true, id: parsedId.data });
}

async function handleSchoolAssignments(request: Request, schoolId: string): Promise<Response> {
  const parsedSchoolId = z.uuid().safeParse(schoolId);
  if (!parsedSchoolId.success) {
    return Response.json({ error: "Invalid school." }, { status: 400 });
  }
  if (request.method === "GET") return getSchoolAssignments(request, parsedSchoolId.data);
  if (request.method === "PUT") return updateSchoolAssignments(request, parsedSchoolId.data);
  return methodNotAllowed("GET, PUT");
}

async function getSchoolAssignments(request: Request, schoolId: string): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const parsed = schoolOverviewQuerySchema.safeParse({ sessionId });
  if (!parsed.success) {
    return Response.json({ error: "Select an academic session." }, { status: 400 });
  }
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const runtime = getRuntimeEnv();
  const school = await runtime.DB.prepare(
    "SELECT id, name FROM school_master WHERE id = ? AND organization_id = ?",
  )
    .bind(schoolId, scope.organizationId)
    .first<{ id: string; name: string }>();
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const [classRows, offerings, enrollmentClasses, houses, schoolHouses, enrollmentHouses] =
    await Promise.all([
      readAcademicClassRows(runtime.DB, scope.organizationId),
      runtime.DB.prepare(
        `SELECT id, academic_class_id AS academicClassId, is_active AS isActive
         FROM school_class_offering
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ id: string; academicClassId: string; isActive: number }>(),
      runtime.DB.prepare(
        `SELECT academic_class_id AS academicClassId, COUNT(*) AS students
         FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
         GROUP BY academic_class_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ academicClassId: string; students: number }>(),
      runtime.DB.prepare(
        `SELECT id, name, is_active AS isActive FROM house_master
         WHERE organization_id = ? ORDER BY is_active DESC, name COLLATE NOCASE`,
      )
        .bind(scope.organizationId)
        .all<{ id: string; name: string; isActive: number }>(),
      runtime.DB.prepare(
        `SELECT house_id AS houseId FROM school_house_master
         WHERE organization_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, schoolId)
        .all<{ houseId: string }>(),
      runtime.DB.prepare(
        `SELECT house_id AS houseId, COUNT(*) AS students FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
           AND house_id IS NOT NULL GROUP BY house_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ houseId: string; students: number }>(),
    ]);

  const activeOfferingIds = new Set(
    offerings.results.filter((item) => Boolean(item.isActive)).map((item) => item.academicClassId),
  );
  const classStudentCounts = new Map(
    enrollmentClasses.results.map((item) => [item.academicClassId, Number(item.students)]),
  );
  const assignedHouseIds = new Set(schoolHouses.results.map((item) => item.houseId));
  const houseStudentCounts = new Map(
    enrollmentHouses.results.map((item) => [item.houseId, Number(item.students)]),
  );

  return Response.json({
    canEdit: canManageSchool(scope.role),
    school,
    session: scope.session,
    classes: groupAcademicClassRows(classRows)
      .map((group) => {
        const display = groupAcademicClasses(group)[0];
        return {
          ...display,
          assigned: group.some((row) => activeOfferingIds.has(row.id)),
          students: group.reduce((total, row) => total + (classStudentCounts.get(row.id) ?? 0), 0),
        };
      })
      .filter((item) => item.isActive || item.assigned)
      .sort(
        (left, right) =>
          (left.sortOrder ?? 999) - (right.sortOrder ?? 999) || left.name.localeCompare(right.name),
      ),
    houses: houses.results
      .map((house) => ({
        ...house,
        assigned: assignedHouseIds.has(house.id),
        isActive: Boolean(house.isActive),
        students: houseStudentCounts.get(house.id) ?? 0,
      }))
      .filter((house) => house.isActive || house.assigned),
  });
}

async function updateSchoolAssignments(request: Request, schoolId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();
  const parsed = schoolAssignmentsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the selected classes and houses." }, { status: 400 });
  }
  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  if (!canManageSchool(scope.role)) return forbidden();
  const runtime = getRuntimeEnv();
  const school = await runtime.DB.prepare(
    "SELECT id, name FROM school_master WHERE id = ? AND organization_id = ?",
  )
    .bind(schoolId, scope.organizationId)
    .first<{ id: string; name: string }>();
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const [classRows, offerings, enrollmentClasses, houses, schoolHouses, enrollmentHouses] =
    await Promise.all([
      readAcademicClassRows(runtime.DB, scope.organizationId),
      runtime.DB.prepare(
        `SELECT id, academic_class_id AS academicClassId, is_active AS isActive
         FROM school_class_offering
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ id: string; academicClassId: string; isActive: number }>(),
      runtime.DB.prepare(
        `SELECT academic_class_id AS academicClassId, COUNT(*) AS students
         FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
         GROUP BY academic_class_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ academicClassId: string; students: number }>(),
      runtime.DB.prepare(
        "SELECT id, name, is_active AS isActive FROM house_master WHERE organization_id = ?",
      )
        .bind(scope.organizationId)
        .all<{ id: string; name: string; isActive: number }>(),
      runtime.DB.prepare(
        `SELECT id, house_id AS houseId FROM school_house_master
         WHERE organization_id = ? AND school_id = ?`,
      )
        .bind(scope.organizationId, schoolId)
        .all<{ id: string; houseId: string }>(),
      runtime.DB.prepare(
        `SELECT house_id AS houseId, COUNT(*) AS students FROM student_enrollment
         WHERE organization_id = ? AND academic_session_id = ? AND school_id = ?
           AND house_id IS NOT NULL GROUP BY house_id`,
      )
        .bind(scope.organizationId, scope.session.id, schoolId)
        .all<{ houseId: string; students: number }>(),
    ]);

  const classGroups = groupAcademicClassRows(classRows);
  const displayedClasses = classGroups.map((group) => ({
    group,
    display: groupAcademicClasses(group)[0],
  }));
  const classesById = new Map(displayedClasses.map((item) => [item.display.id, item]));
  const housesById = new Map(houses.results.map((house) => [house.id, house]));
  const selectedClassIds = new Set(parsed.data.classIds);
  const selectedHouseIds = new Set(parsed.data.houseIds);
  if (
    [...selectedClassIds].some((id) => !classesById.get(id)?.display.isActive) ||
    [...selectedHouseIds].some((id) => !housesById.get(id)?.isActive)
  ) {
    return Response.json({ error: "Choose only active classes and houses." }, { status: 400 });
  }

  const offeringByClassId = new Map<string, (typeof offerings.results)[number]>();
  for (const offering of offerings.results)
    offeringByClassId.set(offering.academicClassId, offering);
  const classStudentCounts = new Map(
    enrollmentClasses.results.map((item) => [item.academicClassId, Number(item.students)]),
  );
  const schoolHouseByHouseId = new Map(schoolHouses.results.map((item) => [item.houseId, item]));
  const houseStudentCounts = new Map(
    enrollmentHouses.results.map((item) => [item.houseId, Number(item.students)]),
  );

  const blockedClasses = displayedClasses
    .filter(
      ({ display, group }) =>
        !selectedClassIds.has(display.id) &&
        group.some((row) => Boolean(offeringByClassId.get(row.id)?.isActive)) &&
        group.some((row) => (classStudentCounts.get(row.id) ?? 0) > 0),
    )
    .map(({ display }) => display.name);
  const blockedHouses = houses.results
    .filter(
      (house) =>
        !selectedHouseIds.has(house.id) &&
        schoolHouseByHouseId.has(house.id) &&
        (houseStudentCounts.get(house.id) ?? 0) > 0,
    )
    .map((house) => house.name);
  if (blockedClasses.length || blockedHouses.length) {
    const names = [...blockedClasses, ...blockedHouses].slice(0, 4).join(", ");
    return Response.json(
      { error: `${names} cannot be removed because students use them in this session.` },
      { status: 409 },
    );
  }

  const statements: D1PreparedStatement[] = [];
  for (const { display, group } of displayedClasses) {
    const shouldAssign = selectedClassIds.has(display.id);
    const current = group.map((row) => offeringByClassId.get(row.id)).filter(Boolean);
    if (shouldAssign) {
      const representative = offeringByClassId.get(display.id);
      if (representative) {
        if (!representative.isActive) {
          statements.push(
            runtime.DB.prepare(
              "UPDATE school_class_offering SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ).bind(representative.id),
          );
        }
      } else {
        const id = crypto.randomUUID();
        statements.push(
          runtime.DB.prepare(
            `INSERT INTO school_class_offering
              (id, organization_id, academic_session_id, school_id, academic_class_id, origin,
               source_system, source_table, source_id)
             VALUES (?, ?, ?, ?, ?, 'manual', 'tsewa', 'school_class_offering', ?)`,
          ).bind(id, scope.organizationId, scope.session.id, schoolId, display.id, id),
        );
      }
    } else {
      for (const offering of current) {
        if (offering?.isActive) {
          statements.push(
            runtime.DB.prepare(
              "UPDATE school_class_offering SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ).bind(offering.id),
          );
        }
      }
    }
  }
  for (const house of houses.results) {
    const current = schoolHouseByHouseId.get(house.id);
    if (selectedHouseIds.has(house.id) && !current) {
      const id = crypto.randomUUID();
      statements.push(
        runtime.DB.prepare(
          `INSERT INTO school_house_master
            (id, organization_id, school_id, house_id, source_system, source_table, source_id)
           VALUES (?, ?, ?, ?, 'tsewa', 'school_house_master', ?)`,
        ).bind(id, scope.organizationId, schoolId, house.id, id),
      );
    } else if (!selectedHouseIds.has(house.id) && current) {
      statements.push(
        runtime.DB.prepare(
          "DELETE FROM school_house_master WHERE id = ? AND organization_id = ?",
        ).bind(current.id, scope.organizationId),
      );
    }
  }
  statements.push(
    auditStatement(runtime.DB, scope, "school.assignments_updated", "school_master", schoolId, {
      academicSessionId: scope.session.id,
      classes: String(selectedClassIds.size),
      houses: String(selectedHouseIds.size),
    }),
  );
  await runtime.DB.batch(statements);
  return Response.json({
    ok: true,
    schoolName: school.name,
    classes: selectedClassIds.size,
    houses: selectedHouseIds.size,
  });
}

async function getSchoolOperationsRosters(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const parsed = schoolRostersQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the class filters." }, { status: 400 });
  }

  const scope = await getSchoolSessionScope(request, parsed.data.sessionId);
  if (!scope) return forbidden();
  const conditions = [
    "offering.organization_id = ?",
    "offering.academic_session_id = ?",
    "offering.is_active = 1",
  ];
  const bindings: Array<string | number> = [scope.organizationId, scope.session.id];
  if (parsed.data.school !== "all") {
    conditions.push("school.id = ?");
    bindings.push(parsed.data.school);
  }
  if (parsed.data.q) {
    const search = `%${escapeLikePattern(parsed.data.q.toLowerCase())}%`;
    conditions.push(
      `(lower(school.name) LIKE ? ESCAPE '\\' OR lower(${classDisplayName("class")}) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search);
  }

  const runtime = getRuntimeEnv();
  const rosters = await runtime.DB.prepare(
    `SELECT min(offering.id) AS id, school.id AS schoolId, school.name AS schoolName,
            ${classDisplayName("class")} AS classId,
            ${classDisplayName("class")} AS className,
            max(class.level) AS classLevel, max(class.section) AS classSection,
            COUNT(DISTINCT enrollment.id) AS students,
            COUNT(DISTINCT CASE WHEN person.status = 'active' THEN enrollment.person_id END)
              AS currentActiveStudents,
            COUNT(DISTINCT CASE WHEN person.gender = 'female' THEN enrollment.person_id END)
              AS femaleStudents,
            COUNT(DISTINCT CASE WHEN person.gender = 'male' THEN enrollment.person_id END)
              AS maleStudents,
            COUNT(DISTINCT enrollment.house_id) AS houses
     FROM school_class_offering offering
     JOIN school_master school ON school.id = offering.school_id
       AND school.organization_id = offering.organization_id
     JOIN academic_class_master class ON class.id = offering.academic_class_id
       AND class.organization_id = offering.organization_id
     LEFT JOIN student_enrollment enrollment
       ON enrollment.school_class_offering_id = offering.id
      AND enrollment.organization_id = offering.organization_id
     LEFT JOIN person ON person.id = enrollment.person_id
       AND person.organization_id = enrollment.organization_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY school.id, school.name, ${classDisplayName("class")}
     ORDER BY school.name COLLATE NOCASE, coalesce(min(class.sort_order), 999),
              coalesce(max(class.level), 999), className COLLATE NOCASE`,
  )
    .bind(...bindings)
    .all<{
      id: string;
      schoolId: string;
      schoolName: string;
      classId: string;
      className: string;
      classLevel: number | null;
      classSection: string | null;
      students: number;
      currentActiveStudents: number;
      femaleStudents: number;
      maleStudents: number;
      houses: number;
    }>();

  return Response.json({ session: scope.session, rosters: rosters.results });
}

async function getHistoricalResultsOverview(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const url = new URL(request.url);
  const parsed = historicalResultsOverviewQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId") || undefined,
  });
  if (!parsed.success)
    return Response.json({ error: "Select a valid result year." }, { status: 400 });
  const runtime = getRuntimeEnv();
  const sessions = await runtime.DB.prepare(
    `SELECT session.id, session.name, COUNT(DISTINCT sheet.id) AS markSheets,
            COUNT(mark.id) AS results
     FROM academic_session session
     JOIN mark_sheet sheet ON sheet.academic_session_id = session.id
       AND sheet.organization_id = session.organization_id
     LEFT JOIN student_mark mark ON mark.mark_sheet_id = sheet.id
       AND mark.organization_id = sheet.organization_id
     WHERE session.organization_id = ?
     GROUP BY session.id, session.name, session.starts_on
     ORDER BY session.starts_on DESC`,
  )
    .bind(context.organizationId)
    .all<{ id: string; name: string; markSheets: number; results: number }>();
  const selectedId = parsed.data.sessionId ?? sessions.results[0]?.id;
  if (!selectedId)
    return Response.json({
      sessions: [],
      selectedSessionId: null,
      summary: { markSheets: 0, results: 0, students: 0 },
      filters: { schools: [], classes: [], subjects: [], terms: [] },
    });
  if (!sessions.results.some((session) => session.id === selectedId)) return forbidden();

  const [summary, schools, classes, subjects, terms] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(DISTINCT sheet.id) AS markSheets, COUNT(mark.id) AS results,
      COUNT(DISTINCT mark.person_id) AS students FROM mark_sheet sheet
      LEFT JOIN student_mark mark ON mark.mark_sheet_id=sheet.id AND mark.organization_id=sheet.organization_id
      WHERE sheet.organization_id=? AND sheet.academic_session_id=?`)
      .bind(context.organizationId, selectedId)
      .first<{ markSheets: number; results: number; students: number }>(),
    resultFilter(
      runtime.DB,
      context.organizationId,
      selectedId,
      "school.id",
      "school.name",
      "school_master school",
      "school.id=sheet.school_id",
    ),
    resultFilter(
      runtime.DB,
      context.organizationId,
      selectedId,
      "class.id",
      classDisplayName("class"),
      "academic_class_master class",
      "class.id=sheet.academic_class_id",
    ),
    resultFilter(
      runtime.DB,
      context.organizationId,
      selectedId,
      "subject.id",
      "subject.name",
      "academic_subject subject",
      "subject.id=sheet.subject_id",
    ),
    resultFilter(
      runtime.DB,
      context.organizationId,
      selectedId,
      "term.id",
      "term.name",
      "academic_term term",
      "term.id=sheet.term_id",
    ),
  ]);
  return Response.json({
    sessions: sessions.results,
    selectedSessionId: selectedId,
    summary: {
      markSheets: Number(summary?.markSheets ?? 0),
      results: Number(summary?.results ?? 0),
      students: Number(summary?.students ?? 0),
    },
    filters: {
      schools: schools.results,
      classes: classes.results,
      subjects: subjects.results,
      terms: terms.results,
    },
  });
}

function resultFilter(
  database: D1Database,
  organizationId: string,
  sessionId: string,
  idSql: string,
  nameSql: string,
  joinTable: string,
  joinOn: string,
) {
  return database
    .prepare(`SELECT ${idSql} AS id, ${nameSql} AS name, COUNT(mark.id) AS count
    FROM mark_sheet sheet JOIN ${joinTable} ON ${joinOn}
    LEFT JOIN student_mark mark ON mark.mark_sheet_id=sheet.id AND mark.organization_id=sheet.organization_id
    WHERE sheet.organization_id=? AND sheet.academic_session_id=?
    GROUP BY ${idSql}, ${nameSql} ORDER BY ${nameSql} COLLATE NOCASE`)
    .bind(organizationId, sessionId)
    .all<{ id: string; name: string; count: number }>();
}

async function getHistoricalResults(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const url = new URL(request.url);
  const parsed = historicalResultsQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    q: url.searchParams.get("q") ?? "",
    school: url.searchParams.get("school") ?? "all",
    className: url.searchParams.get("class") ?? "all",
    subject: url.searchParams.get("subject") ?? "all",
    term: url.searchParams.get("term") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success)
    return Response.json({ error: "Check the result filters." }, { status: 400 });
  const { sessionId, q, school, className, subject, term, page, pageSize } = parsed.data;
  const conditions = ["sheet.organization_id=?", "sheet.academic_session_id=?"];
  const bindings: Array<string | number> = [context.organizationId, sessionId];
  for (const [value, sql] of [
    [school, "sheet.school_id"],
    [className, "sheet.academic_class_id"],
    [subject, "sheet.subject_id"],
    [term, "sheet.term_id"],
  ] as const) {
    if (value !== "all") {
      conditions.push(`${sql}=?`);
      bindings.push(value);
    }
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      "(lower(person.display_name) LIKE ? ESCAPE '\\' OR lower(person.primary_identifier) LIKE ? ESCAPE '\\')",
    );
    bindings.push(search, search);
  }
  const where = conditions.join(" AND ");
  const runtime = getRuntimeEnv();
  const [count, rows] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(*) AS total FROM student_mark mark
      JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
      JOIN person ON person.id=mark.person_id AND person.organization_id=mark.organization_id
      WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    runtime.DB.prepare(`SELECT mark.id, person.id AS personId, person.display_name AS studentName,
      person.primary_identifier AS admissionNumber, school.name AS schoolName,
      ${classDisplayName("class")} AS className, subject.name AS subjectName, term.name AS termName,
      assessment.name AS assessmentName, mark.marks, mark.maximum_marks AS maximumMarks,
      mark.note, sheet.recorded_on AS recordedOn, sheet.is_verified AS isVerified
      FROM student_mark mark JOIN mark_sheet sheet ON sheet.id=mark.mark_sheet_id
      JOIN person ON person.id=mark.person_id AND person.organization_id=mark.organization_id
      JOIN school_master school ON school.id=sheet.school_id
      JOIN academic_class_master class ON class.id=sheet.academic_class_id
      JOIN academic_subject subject ON subject.id=sheet.subject_id
      JOIN academic_term term ON term.id=sheet.term_id
      JOIN academic_assessment assessment ON assessment.id=mark.assessment_id
      WHERE ${where}
      ORDER BY person.display_name COLLATE NOCASE, subject.name COLLATE NOCASE, assessment.name COLLATE NOCASE
      LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all(),
  ]);
  const total = Number(count?.total ?? 0);
  return Response.json({
    results: rows.results.map((row) => ({ ...row, isVerified: Boolean(row.isVerified) })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function getSchoolSessionScope(request: Request, sessionId: string) {
  const context = await getMembershipContext(request);
  if (!context) return null;
  const runtime = getRuntimeEnv();
  const session = await runtime.DB.prepare(
    `SELECT id, name, starts_on AS startsOn, ends_on AS endsOn
     FROM academic_session WHERE id = ? AND organization_id = ? AND is_active = 1`,
  )
    .bind(sessionId, context.organizationId)
    .first<{ id: string; name: string; startsOn: string; endsOn: string }>();
  return session ? { ...context, session } : null;
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
    return Response.json({ error: "Check the people filters." }, { status: 400 });
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

async function handlePersonProfile(request: Request, personId: string): Promise<Response> {
  if (request.method === "GET") return getPersonProfile(request, personId);
  if (request.method === "PATCH") return updatePersonCoreDetails(request, personId);
  return methodNotAllowed("GET, PATCH");
}

async function getPersonProfile(request: Request, personId: string): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();

  const parsedId = personIdSchema.safeParse(personId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const [person, placements, academicRecords, familyProfile, relationships, files] =
    await Promise.all([
      runtime.DB.prepare(
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
        }>(),
      runtime.DB.prepare(
        `SELECT id, home_name AS homeName, location_name AS locationName,
              placement_type AS placementType, started_on AS startedOn,
              ended_on AS endedOn, reason, remarks, is_current AS isCurrent,
              source_id AS sourceId
       FROM person_placement
       WHERE person_id = ? AND organization_id = ?
       ORDER BY is_current DESC, date(started_on) DESC, CAST(source_id AS INTEGER) DESC`,
      )
        .bind(parsedId.data, context.organizationId)
        .all<{
          id: string;
          homeName: string;
          locationName: string | null;
          placementType: string | null;
          startedOn: string;
          endedOn: string | null;
          reason: string | null;
          remarks: string | null;
          isCurrent: number;
          sourceId: string;
        }>(),
      runtime.DB.prepare(
        `SELECT id, class_name AS className, class_level AS classLevel,
              class_section AS classSection, class_title AS classTitle,
              school_name AS schoolName, house_name AS houseName,
              academic_session AS academicSession, recorded_on AS recordedOn,
              result, roll_number AS rollNumber,
              board_registration_number AS boardRegistrationNumber,
              description, is_latest AS isLatest, source_id AS sourceId
       FROM person_academic_record
       WHERE person_id = ? AND organization_id = ?
       ORDER BY is_latest DESC, date(recorded_on) DESC, CAST(source_id AS INTEGER) DESC`,
      )
        .bind(parsedId.data, context.organizationId)
        .all<{
          id: string;
          className: string;
          classLevel: number | null;
          classSection: string | null;
          classTitle: string | null;
          schoolName: string | null;
          houseName: string | null;
          academicSession: string;
          recordedOn: string;
          result: string | null;
          rollNumber: string | null;
          boardRegistrationNumber: string | null;
          description: string | null;
          isLatest: number;
          sourceId: string;
        }>(),
      runtime.DB.prepare(
        `SELECT parentage_status AS parentageStatus,
              mother_name AS motherName, father_name AS fatherName,
              mother_occupation AS motherOccupation,
              father_occupation AS fatherOccupation,
              parents_phone AS parentsPhone,
              parents_permanent_address AS parentsPermanentAddress,
              guardian_1_name AS guardian1Name,
              guardian_1_address AS guardian1Address,
              guardian_1_email AS guardian1Email,
              guardian_1_phone AS guardian1Phone,
              guardian_1_mobile AS guardian1Mobile,
              guardian_2_name AS guardian2Name,
              guardian_2_address AS guardian2Address,
              guardian_2_email AS guardian2Email,
              guardian_2_phone AS guardian2Phone,
              guardian_2_mobile AS guardian2Mobile,
              marital_status AS maritalStatus, spouse_name AS spouseName,
              number_of_children AS numberOfChildren
       FROM person_family_profile
       WHERE person_id = ? AND organization_id = ?`,
      )
        .bind(parsedId.data, context.organizationId)
        .first<{
          parentageStatus: string | null;
          motherName: string | null;
          fatherName: string | null;
          motherOccupation: string | null;
          fatherOccupation: string | null;
          parentsPhone: string | null;
          parentsPermanentAddress: string | null;
          guardian1Name: string | null;
          guardian1Address: string | null;
          guardian1Email: string | null;
          guardian1Phone: string | null;
          guardian1Mobile: string | null;
          guardian2Name: string | null;
          guardian2Address: string | null;
          guardian2Email: string | null;
          guardian2Phone: string | null;
          guardian2Mobile: string | null;
          maritalStatus: string | null;
          spouseName: string | null;
          numberOfChildren: string | null;
        }>(),
      runtime.DB.prepare(
        `WITH reciprocal_relationships AS (
         SELECT relationship.*,
                CASE
                  WHEN relationship.person_id = ? THEN relationship.related_person_id
                  ELSE relationship.person_id
                END AS counterpart_id
         FROM person_relationship AS relationship
         WHERE relationship.organization_id = ?
           AND relationship.relationship_type = 'sibling'
           AND relationship.is_active = 1
           AND (relationship.person_id = ? OR relationship.related_person_id = ?)
       ), ranked_relationships AS (
         SELECT reciprocal_relationships.*,
                ROW_NUMBER() OVER (
                  PARTITION BY counterpart_id
                  ORDER BY
                    CASE WHEN review_flag IS NULL THEN 1 ELSE 0 END,
                    CAST(source_id AS INTEGER), id
                ) AS relationship_rank
         FROM reciprocal_relationships
       )
       SELECT relationship.id, relationship.relationship_type AS relationshipType,
              relationship.review_flag AS reviewFlag,
              related.id AS personId, related.display_name AS displayName,
              related.primary_identifier AS primaryIdentifier,
              related.identifier_kind AS identifierKind,
              related.kind, related.status
       FROM ranked_relationships AS relationship
       JOIN person AS related
         ON related.id = relationship.counterpart_id
        AND related.organization_id = relationship.organization_id
       WHERE relationship.relationship_rank = 1
       ORDER BY related.display_name COLLATE NOCASE, relationship.source_id`,
      )
        .bind(parsedId.data, context.organizationId, parsedId.data, parsedId.data)
        .all<{
          id: string;
          relationshipType: "sibling";
          reviewFlag: "self_reference" | "duplicate_source_link" | null;
          personId: string;
          displayName: string;
          primaryIdentifier: string;
          identifierKind: "admission" | "staff";
          kind: "child" | "elderly" | "staff";
          status: "active" | "inactive";
        }>(),
      runtime.DB.prepare(
        `SELECT id, category, label, file_name AS fileName,
              content_type AS contentType, byte_size AS byteSize,
              is_primary AS isPrimary
       FROM person_file
       WHERE person_id = ? AND organization_id = ? AND is_active = 1
       ORDER BY
         CASE category
           WHEN 'profile_photo' THEN 0
           WHEN 'parents_photo' THEN 1
           WHEN 'guardian_1_photo' THEN 2
           WHEN 'guardian_2_photo' THEN 3
           ELSE 4
         END,
         label COLLATE NOCASE, source_id`,
      )
        .bind(parsedId.data, context.organizationId)
        .all<{
          id: string;
          category:
            | "profile_photo"
            | "parents_photo"
            | "guardian_1_photo"
            | "guardian_2_photo"
            | "document";
          label: string;
          fileName: string;
          contentType: string;
          byteSize: number;
          isPrimary: number;
        }>(),
    ]);

  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const canEdit = canManageSchool(context.role);

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
      canEdit,
      editRestriction: canEdit ? null : "permission",
      reviewFlags,
      placements: placements.results.map((placement) => ({
        id: placement.id,
        homeName: placement.homeName,
        locationName: placement.locationName,
        placementType: placement.placementType,
        startedOn: placement.startedOn,
        endedOn: placement.endedOn,
        reason: placement.reason,
        remarks: placement.remarks,
        isCurrent: Boolean(placement.isCurrent),
        sourceId: placement.sourceId,
      })),
      academicRecords: academicRecords.results.map((record) => ({
        id: record.id,
        className: record.className,
        classLevel: record.classLevel,
        classSection: record.classSection,
        classTitle: record.classTitle,
        schoolName: record.schoolName,
        houseName: record.houseName,
        academicSession: record.academicSession,
        recordedOn: record.recordedOn,
        result: record.result,
        rollNumber: record.rollNumber,
        boardRegistrationNumber: record.boardRegistrationNumber,
        description: record.description,
        isLatest: Boolean(record.isLatest),
        sourceId: record.sourceId,
      })),
      family: familyProfile ?? null,
      relationships: relationships.results,
      files: files.results.map((file) => ({
        ...file,
        isPrimary: Boolean(file.isPrimary),
        url: `/api/files/${file.id}`,
      })),
    },
  });
}

async function updatePersonCoreDetails(request: Request, personId: string): Promise<Response> {
  if (!isSameOrigin(request)) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const parsed = personCoreDetailsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Check the person details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const runtime = getRuntimeEnv();
  const current = await runtime.DB.prepare(
    `SELECT id, identifier_kind AS identifierKind,
            primary_identifier AS primaryIdentifier, display_name AS displayName,
            gender, date_of_birth AS dateOfBirth,
            admitted_or_joined_on AS admittedOrJoinedOn,
            campus_or_location AS campusOrLocation, nationality, source_system AS sourceSystem
     FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{
      id: string;
      identifierKind: "admission" | "staff";
      primaryIdentifier: string;
      displayName: string;
      gender: "female" | "male" | "other" | "unknown" | null;
      dateOfBirth: string | null;
      admittedOrJoinedOn: string | null;
      campusOrLocation: string | null;
      nationality: string | null;
      sourceSystem: string;
    }>();

  if (!current) return Response.json({ error: "Person not found" }, { status: 404 });
  const duplicate = await runtime.DB.prepare(
    `SELECT id FROM person
     WHERE organization_id = ? AND identifier_kind = ? AND id <> ?
       AND lower(primary_identifier) = lower(?)`,
  )
    .bind(
      context.organizationId,
      current.identifierKind,
      parsedId.data,
      parsed.data.primaryIdentifier,
    )
    .first<{ id: string }>();
  if (duplicate) {
    const label = current.identifierKind === "staff" ? "staff number" : "admission number";
    return Response.json({ error: `That ${label} is already in use.` }, { status: 409 });
  }

  const next = parsed.data;
  const changedFields = (
    [
      ["primaryIdentifier", current.primaryIdentifier, next.primaryIdentifier],
      ["displayName", current.displayName, next.displayName],
      ["gender", current.gender ?? "unknown", next.gender],
      ["dateOfBirth", current.dateOfBirth, next.dateOfBirth],
      ["admittedOrJoinedOn", current.admittedOrJoinedOn, next.admittedOrJoinedOn],
      ["campusOrLocation", current.campusOrLocation, next.campusOrLocation],
      ["nationality", current.nationality, next.nationality],
    ] as const
  )
    .filter(([, before, after]) => before !== after)
    .map(([field]) => field);

  if (!changedFields.length) {
    return Response.json({ personId: parsedId.data, changedFields });
  }

  try {
    await runtime.DB.batch([
      runtime.DB.prepare(
        `UPDATE person
         SET primary_identifier = ?, display_name = ?, gender = ?, date_of_birth = ?,
             admitted_or_joined_on = ?, campus_or_location = ?, nationality = ?,
             updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
      ).bind(
        next.primaryIdentifier,
        next.displayName,
        next.gender,
        next.dateOfBirth,
        next.admittedOrJoinedOn,
        next.campusOrLocation,
        next.nationality,
        context.userId,
        parsedId.data,
        context.organizationId,
      ),
      auditStatement(runtime.DB, context, "person.details_updated", "person", parsedId.data, {
        changedFields: changedFields.join(","),
        sourceSystem: current.sourceSystem,
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "That identifier is already in use." }, { status: 409 });
    }
    throw error;
  }

  return Response.json({ personId: parsedId.data, changedFields });
}

async function addHomePlacement(request: Request, personId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  const parsed = homePlacementSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the placement details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const runtime = getRuntimeEnv();
  const [person, current] = await Promise.all([
    runtime.DB.prepare(`SELECT id, kind FROM person WHERE id = ? AND organization_id = ?`)
      .bind(parsedId.data, context.organizationId)
      .first<{ id: string; kind: "child" | "elderly" | "staff" }>(),
    runtime.DB.prepare(
      `SELECT id, home_name AS homeName, location_name AS locationName,
              placement_type AS placementType, started_on AS startedOn
       FROM person_placement
       WHERE person_id = ? AND organization_id = ? AND is_current = 1`,
    )
      .bind(parsedId.data, context.organizationId)
      .first<{
        id: string;
        homeName: string;
        locationName: string | null;
        placementType: string | null;
        startedOn: string;
      }>(),
  ]);

  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });
  if (person.kind === "staff") {
    return Response.json({ error: "Home placement is not used for staff." }, { status: 400 });
  }

  const placement = parsed.data;
  if (
    current &&
    current.homeName === placement.homeName &&
    current.locationName === placement.locationName &&
    current.placementType === placement.placementType &&
    current.startedOn === placement.startedOn
  ) {
    return Response.json({ error: "This is already the current placement." }, { status: 409 });
  }

  const placementId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  if (current) {
    statements.push(
      runtime.DB.prepare(
        `UPDATE person_placement
         SET is_current = 0, ended_on = ?, updated_by_user_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND is_current = 1`,
      ).bind(placement.startedOn, context.userId, current.id, context.organizationId),
    );
  }
  statements.push(
    runtime.DB.prepare(
      `INSERT INTO person_placement (
         id, organization_id, person_id, home_name, location_name, placement_type,
         started_on, reason, remarks, is_current, source_system, source_table,
         source_id, created_by_user_id, updated_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'tsewa', 'person_placement', ?, ?, ?)`,
    ).bind(
      placementId,
      context.organizationId,
      parsedId.data,
      placement.homeName,
      placement.locationName,
      placement.placementType,
      placement.startedOn,
      placement.reason,
      placement.remarks,
      placementId,
      context.userId,
      context.userId,
    ),
    runtime.DB.prepare(
      `UPDATE person
       SET campus_or_location = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
    ).bind(
      placement.locationName ?? placement.homeName,
      context.userId,
      parsedId.data,
      context.organizationId,
    ),
    auditStatement(runtime.DB, context, "person.home_placement_changed", "person", parsedId.data, {
      placementId,
      previousPlacementId: current?.id ?? "none",
      homeName: placement.homeName,
      startedOn: placement.startedOn,
    }),
  );

  try {
    await runtime.DB.batch(statements);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json(
        { error: "The placement changed while this form was open. Please try again." },
        { status: 409 },
      );
    }
    throw error;
  }

  return Response.json({ personId: parsedId.data, placementId }, { status: 201 });
}

async function updatePersonFamily(request: Request, personId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();

  const parsedId = personIdSchema.safeParse(personId);
  const parsed = personFamilyDetailsSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the family details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const runtime = getRuntimeEnv();
  const person = await runtime.DB.prepare(
    `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const current = await runtime.DB.prepare(
    `SELECT id, source_system AS sourceSystem,
            parentage_status AS parentageStatus, mother_name AS motherName,
            father_name AS fatherName, mother_occupation AS motherOccupation,
            father_occupation AS fatherOccupation, parents_phone AS parentsPhone,
            parents_permanent_address AS parentsPermanentAddress,
            guardian_1_name AS guardian1Name, guardian_1_address AS guardian1Address,
            guardian_1_email AS guardian1Email, guardian_1_phone AS guardian1Phone,
            guardian_1_mobile AS guardian1Mobile, guardian_2_name AS guardian2Name,
            guardian_2_address AS guardian2Address, guardian_2_email AS guardian2Email,
            guardian_2_phone AS guardian2Phone, guardian_2_mobile AS guardian2Mobile,
            marital_status AS maritalStatus, spouse_name AS spouseName,
            number_of_children AS numberOfChildren
     FROM person_family_profile WHERE person_id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<FamilyDetailsRecord>();

  const familyFieldNames = Object.keys(parsed.data) as Array<keyof typeof parsed.data>;
  const changedFields = familyFieldNames.filter(
    (field) => (current?.[field] ?? null) !== parsed.data[field],
  );
  if (!changedFields.length) {
    return Response.json({ personId: parsedId.data, changedFields });
  }

  const profileId = current?.id ?? crypto.randomUUID();
  const details = parsed.data;
  await runtime.DB.batch([
    runtime.DB.prepare(
      `INSERT INTO person_family_profile (
         id, organization_id, person_id, parentage_status, mother_name, father_name,
         mother_occupation, father_occupation, parents_phone, parents_permanent_address,
         guardian_1_name, guardian_1_address, guardian_1_email, guardian_1_phone,
         guardian_1_mobile, guardian_2_name, guardian_2_address, guardian_2_email,
         guardian_2_phone, guardian_2_mobile, marital_status, spouse_name,
         number_of_children, source_system, source_table, source_id, updated_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         'tsewa', 'person_family_profile', ?, ?)
       ON CONFLICT(organization_id, person_id) DO UPDATE SET
         parentage_status = excluded.parentage_status, mother_name = excluded.mother_name,
         father_name = excluded.father_name, mother_occupation = excluded.mother_occupation,
         father_occupation = excluded.father_occupation, parents_phone = excluded.parents_phone,
         parents_permanent_address = excluded.parents_permanent_address,
         guardian_1_name = excluded.guardian_1_name,
         guardian_1_address = excluded.guardian_1_address,
         guardian_1_email = excluded.guardian_1_email,
         guardian_1_phone = excluded.guardian_1_phone,
         guardian_1_mobile = excluded.guardian_1_mobile,
         guardian_2_name = excluded.guardian_2_name,
         guardian_2_address = excluded.guardian_2_address,
         guardian_2_email = excluded.guardian_2_email,
         guardian_2_phone = excluded.guardian_2_phone,
         guardian_2_mobile = excluded.guardian_2_mobile,
         marital_status = excluded.marital_status, spouse_name = excluded.spouse_name,
         number_of_children = excluded.number_of_children,
         updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      profileId,
      context.organizationId,
      parsedId.data,
      details.parentageStatus,
      details.motherName,
      details.fatherName,
      details.motherOccupation,
      details.fatherOccupation,
      details.parentsPhone,
      details.parentsPermanentAddress,
      details.guardian1Name,
      details.guardian1Address,
      details.guardian1Email,
      details.guardian1Phone,
      details.guardian1Mobile,
      details.guardian2Name,
      details.guardian2Address,
      details.guardian2Email,
      details.guardian2Phone,
      details.guardian2Mobile,
      details.maritalStatus,
      details.spouseName,
      details.numberOfChildren,
      profileId,
      context.userId,
    ),
    auditStatement(runtime.DB, context, "person.family_updated", "person", parsedId.data, {
      changedFields: changedFields.join(","),
      sourceSystem: current?.sourceSystem ?? "tsewa",
    }),
  ]);

  return Response.json({ personId: parsedId.data, changedFields });
}

type FamilyDetailsRecord = z.infer<typeof personFamilyDetailsSchema> & {
  id: string;
  sourceSystem: string;
};

async function getSiblingOptions(request: Request, personId: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const parsedId = personIdSchema.safeParse(personId);
  const parsedQuery = siblingOptionsQuerySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });
  if (!parsedId.success || !parsedQuery.success) {
    return Response.json({ error: "Check the sibling search." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const runtime = getRuntimeEnv();
  const person = await runtime.DB.prepare(
    `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const bindings: Array<string> = [
    context.organizationId,
    parsedId.data,
    context.organizationId,
    parsedId.data,
    parsedId.data,
  ];
  const conditions = [
    "candidate.organization_id = ?",
    "candidate.id <> ?",
    `NOT EXISTS (
       SELECT 1 FROM person_relationship relationship
       WHERE relationship.organization_id = ? AND relationship.relationship_type = 'sibling'
         AND relationship.is_active = 1
         AND ((relationship.person_id = ? AND relationship.related_person_id = candidate.id)
           OR (relationship.related_person_id = ? AND relationship.person_id = candidate.id))
     )`,
  ];
  if (parsedQuery.data.q) {
    const search = `%${escapeLikePattern(parsedQuery.data.q.toLowerCase())}%`;
    conditions.push(
      `(lower(candidate.display_name) LIKE ? ESCAPE '\\' OR lower(candidate.primary_identifier) LIKE ? ESCAPE '\\')`,
    );
    bindings.push(search, search);
  }

  const candidates = await runtime.DB.prepare(
    `SELECT candidate.id, candidate.display_name AS displayName,
            candidate.primary_identifier AS primaryIdentifier,
            candidate.identifier_kind AS identifierKind, candidate.kind, candidate.status
     FROM person candidate
     WHERE ${conditions.join(" AND ")}
     ORDER BY candidate.display_name COLLATE NOCASE, candidate.primary_identifier
     LIMIT 20`,
  )
    .bind(...bindings)
    .all();

  return Response.json({ people: candidates.results });
}

async function addSiblingRelationship(request: Request, personId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const parsedId = personIdSchema.safeParse(personId);
  const parsed = siblingLinkSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the sibling details and try again." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();
  const runtime = getRuntimeEnv();
  const person = await runtime.DB.prepare(
    `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  let relatedPersonId: string;
  let createdPersonId: string | null = null;
  if (parsed.data.mode === "existing") {
    if (parsed.data.relatedPersonId === parsedId.data) {
      return Response.json({ error: "A person cannot be their own sibling." }, { status: 400 });
    }
    const related = await runtime.DB.prepare(
      `SELECT id FROM person WHERE id = ? AND organization_id = ?`,
    )
      .bind(parsed.data.relatedPersonId, context.organizationId)
      .first<{ id: string }>();
    if (!related) return Response.json({ error: "Sibling not found" }, { status: 404 });
    relatedPersonId = related.id;
  } else {
    const duplicate = await runtime.DB.prepare(
      `SELECT id FROM person WHERE organization_id = ? AND identifier_kind = 'admission'
         AND lower(primary_identifier) = lower(?)`,
    )
      .bind(context.organizationId, parsed.data.primaryIdentifier)
      .first<{ id: string }>();
    if (duplicate) {
      return Response.json(
        {
          error: "That admission number already belongs to a person. Search and link them instead.",
        },
        { status: 409 },
      );
    }
    relatedPersonId = crypto.randomUUID();
    createdPersonId = relatedPersonId;
  }

  const existing = await runtime.DB.prepare(
    `SELECT id FROM person_relationship
     WHERE organization_id = ? AND relationship_type = 'sibling' AND is_active = 1
       AND ((person_id = ? AND related_person_id = ?)
         OR (person_id = ? AND related_person_id = ?))
     LIMIT 1`,
  )
    .bind(context.organizationId, parsedId.data, relatedPersonId, relatedPersonId, parsedId.data)
    .first<{ id: string }>();
  if (existing)
    return Response.json(
      { error: "These people are already linked as siblings." },
      { status: 409 },
    );

  const relationshipId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  if (parsed.data.mode === "new") {
    statements.push(
      runtime.DB.prepare(
        `INSERT INTO person (
           id, organization_id, kind, status, identifier_kind, primary_identifier,
           display_name, gender, source_system, source_table, source_id,
           created_by_user_id, updated_by_user_id
         ) VALUES (?, ?, 'child', 'active', 'admission', ?, ?, ?, 'tsewa', 'person', ?, ?, ?)`,
      ).bind(
        relatedPersonId,
        context.organizationId,
        parsed.data.primaryIdentifier,
        parsed.data.displayName,
        parsed.data.gender,
        relatedPersonId,
        context.userId,
        context.userId,
      ),
      auditStatement(runtime.DB, context, "person.created_as_sibling", "person", relatedPersonId, {
        linkedFromPersonId: parsedId.data,
      }),
    );
  }
  statements.push(
    runtime.DB.prepare(
      `INSERT INTO person_relationship (
         id, organization_id, person_id, related_person_id, relationship_type,
         source_system, source_table, source_id, updated_by_user_id
       ) VALUES (?, ?, ?, ?, 'sibling', 'tsewa', 'person_relationship', ?, ?)`,
    ).bind(
      relationshipId,
      context.organizationId,
      parsedId.data,
      relatedPersonId,
      relationshipId,
      context.userId,
    ),
    auditStatement(
      runtime.DB,
      context,
      "person.sibling_added",
      "person_relationship",
      relationshipId,
      {
        personId: parsedId.data,
        relatedPersonId,
      },
    ),
  );
  await runtime.DB.batch(statements);

  return Response.json({ relationshipId, relatedPersonId, createdPersonId }, { status: 201 });
}

async function removeSiblingRelationship(
  request: Request,
  personId: string,
  relationshipId: string,
): Promise<Response> {
  if (request.method !== "DELETE") return methodNotAllowed("DELETE");
  if (!isSameOrigin(request)) return forbidden();
  const parsedPersonId = personIdSchema.safeParse(personId);
  const parsedRelationshipId = z.uuid().safeParse(relationshipId);
  if (!parsedPersonId.success || !parsedRelationshipId.success) {
    return Response.json({ error: "Invalid sibling link." }, { status: 400 });
  }

  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();
  const runtime = getRuntimeEnv();
  const relationship = await runtime.DB.prepare(
    `SELECT id, person_id AS personId, related_person_id AS relatedPersonId
     FROM person_relationship
     WHERE id = ? AND organization_id = ? AND relationship_type = 'sibling'
       AND is_active = 1 AND (person_id = ? OR related_person_id = ?)`,
  )
    .bind(
      parsedRelationshipId.data,
      context.organizationId,
      parsedPersonId.data,
      parsedPersonId.data,
    )
    .first<{ id: string; personId: string; relatedPersonId: string }>();
  if (!relationship) return Response.json({ error: "Sibling link not found." }, { status: 404 });

  const relatedPersonId =
    relationship.personId === parsedPersonId.data
      ? relationship.relatedPersonId
      : relationship.personId;
  const count = await runtime.DB.prepare(
    `SELECT COUNT(*) AS total FROM person_relationship
     WHERE organization_id = ? AND relationship_type = 'sibling' AND is_active = 1
       AND ((person_id = ? AND related_person_id = ?)
         OR (person_id = ? AND related_person_id = ?))`,
  )
    .bind(
      context.organizationId,
      parsedPersonId.data,
      relatedPersonId,
      relatedPersonId,
      parsedPersonId.data,
    )
    .first<{ total: number }>();

  await runtime.DB.batch([
    runtime.DB.prepare(
      `UPDATE person_relationship SET is_active = 0, removed_at = CURRENT_TIMESTAMP,
         updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND relationship_type = 'sibling' AND is_active = 1
         AND ((person_id = ? AND related_person_id = ?)
           OR (person_id = ? AND related_person_id = ?))`,
    ).bind(
      context.userId,
      context.organizationId,
      parsedPersonId.data,
      relatedPersonId,
      relatedPersonId,
      parsedPersonId.data,
    ),
    auditStatement(
      runtime.DB,
      context,
      "person.sibling_removed",
      "person_relationship",
      relationship.id,
      {
        personId: parsedPersonId.data,
        relatedPersonId,
        hiddenSourceRows: String(Number(count?.total ?? 0)),
      },
    ),
  ]);

  return Response.json({ ok: true, relatedPersonId });
}

async function getPersonFile(request: Request, fileId: string): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();

  const parsedId = fileIdSchema.safeParse(fileId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const file = await runtime.DB.prepare(
    `SELECT r2_object_key AS r2ObjectKey, file_name AS fileName,
            content_type AS contentType, byte_size AS byteSize
     FROM person_file
     WHERE id = ? AND organization_id = ? AND is_active = 1`,
  )
    .bind(parsedId.data, context.organizationId)
    .first<{
      r2ObjectKey: string;
      fileName: string;
      contentType: string;
      byteSize: number;
    }>();
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  const object = await runtime.FILES.get(file.r2ObjectKey);
  if (!object) return Response.json({ error: "Stored file not found" }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", file.contentType);
  headers.set("Content-Length", String(object.size));
  headers.set("Content-Disposition", inlineContentDisposition(file.fileName));
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
}

const MAX_PERSON_FILE_BYTES = 25 * 1024 * 1024;
const PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_CONTENT_TYPES = new Set([
  ...PHOTO_CONTENT_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

async function addPersonFile(request: Request, personId: string): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const parsedPersonId = personIdSchema.safeParse(personId);
  if (!parsedPersonId.success)
    return Response.json({ error: "Invalid person ID" }, { status: 400 });

  const runtime = getRuntimeEnv();
  const person = await runtime.DB.prepare(
    "SELECT id FROM person WHERE id = ? AND organization_id = ?",
  )
    .bind(parsedPersonId.data, context.organizationId)
    .first<{ id: string }>();
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const parsed = await parsePersonFileForm(request);
  if (parsed instanceof Response) return parsed;

  if (parsed.category !== "document") {
    const existing = await runtime.DB.prepare(
      `SELECT id FROM person_file
       WHERE organization_id = ? AND person_id = ? AND category = ? AND is_active = 1
       LIMIT 1`,
    )
      .bind(context.organizationId, parsedPersonId.data, parsed.category)
      .first<{ id: string }>();
    if (existing) {
      return Response.json(
        { error: "This photo already exists. Use Replace to change it." },
        { status: 409 },
      );
    }
  }

  return storePersonFile(runtime, context, parsedPersonId.data, parsed, null);
}

async function handlePersonFile(
  request: Request,
  personId: string,
  fileId: string,
): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!canManageSchool(context.role)) return forbidden();

  const parsedPersonId = personIdSchema.safeParse(personId);
  const parsedFileId = fileIdSchema.safeParse(fileId);
  if (!parsedPersonId.success || !parsedFileId.success) {
    return Response.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const existing = await runtime.DB.prepare(
    `SELECT id, category, label, file_name AS fileName, r2_object_key AS r2ObjectKey
     FROM person_file
     WHERE id = ? AND person_id = ? AND organization_id = ? AND is_active = 1`,
  )
    .bind(parsedFileId.data, parsedPersonId.data, context.organizationId)
    .first<{
      id: string;
      category: z.infer<typeof personFileCategorySchema>;
      label: string;
      fileName: string;
      r2ObjectKey: string;
    }>();
  if (!existing) return Response.json({ error: "File not found" }, { status: 404 });

  if (request.method === "PATCH") {
    const input = personFileNameSchema.safeParse(
      ((await request.json().catch(() => null)) as { name?: unknown } | null)?.name,
    );
    if (!input.success) {
      return Response.json(
        { error: "Enter a name between 1 and 160 characters." },
        { status: 400 },
      );
    }
    await runtime.DB.batch([
      runtime.DB.prepare(
        `UPDATE person_file SET label = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND is_active = 1`,
      ).bind(input.data, context.userId, existing.id, context.organizationId),
      auditStatement(runtime.DB, context, "person.file_renamed", "person_file", existing.id, {
        personId: parsedPersonId.data,
        previousName: existing.label,
        name: input.data,
      }),
    ]);
    return Response.json({ ok: true });
  }

  if (request.method === "POST") {
    const parsed = await parsePersonFileForm(request, existing.category);
    if (parsed instanceof Response) return parsed;
    const response = await storePersonFile(runtime, context, parsedPersonId.data, parsed, existing);
    if (response.ok) await runtime.FILES.delete(existing.r2ObjectKey);
    return response;
  }

  if (request.method === "DELETE") {
    const statements = [
      runtime.DB.prepare(
        `UPDATE person_file SET is_active = 0, removed_at = CURRENT_TIMESTAMP,
           updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND is_active = 1`,
      ).bind(context.userId, existing.id, context.organizationId),
      auditStatement(runtime.DB, context, "person.file_removed", "person_file", existing.id, {
        personId: parsedPersonId.data,
        name: existing.label,
        category: existing.category,
      }),
    ];
    if (existing.category === "profile_photo") {
      statements.push(
        runtime.DB.prepare(
          "UPDATE person SET photo_asset_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?",
        ).bind(parsedPersonId.data, context.organizationId),
      );
    }
    await runtime.DB.batch(statements);
    await runtime.FILES.delete(existing.r2ObjectKey);
    return Response.json({ ok: true });
  }

  return methodNotAllowed("PATCH, POST, DELETE");
}

async function parsePersonFileForm(
  request: Request,
  fixedCategory?: z.infer<typeof personFileCategorySchema>,
): Promise<
  { category: z.infer<typeof personFileCategorySchema>; name: string; file: File } | Response
> {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Upload a file." }, { status: 400 });
  const file = form.get("file");
  const category = fixedCategory ?? personFileCategorySchema.safeParse(form.get("category")).data;
  const name = personFileNameSchema.safeParse(form.get("name"));
  if (!(file instanceof File) || !category || !name.success) {
    return Response.json({ error: "Choose a file, type, and name." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_PERSON_FILE_BYTES) {
    return Response.json({ error: "Files must be between 1 byte and 25 MB." }, { status: 400 });
  }
  const allowed = category === "document" ? DOCUMENT_CONTENT_TYPES : PHOTO_CONTENT_TYPES;
  if (!allowed.has(file.type)) {
    return Response.json(
      {
        error:
          category === "document"
            ? "This file type is not supported."
            : "Use a JPEG, PNG, or WebP photo.",
      },
      { status: 400 },
    );
  }
  return { category, name: name.data, file };
}

async function storePersonFile(
  runtime: ReturnType<typeof getRuntimeEnv>,
  context: MembershipContext,
  personId: string,
  input: { category: z.infer<typeof personFileCategorySchema>; name: string; file: File },
  replaced: { id: string; r2ObjectKey: string } | null,
): Promise<Response> {
  const id = crypto.randomUUID();
  const bytes = await input.file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const objectKey = `organizations/${context.organizationId}/people/${personId}/uploads/${id}`;

  await runtime.FILES.put(objectKey, bytes, {
    httpMetadata: { contentType: input.file.type },
  });

  try {
    const statements = [];
    if (replaced) {
      statements.push(
        runtime.DB.prepare(
          `UPDATE person_file SET is_active = 0, removed_at = CURRENT_TIMESTAMP,
             updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND organization_id = ? AND is_active = 1`,
        ).bind(context.userId, replaced.id, context.organizationId),
      );
    }
    statements.push(
      runtime.DB.prepare(
        `INSERT INTO person_file (
           id, organization_id, person_id, category, label, file_name, content_type,
           byte_size, sha256, r2_object_key, is_primary, source_system, source_table,
           source_id, source_asset_id, created_by_user_id, updated_by_user_id, replaces_file_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tsewa', 'person_file', ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        context.organizationId,
        personId,
        input.category,
        input.name,
        input.file.name,
        input.file.type,
        input.file.size,
        sha256,
        objectKey,
        input.category === "profile_photo" ? 1 : 0,
        id,
        id,
        context.userId,
        context.userId,
        replaced?.id ?? null,
      ),
    );
    if (input.category === "profile_photo") {
      statements.push(
        runtime.DB.prepare(
          "UPDATE person SET photo_asset_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?",
        ).bind(objectKey, personId, context.organizationId),
      );
    }
    statements.push(
      auditStatement(
        runtime.DB,
        context,
        replaced ? "person.file_replaced" : "person.file_added",
        "person_file",
        id,
        {
          personId,
          category: input.category,
          name: input.name,
          replacedFileId: replaced?.id ?? "",
        },
      ),
    );
    await runtime.DB.batch(statements);
  } catch (error) {
    await runtime.FILES.delete(objectKey);
    throw error;
  }
  return Response.json({ ok: true, id }, { status: replaced ? 200 : 201 });
}

function inlineContentDisposition(fileName: string): string {
  const fallback = fileName.replaceAll(/[\r\n"\\]/g, "_").replaceAll(/[^\x20-\x7e]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function getPlatformStatus(request: Request): Promise<Response> {
  const runtime = getRuntimeEnv();
  const context = await getMembershipContext(request);
  const [userCount, sessions, preference, organizations] = await Promise.all([
    runtime.DB.prepare('SELECT COUNT(*) AS count FROM "user"').first<{
      count: number;
    }>(),
    runtime.DB.prepare(
      `SELECT id, name, starts_on AS startsOn, ends_on AS endsOn
       FROM academic_session
       WHERE is_active = 1
         AND organization_id = coalesce(
           ?,
           (SELECT id FROM organization WHERE slug = ? LIMIT 1)
         )
       ORDER BY starts_on DESC`,
    )
      .bind(context?.organizationId ?? null, runtime.DEFAULT_ORGANIZATION_SLUG)
      .all<{
        id: string;
        name: string;
        startsOn: string;
        endsOn: string;
      }>(),
    context
      ? runtime.DB.prepare(
          `SELECT active_academic_session_id AS activeSessionId
           FROM user_preference WHERE user_id = ? AND active_organization_id = ?`,
        )
          .bind(context.userId, context.organizationId)
          .first<{ activeSessionId: string | null }>()
      : Promise.resolve(null),
    context
      ? runtime.DB.prepare(
          `SELECT organization.id, organization.name, organization_member.role,
                  (SELECT session.id FROM academic_session session
                   WHERE session.organization_id = organization.id AND session.is_active = 1
                   ORDER BY session.starts_on DESC LIMIT 1) AS defaultSessionId
           FROM organization_member
           JOIN organization ON organization.id = organization_member.organization_id
           WHERE organization_member.user_id = ?
           ORDER BY organization.name COLLATE NOCASE`,
        )
          .bind(context.userId)
          .all<{
            id: string;
            name: string;
            role: MembershipContext["role"];
            defaultSessionId: string | null;
          }>()
      : Promise.resolve({ results: [] }),
  ]);

  return Response.json({
    needsSetup: Number(userCount?.count ?? 0) === 0,
    sessions: sessions.results,
    activeSessionId: preference?.activeSessionId ?? sessions.results[0]?.id ?? null,
    activeOrganizationId: context?.organizationId ?? null,
    organizations: organizations.results,
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

function canManageSchool(role: MembershipContext["role"]): boolean {
  return role === "owner" || role === "admin" || role === "staff";
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
