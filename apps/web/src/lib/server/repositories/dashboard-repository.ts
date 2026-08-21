import { and, count, desc, eq, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  academicSession,
  auditEvent,
  healthVisit,
  person,
  scholarshipRecord,
  sponsorshipAssignment,
  studentEnrollment,
  user,
} from "@/db/schema";
import type { PermissionKey } from "@/lib/access-control";

export async function findDashboard(
  database: Database,
  organizationId: string,
  sessionId: string,
  permissions: readonly PermissionKey[],
) {
  const can = (permission: PermissionKey) => permissions.includes(permission);
  const session = await database
    .select({
      id: academicSession.id,
      name: academicSession.name,
      startsOn: academicSession.startsOn,
      endsOn: academicSession.endsOn,
    })
    .from(academicSession)
    .where(
      and(
        eq(academicSession.id, sessionId),
        eq(academicSession.organizationId, organizationId),
        eq(academicSession.isActive, 1),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!session) return null;

  const [people, school, scholarships, sponsorships, health, activity] = await Promise.all([
    can("people.read")
      ? database
          .select({
            total: count(),
            active: sql<number>`sum(case when ${person.status} = 'active' then 1 else 0 end)`,
          })
          .from(person)
          .where(eq(person.organizationId, organizationId))
          .then((rows) => rows[0])
      : Promise.resolve(null),
    can("school.read")
      ? database
          .select({
            total: count(),
            current: sql<number>`sum(case when ${studentEnrollment.status} in ('recorded', 'enrolled') then 1 else 0 end)`,
          })
          .from(studentEnrollment)
          .where(
            and(
              eq(studentEnrollment.organizationId, organizationId),
              eq(studentEnrollment.academicSessionId, session.id),
            ),
          )
          .then((rows) => rows[0])
      : Promise.resolve(null),
    can("scholarship.read")
      ? database
          .select({
            total: count(),
            active: sql<number>`sum(case when lower(${scholarshipRecord.status}) not in ('closed', 'rejected') then 1 else 0 end)`,
          })
          .from(scholarshipRecord)
          .where(
            and(
              eq(scholarshipRecord.organizationId, organizationId),
              eq(scholarshipRecord.academicSessionId, session.id),
            ),
          )
          .then((rows) => rows[0])
      : Promise.resolve(null),
    can("sponsorship.read")
      ? database
          .select({ total: count() })
          .from(sponsorshipAssignment)
          .where(
            and(
              eq(sponsorshipAssignment.organizationId, organizationId),
              eq(sponsorshipAssignment.academicSessionId, session.id),
            ),
          )
          .then((rows) => rows[0])
      : Promise.resolve(null),
    can("health.read")
      ? database
          .select({
            total: count(),
            recent: sql<number>`sum(case when ${healthVisit.checkupDate} >= date('now', '-30 days') then 1 else 0 end)`,
          })
          .from(healthVisit)
          .where(eq(healthVisit.organizationId, organizationId))
          .then((rows) => rows[0])
      : Promise.resolve(null),
    can("audit.read")
      ? database
          .select({
            id: auditEvent.id,
            action: auditEvent.action,
            entityType: auditEvent.entityType,
            entityId: auditEvent.entityId,
            occurredAt: auditEvent.occurredAt,
            actorName: user.name,
          })
          .from(auditEvent)
          .leftJoin(user, eq(user.id, auditEvent.actorUserId))
          .where(eq(auditEvent.organizationId, organizationId))
          .orderBy(desc(auditEvent.occurredAt))
          .limit(8)
      : Promise.resolve([]),
  ]);

  return {
    session,
    metrics: {
      people: people
        ? { value: Number(people.active ?? 0), total: Number(people.total ?? 0) }
        : null,
      school: school
        ? { value: Number(school.current ?? 0), total: Number(school.total ?? 0) }
        : null,
      scholarships: scholarships
        ? { value: Number(scholarships.active ?? 0), total: Number(scholarships.total ?? 0) }
        : null,
      sponsorships: sponsorships
        ? { value: Number(sponsorships.total ?? 0), total: Number(sponsorships.total ?? 0) }
        : null,
      health: health
        ? { value: Number(health.recent ?? 0), total: Number(health.total ?? 0) }
        : null,
    },
    activity,
  };
}
