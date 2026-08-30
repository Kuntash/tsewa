import { and, count, desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Database } from "@/db/client";
import {
  academicSession,
  auditEvent,
  healthVisit,
  organization,
  person,
  scholarshipRecord,
  sponsorshipAssignment,
  studentEnrollment,
  user,
} from "@/db/schema";
import type { PermissionKey } from "@/lib/access-control";
import { toEpochMilliseconds } from "@/lib/date-time";

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
  const temporal = await database
    .select({ locale: organization.locale, timeZone: organization.timezone })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)
    .then((rows) => rows[0] ?? { locale: "en-IN", timeZone: "Asia/Kolkata" });

  const queries: BatchItem<"sqlite">[] = [];
  const add = (query: BatchItem<"sqlite">) => {
    const index = queries.length;
    queries.push(query);
    return index;
  };
  const peopleIndex = can("people.read")
    ? add(
        database
          .select({
            total: count(),
            active: sql<number>`sum(case when ${person.status} = 'active' then 1 else 0 end)`,
          })
          .from(person)
          .where(eq(person.organizationId, organizationId)),
      )
    : -1;
  const schoolIndex = can("school.read")
    ? add(
        database
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
          ),
      )
    : -1;
  const scholarshipIndex = can("scholarship.read")
    ? add(
        database
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
          ),
      )
    : -1;
  const sponsorshipIndex = can("sponsorship.read")
    ? add(
        database
          .select({ total: count() })
          .from(sponsorshipAssignment)
          .where(
            and(
              eq(sponsorshipAssignment.organizationId, organizationId),
              eq(sponsorshipAssignment.academicSessionId, session.id),
            ),
          ),
      )
    : -1;
  const healthIndex = can("health.read")
    ? add(
        database
          .select({
            total: count(),
            recent: sql<number>`sum(case when ${healthVisit.checkupDate} >= date('now', '-30 days') then 1 else 0 end)`,
          })
          .from(healthVisit)
          .where(eq(healthVisit.organizationId, organizationId)),
      )
    : -1;
  const activityIndex = can("audit.read")
    ? add(
        database
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
          .limit(8),
      )
    : -1;
  const results = queries.length
    ? await database.batch(queries as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]])
    : [];
  type Metric = { total: number; active?: number; current?: number; recent?: number };
  type Activity = {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    occurredAt: string;
    actorName: string | null;
  };
  const metricAt = (index: number) =>
    index >= 0 ? ((results[index] as Metric[])[0] ?? null) : null;
  const people = metricAt(peopleIndex);
  const school = metricAt(schoolIndex);
  const scholarships = metricAt(scholarshipIndex);
  const sponsorships = metricAt(sponsorshipIndex);
  const health = metricAt(healthIndex);
  const activity = activityIndex >= 0 ? (results[activityIndex] as Activity[]) : [];

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
    activity: activity.map((event) => ({
      ...event,
      occurredAt: toEpochMilliseconds(event.occurredAt),
    })),
    temporal,
  };
}
