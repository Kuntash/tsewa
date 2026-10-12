import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDatabase } from "@/db/client";
import { getDeploymentConfig } from "@/lib/deployment";
import { apiDispatcher } from "@/lib/server/api-handlers";
import { findPeopleRegistry } from "@/lib/server/repositories/people-repository";
import {
  academicClassMaster,
  academicSession,
  childCategory,
  organization,
  organizationMember,
  person,
  personAcademicRecord,
  schoolMaster,
  studentEnrollment,
  user,
} from "@/db/schema";

const mocks = vi.hoisted(() => ({ runtime: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: mocks.runtime }));
vi.mock("@/lib/auth", () => ({ createAuth: () => ({ api: { getSession: mocks.session } }) }));

class TestStatement {
  constructor(
    private sqlite: DatabaseSync,
    readonly query: string,
    private parameters: Array<string | number | null> = [],
  ) {}
  bind(...parameters: Array<string | number | null>) {
    return new TestStatement(this.sqlite, this.query, parameters);
  }
  execute() {
    const statement = this.sqlite.prepare(this.query);
    const results = statement.columns().length
      ? statement.all(...this.parameters)
      : (statement.run(...this.parameters), []);
    return { results, success: true, meta: {} };
  }
  async all() {
    return this.execute();
  }
  async run() {
    return this.all();
  }
  async raw() {
    const statement = this.sqlite.prepare(this.query);
    statement.setReturnArrays(true);
    return statement.all(...this.parameters);
  }
}

let sqlite: DatabaseSync;
let database: ReturnType<typeof createDatabase>;
let queries: string[];
const enrollmentId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-000000000002";
const foreignCategoryId = "00000000-0000-4000-8000-000000000003";
const filters = { q: "", kind: "child", status: "all", page: 1, pageSize: 25 } as const;

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../../../migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((file) => file.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  queries = [];
  const binding = {
    prepare: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
    dump: vi.fn(),
    withSession: vi.fn(),
  };
  binding.prepare.mockImplementation((query: string) => {
    queries.push(query);
    return new TestStatement(sqlite, query);
  });
  binding.batch.mockImplementation(async (statements: TestStatement[]) => {
    sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.execute());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  });
  database = createDatabase(binding);
  mocks.runtime.mockReturnValue({
    ORM: database,
    DB: binding,
    BETTER_AUTH_SECRET: "test-secret",
    deployment: getDeploymentConfig({
      DEPLOYMENT_MODE: "self-hosted",
      DEFAULT_ORGANIZATION_NAME: "Test school",
      DEFAULT_ORGANIZATION_SLUG: "test",
    }),
  });
  mocks.session.mockResolvedValue({ user: { id: "actor" } });
  await database
    .insert(user)
    .values({ id: "actor", name: "Staff member", email: "test@example.com" });
  await database.insert(organization).values([
    { id: "org", name: "Test school", slug: "test" },
    { id: "other", name: "Other school", slug: "other" },
  ]);
  await database
    .insert(organizationMember)
    .values({ id: "member", organizationId: "org", userId: "actor", role: "admin" });
  await database.insert(person).values([
    {
      id: "child",
      organizationId: "org",
      kind: "child",
      status: "active",
      identifierKind: "admission",
      primaryIdentifier: "A001",
      displayName: "Tashi",
      nationality: "Tibetan",
      sourceSystem: "test",
      sourceTable: "child",
      sourceId: "1",
    },
    {
      id: "namesake",
      organizationId: "org",
      kind: "child",
      status: "inactive",
      identifierKind: "admission",
      primaryIdentifier: "A002",
      displayName: "Tashi",
      sourceSystem: "test",
      sourceTable: "child",
      sourceId: "2",
    },
    {
      id: "foreign-child",
      organizationId: "other",
      kind: "child",
      status: "active",
      identifierKind: "admission",
      primaryIdentifier: "A003",
      displayName: "Tashi",
      sourceSystem: "test",
      sourceTable: "child",
      sourceId: "3",
    },
    {
      id: "staff",
      organizationId: "org",
      kind: "staff",
      status: "active",
      identifierKind: "staff",
      primaryIdentifier: "S001",
      displayName: "Staff",
      sourceSystem: "test",
      sourceTable: "staff",
      sourceId: "1",
    },
  ]);
  await database.insert(academicSession).values([
    {
      id: "current",
      organizationId: "org",
      name: "Current",
      startsOn: "2020-01-01",
      endsOn: "2098-12-31",
    },
    {
      id: "future",
      organizationId: "org",
      name: "Future",
      startsOn: "2099-01-01",
      endsOn: "2099-12-31",
    },
  ]);
  await database.insert(schoolMaster).values({
    id: "school",
    organizationId: "org",
    name: "Test school",
    sourceSystem: "test",
    sourceTable: "school",
    sourceId: "1",
  });
  await database.insert(academicClassMaster).values([
    {
      id: "class",
      organizationId: "org",
      name: "Class 8",
      title: "VIII",
      section: "A",
      sourceSystem: "test",
      sourceTable: "class",
      sourceId: "1",
    },
    {
      id: "next-class",
      organizationId: "org",
      name: "Class 9 B",
      section: "B",
      sourceSystem: "test",
      sourceTable: "class",
      sourceId: "2",
    },
  ]);
  await database.insert(studentEnrollment).values([
    {
      id: enrollmentId,
      organizationId: "org",
      personId: "child",
      academicSessionId: "current",
      schoolId: "school",
      academicClassId: "class",
      status: "enrolled",
      statusSource: "explicit",
      sourceSystem: "test",
      sourceTable: "enrollment",
      sourceId: "1",
    },
    {
      id: "future-enrollment",
      organizationId: "org",
      personId: "child",
      academicSessionId: "future",
      schoolId: "school",
      academicClassId: "next-class",
      status: "enrolled",
      statusSource: "explicit",
      sourceSystem: "test",
      sourceTable: "enrollment",
      sourceId: "2",
    },
  ]);
  await database.insert(personAcademicRecord).values({
    id: "legacy-record",
    academicSession: "2025",
    recordedOn: "2025-01-01",
    organizationId: "org",
    personId: "namesake",
    className: "Class 7 B",
    classSection: "B",
    isLatest: 1,
    sourceSystem: "test",
    sourceTable: "record",
    sourceId: "1",
  });
  await database.insert(childCategory).values([
    {
      id: categoryId,
      organizationId: "org",
      name: "Supported",
      sourceSystem: "test",
      sourceTable: "category",
      sourceId: "1",
    },
    {
      id: foreignCategoryId,
      organizationId: "other",
      name: "Foreign",
      sourceSystem: "test",
      sourceTable: "category",
      sourceId: "2",
    },
  ]);
});
afterEach(() => {
  sqlite.close();
  vi.clearAllMocks();
});

