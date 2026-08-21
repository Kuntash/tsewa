import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { person, personImportBatch } from "@/db/schema";

export type PeopleRegistryFilters = {
  q: string;
  kind: "all" | "child" | "elderly" | "staff";
  status: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

export async function findPeopleRegistry(
  database: Database,
  organizationId: string,
  filters: PeopleRegistryFilters,
) {
  const { q, kind, status, page, pageSize } = filters;
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
  const [countRows, people, summary, latestImports] = await Promise.all([
    database.select({ total: count() }).from(person).where(where),
    database
      .select({
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
        sourceSystem: person.sourceSystem,
        sourceTable: person.sourceTable,
        sourceId: person.sourceId,
        importedAt: person.importedAt,
      })
      .from(person)
      .where(where)
      .orderBy(asc(sql`lower(${person.displayName})`), asc(person.primaryIdentifier))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
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
  ]);

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
