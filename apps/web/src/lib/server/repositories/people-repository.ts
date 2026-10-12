import { and, asc, count, desc, eq, gte, lte, or, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { academicClassMaster, childCategory, person, personImportBatch } from "@/db/schema";

export type PeopleRegistryFilters = {
  q: string;
  kind: "all" | "child" | "elderly" | "staff";
  status: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
  includeSummary?: boolean;
  gender?: "female" | "male" | "other" | "unknown";
  location?: string;
  nationality?: string;
  category?: string;
  className?: string;
  bornFrom?: string;
  bornTo?: string;
  joinedFrom?: string;
  joinedTo?: string;
};

// A class name with its section, unless the name already ends with it. Placeholder
// classes such as "NoClass" count as no class at all.
function classLabel(name: string, section: string) {
  return `case when lower(replace(${name}, ' ', '')) in ('', 'noclass', 'none') then null
    else ${name} || case
      when lower(trim(coalesce(${section}, ''))) not in ('', 'none', '0', 'n/a', 'null')
        and lower(${name}) not like '% ' || lower(trim(${section}))
      then ' ' || trim(${section}) else '' end
    end`;
}

// The class a child is in now: their latest started enrolment, else their latest
// academic record.
const latestClassName = sql<string | null>`case when ${person.kind} = 'child' then coalesce(
  (select ${sql.raw(classLabel("trim(coalesce(nullif(cm.title, ''), cm.name))", "cm.section"))}
    from student_enrollment se
    inner join academic_session sess on sess.id = se.academic_session_id and sess.organization_id = se.organization_id
    inner join academic_class_master cm on cm.id = se.academic_class_id and cm.organization_id = se.organization_id
    where se.person_id = person.id and se.organization_id = person.organization_id
      and sess.starts_on <= date('now')
    order by sess.starts_on desc, se.updated_at desc, se.id desc limit 1),
  (select ${sql.raw(classLabel("trim(coalesce(nullif(ar.class_title, ''), ar.class_name))", "ar.class_section"))}
    from person_academic_record ar
    where ar.person_id = person.id and ar.organization_id = person.organization_id
    order by ar.is_latest desc, date(ar.recorded_on) desc, cast(ar.source_id as integer) desc, ar.id desc limit 1)
) else null end`;

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

  if (filters.gender) conditions.push(eq(person.gender, filters.gender));
  if (filters.location) conditions.push(eq(person.campusOrLocation, filters.location));
  if (filters.nationality) conditions.push(eq(person.nationality, filters.nationality));
  if (filters.category) conditions.push(eq(person.childCategoryId, filters.category));
  if (filters.className) conditions.push(sql`${latestClassName} = ${filters.className}`);
  if (filters.bornFrom) conditions.push(gte(person.dateOfBirth, filters.bornFrom));
  if (filters.bornTo) conditions.push(lte(person.dateOfBirth, filters.bornTo));
  if (filters.joinedFrom) conditions.push(gte(person.admittedOrJoinedOn, filters.joinedFrom));
  if (filters.joinedTo) conditions.push(lte(person.admittedOrJoinedOn, filters.joinedTo));

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
        latestClassName: latestClassName.as("latest_class_name"),
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
        // Values people can be filtered by.
        database
          .select({ name: sql<string>`trim(${person.campusOrLocation})`.as("location_name") })
          .from(person)
          .where(
            and(
              eq(person.organizationId, organizationId),
              sql`trim(coalesce(${person.campusOrLocation}, '')) <> ''`,
            ),
          )
          .groupBy(sql`1`)
          .orderBy(sql`1 collate nocase`),
        database
          .select({ name: sql<string>`trim(${person.nationality})`.as("nationality_name") })
          .from(person)
          .where(
            and(
              eq(person.organizationId, organizationId),
              sql`trim(coalesce(${person.nationality}, '')) <> ''`,
            ),
          )
          .groupBy(sql`1`)
          .orderBy(sql`1 collate nocase`),
        database
          .select({ id: childCategory.id, name: childCategory.name })
          .from(childCategory)
          .where(eq(childCategory.organizationId, organizationId))
          .orderBy(sql`${childCategory.name} collate nocase`),
        database
          .select({
            name: sql<string>`${sql.raw(
              classLabel(
                "trim(coalesce(nullif(academic_class_master.title, ''), academic_class_master.name))",
                "academic_class_master.section",
              ),
            )}`.as("class_label"),
          })
          .from(academicClassMaster)
          .where(eq(academicClassMaster.organizationId, organizationId))
          .groupBy(sql`1`)
          .orderBy(
            sql`coalesce(min(${academicClassMaster.sortOrder}), 999)`,
            sql`coalesce(min(${academicClassMaster.level}), 999)`,
            sql`1 collate nocase`,
          ),
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
    filterOptions: {
      locations: (metadata?.[2] ?? []).map((item) => item.name),
      nationalities: (metadata?.[3] ?? []).map((item) => item.name),
      categories: metadata?.[4] ?? [],
      classes: (metadata?.[5] ?? []).flatMap((item) => (item.name ? [item.name] : [])),
    },
  };
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