function patch(body: Record<string, unknown>, origin = "https://school.example") {
  return apiDispatcher.fetch(
    new Request(`https://school.example/api/school-operations/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ effectiveOn: "2026-01-01", ...body }),
    }),
  );
}

describe("People registry", () => {
  it("distinguishes namesakes by latest class, excludes future sessions, and scopes organizations", async () => {
    const result = await findPeopleRegistry(database, "org", { ...filters, q: "tashi" });
    expect(result.people.map((row) => [row.primaryIdentifier, row.latestClassName])).toEqual([
      ["A001", "VIII A"],
      ["A002", "Class 7 B"],
    ]);
    expect(result.pagination.total).toBe(2);
    const all = await findPeopleRegistry(database, "org", { ...filters, kind: "all" });
    expect(all.people.find((row) => row.kind === "staff")?.latestClassName).toBeNull();
  });
  it("filters by latest class and details, and shows placeholder classes as no class", async () => {
    const byClass = await findPeopleRegistry(database, "org", { ...filters, className: "VIII A" });
    expect(byClass.people.map((row) => row.primaryIdentifier)).toEqual(["A001"]);
    expect(byClass.filterOptions.classes).toEqual(expect.arrayContaining(["VIII A", "Class 9 B"]));
    expect(byClass.filterOptions.nationalities).toEqual(["Tibetan"]);
    const byNationality = await findPeopleRegistry(database, "org", {
      ...filters,
      nationality: "Tibetan",
    });
    expect(byNationality.pagination.total).toBe(1);
    sqlite.exec(
      "UPDATE person_academic_record SET class_name = 'NoClass', class_title = 'NoClass', class_section = 'None'",
    );
    const placeholder = await findPeopleRegistry(database, "org", { ...filters, q: "tashi" });
    expect(
      placeholder.people.find((row) => row.primaryIdentifier === "A002")?.latestClassName,
    ).toBeNull();
  });
  it("treats LIKE wildcards literally and preserves empty results and pagination totals", async () => {
    const result = await findPeopleRegistry(database, "org", { ...filters, q: "%_\\" });
    expect(result.people).toEqual([]);
    expect(result.pagination.total).toBe(0);
    const page = await findPeopleRegistry(database, "org", { ...filters, page: 2 });
    expect(page.people).toEqual([]);
    expect(page.pagination.total).toBe(2);
  });
  it("skips summary and import queries during repeat searches", async () => {
    queries = [];
    const result = await findPeopleRegistry(database, "org", { ...filters, includeSummary: false });
    expect(result.people).toHaveLength(2);
    expect(result.summary).toEqual([]);
    expect(
      queries.some(
        (query) => query.includes("group by") || query.includes('from "person_import_batch"'),
      ),
    ).toBe(false);
  });
  it("uses each sorting index without a temporary sort", () => {
    for (const filter of [
      "",
      "AND kind = 'child'",
      "AND status = 'active'",
      "AND kind = 'child' AND status = 'active'",
    ]) {
      const plan = sqlite
        .prepare(
          `EXPLAIN QUERY PLAN SELECT id FROM person WHERE organization_id = 'org' ${filter} ORDER BY lower(display_name), primary_identifier, id LIMIT 25`,
        )
        .all();
      expect(plan.map((row) => row.detail).join(" ")).not.toContain("TEMP B-TREE");
    }
  });
});

describe("Enrollment identity changes", () => {
  it("changes nationality and category, records readable history, and leaves enrollment untouched", async () => {
    const before = sqlite
      .prepare("SELECT * FROM student_enrollment WHERE id = ?")
      .get(enrollmentId);
    expect((await patch({ action: "nationality_changed", nationality: " Indian " })).status).toBe(
      200,
    );
    expect(
      (await patch({ action: "category_changed", childCategoryId: categoryId, note: "Reviewed" }))
        .status,
    ).toBe(200);
    expect(
      sqlite
        .prepare("SELECT nationality,child_category_id,status FROM person WHERE id = 'child'")
        .get(),
    ).toMatchObject({ nationality: "Indian", child_category_id: categoryId, status: "active" });
    expect(
      sqlite.prepare("SELECT * FROM student_enrollment WHERE id = ?").get(enrollmentId),
    ).toEqual(before);
    const response = await apiDispatcher.fetch(
      new Request(`https://school.example/api/school-operations/enrollments/${enrollmentId}`),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { changes: unknown[] };
    expect(payload.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeType: "nationality_changed",
          previousValue: "Tibetan",
          nextValue: "Indian",
          changedBy: "Staff member",
        }),
        expect.objectContaining({
          changeType: "category_changed",
          nextValue: "Supported",
          note: "Reviewed",
        }),
      ]),
    );
  });
  it("rejects missing values, foreign categories, cross-origin writes, future dates, and viewers", async () => {
    expect((await patch({ action: "nationality_changed" })).status).toBe(400);
    expect(
      (await patch({ action: "category_changed", childCategoryId: foreignCategoryId })).status,
    ).toBe(400);
    expect(
      (
        await patch(
          { action: "nationality_changed", nationality: "Indian" },
          "https://other.example",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await patch({
          action: "nationality_changed",
          nationality: "Indian",
          effectiveOn: "2090-01-01",
        })
      ).status,
    ).toBe(400);
    sqlite.exec("UPDATE organization_member SET role = 'viewer' WHERE id = 'member'");
    expect((await patch({ action: "nationality_changed", nationality: "Indian" })).status).toBe(
      403,
    );
    expect(sqlite.prepare("SELECT count(*) AS count FROM audit_event").get()?.count).toBe(0);
  });
  it("supports clearing values and does not record repeated saves", async () => {
    expect((await patch({ action: "nationality_changed", nationality: null })).status).toBe(200);
    expect((await patch({ action: "nationality_changed", nationality: null })).status).toBe(200);
    expect(
      sqlite.prepare("SELECT nationality FROM person WHERE id = 'child'").get()?.nationality,
    ).toBeNull();
    expect(sqlite.prepare("SELECT count(*) AS count FROM audit_event").get()?.count).toBe(1);
  });
});

