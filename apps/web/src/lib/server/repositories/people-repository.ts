import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { person, personImportBatch } from "@/db/schema";

export type PeopleRegistryFilters = {
  q: string;
  kind: "all" | "child" | "elderly" | "staff";
  status: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
  includeSummary?: boolean;
};

export async function findPeopleRegistry(
  database: Database,
  organizationId: string,
  filters: PeopleRegistryFilters,
) {
  const { q, kind, status, page, pageSize, includeSummary = true } = filters;
  const conditions = [eq(person.organizationId, organizationId)];
  if (kind !== "all") conditions.push(eq(person.kind, kind));
  if (status !== "all") conditions.push(eq(person.status, status));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${person.displayName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(${person.primaryIdentifier}) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }

  const where = and(...conditions);
  const resultsQuery = database.batch([
    database.select({ total: count() }).from(person).where(where),
    database
      .select({
        id: person.id,
        kind: person.kind,
        status: person.status,
        identifierKind: person.identifierKind,
        primaryIdentifier: person.primaryIdentifier,
        displayName: person.displayName,
        latestClassName: sql<string | null>`case when ${person.kind} = 'child' then coalesce(
          (select trim(coalesce(nullif(cm.title, ''), cm.name)) || case
            when lower(trim(coalesce(cm.section, ''))) not in ('', 'none', '0', 'n/a', 'null')
              and lower(trim(coalesce(nullif(cm.title, ''), cm.name))) not like '% ' || lower(trim(cm.section))
            then ' ' || trim(cm.section) else '' end
            from student_enrollment se
            inner join academic_session sess on sess.id = se.academic_session_id and sess.organization_id = se.organization_id
            inner join academic_class_master cm on cm.id = se.academic_class_id and cm.organization_id = se.organization_id
            where se.person_id = person.id and se.organization_id = person.organization_id
              and sess.starts_on <= date('now')
            order by sess.starts_on desc, se.updated_at desc, se.id desc limit 1),
          (select trim(coalesce(nullif(ar.class_title, ''), ar.class_name)) || case
            when lower(trim(coalesce(ar.class_section, ''))) not in ('', 'none', '0', 'n/a', 'null')
              and lower(trim(coalesce(nullif(ar.class_title, ''), ar.class_name))) not like '% ' || lower(trim(ar.class_section))
            then ' ' || trim(ar.class_section) else '' end
            from person_academic_record ar
            where ar.person_id = person.id and ar.organization_id = person.organization_id
            order by ar.is_latest desc, date(ar.recorded_on) desc, cast(ar.source_id as integer) desc, ar.id desc limit 1)
        ) else null end`.as("latest_class_name"),
        gender: person.gender,
        dateOfBirth: person.dateOfBirth,
        admittedOrJoinedOn: person.admittedOrJoinedOn,
        campusOrLocation: person.campusOrLocation,
        sourceSystem: person.sourceSystem,
        sourceTable: person.sourceTable,
        sourceId: person.sourceId,
        importedAt: person.importedAt,
      })
      .from(person)
      .where(where)
      .orderBy(
        asc(sql`lower(${person.displayName})`),
        asc(person.primaryIdentifier),
        asc(person.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const metadataQuery = includeSummary
    ? database.batch([
        database
          .select({ kind: person.kind, status: person.status, count: count() })
          .from(person)
          .where(eq(person.organizationId, organizationId))
          .groupBy(person.kind, person.status),
        database
          .select({
            id: personImportBatch.id,
            sourceSystem: personImportBatch.sourceSystem,
            mode: personImportBatch.mode,
            status: personImportBatch.status,
            sourceCount: personImportBatch.sourceCount,
            eligibleCount: personImportBatch.eligibleCount,
            importedCount: personImportBatch.importedCount,
            skippedCount: personImportBatch.skippedCount,
            issueCount: personImportBatch.issueCount,
            createdAt: personImportBatch.createdAt,
            finishedAt: personImportBatch.finishedAt,
          })
          .from(personImportBatch)
          .where(eq(personImportBatch.organizationId, organizationId))
          .orderBy(desc(personImportBatch.createdAt))
          .limit(1),
      ])
    : Promise.resolve(null);
  const [[countRows, people], metadata] = await Promise.all([resultsQuery, metadataQuery]);
  const summary = metadata?.[0] ?? [];
  const latestImports = metadata?.[1] ?? [];

  const total = Number(countRows[0]?.total ?? 0);
  return {
    people,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    summary,
    latestImport: latestImports[0] ?? null,
  };
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