describe("School overview", () => {
  it("counts student details for the selected session only, working each value out once", async () => {
    await database.insert(academicSession).values({
      id: "00000000-0000-4000-8000-000000000010",
      organizationId: "org",
      name: "Overview",
      startsOn: "2019-01-01",
      endsOn: "2019-12-31",
    });
    await database.insert(studentEnrollment).values({
      id: "overview-enrollment",
      organizationId: "org",
      personId: "child",
      academicSessionId: "00000000-0000-4000-8000-000000000010",
      schoolId: "school",
      academicClassId: "class",
      status: "enrolled",
      statusSource: "explicit",
      sourceSystem: "test",
      sourceTable: "enrollment",
      sourceId: "overview",
    });
    queries = [];
    const response = await apiDispatcher.fetch(
      new Request(
        "https://tsewa.test/api/school-operations/overview?sessionId=00000000-0000-4000-8000-000000000010",
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      filters: Record<string, Array<{ id: string; name: string; count: number }>>;
    };
    expect(payload.filters.nationalities).toEqual([{ id: "Tibetan", name: "Tibetan", count: 1 }]);
    expect(payload.filters.homes).toEqual([{ id: "none", name: "No home", count: 1 }]);
    expect(payload.filters.parentage).toEqual([{ id: "none", name: "Not recorded", count: 1 }]);
    const homes = queries.find((query) => query.includes("person_placement"));
    expect(homes?.match(/from person_placement/g)).toHaveLength(1);
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${homes}`)
      .all(...Array<string>((homes?.match(/\?/g) ?? []).length).fill("x"))
      .map((row) => String(row.detail));
    expect(plan.filter((detail) => detail.includes("SEARCH pp"))).toHaveLength(1);
    expect(plan.join("\n")).toContain("student_enrollment_session_person_idx");
  });
});
