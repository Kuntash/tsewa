import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  DEFAULT_SOURCE_DATABASE,
  parseArguments,
  requiredOption,
  sha256File,
  sqlLiteral,
  stableUuid,
} from "./lib/person-files.mjs";

const SOURCE_SYSTEM = "THF Office Manager";
const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const reportPath = resolve(
  repositoryRoot,
  options.report ?? "reports/school-operations-dry-run.json",
);
const target = requiredOption(options, "target");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");

if (target !== "local" && target !== "remote") {
  throw new Error("--target must be either local or remote.");
}

await assertTargetBinding(confirmedDatabaseId, target);
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertDryRunReport(report);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
if (sourceFingerprint !== report.source.sha256) {
  throw new Error("The source fingerprint no longer matches the School Operations dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const catalog = readCatalog(database, organizationSlug);
  assertCatalogCounts(catalog, report);
  const importedAt = new Date().toISOString();
  const batchId = `school-operations-import-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildImportSql({
    batchId,
    catalog,
    importedAt,
    organizationSlug,
    sourceFingerprint,
  });

  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed while School Operations was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-school-operations-import-"));
  const sqlPath = join(workspace, "school-operations-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  executeImport(sqlPath, target);
  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    sessions: catalog.sessions.length,
    schools: catalog.schools.length,
    classes: catalog.classes.length,
    houses: catalog.houses.length,
    schoolHouses: catalog.schoolHouses.length,
    batchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

function readCatalog(databaseConnection, slug) {
  const sessions = databaseConnection
    .prepare(
      `SELECT id AS sourceId, session_year AS name,
              date(year_from) AS startsOn, date(year_to) AS endsOn
       FROM session ORDER BY date(year_from), id`,
    )
    .all()
    .map((item) => ({
      id: stableUuid(`tsewa|${slug}|session|${item.sourceId}`),
      sourceId: requiredText(item.sourceId, "session source ID"),
      name: requiredText(item.name, "session name"),
      startsOn: requiredText(item.startsOn, "session start"),
      endsOn: requiredText(item.endsOn, "session end"),
    }));
  const schools = databaseConnection
    .prepare(
      `SELECT school.id AS sourceId, school.name, location.name AS locationName,
              school.school_affiliation_no AS affiliationNumber, school.active AS isActive
       FROM school LEFT JOIN location ON location.id = school.location_id
       ORDER BY school.id`,
    )
    .all()
    .map((item) => ({
      id: stableUuid(`tsewa|${slug}|school|${item.sourceId}`),
      sourceId: requiredText(item.sourceId, "school source ID"),
      name: requiredText(item.name, "school name"),
      locationName: optionalText(item.locationName),
      affiliationNumber: optionalText(item.affiliationNumber),
      isActive: Number(item.isActive) === 1 ? 1 : 0,
    }));
  const classes = databaseConnection
    .prepare(
      `SELECT id AS sourceId, name, level, section, title,
              class_sort AS sortOrder, active AS isActive
       FROM class ORDER BY id`,
    )
    .all()
    .map((item) => ({
      id: stableUuid(`tsewa|${slug}|class|${item.sourceId}`),
      sourceId: requiredText(item.sourceId, "class source ID"),
      name: requiredText(item.name, "class name"),
      level: optionalInteger(item.level),
      section: optionalText(item.section),
      title: optionalText(item.title),
      sortOrder: optionalInteger(item.sortOrder),
      isActive: Number(item.isActive) === 1 ? 1 : 0,
    }));
  const houses = databaseConnection
    .prepare("SELECT id AS sourceId, name FROM house ORDER BY id")
    .all()
    .map((item) => ({
      id: stableUuid(`tsewa|${slug}|house|${item.sourceId}`),
      sourceId: requiredText(item.sourceId, "house source ID"),
      name: requiredText(item.name, "house name"),
    }));
  const schoolHouses = databaseConnection
    .prepare(
      `SELECT id AS sourceId, school_id AS schoolSourceId, house_id AS houseSourceId
       FROM school_house ORDER BY id`,
    )
    .all()
    .map((item) => ({
      id: stableUuid(`tsewa|${slug}|school_house|${item.sourceId}`),
      sourceId: requiredText(item.sourceId, "school-house source ID"),
      schoolId: stableUuid(`tsewa|${slug}|school|${item.schoolSourceId}`),
      houseId: stableUuid(`tsewa|${slug}|house|${item.houseSourceId}`),
    }));
  return { sessions, schools, classes, houses, schoolHouses };
}

function assertCatalogCounts(catalog, report) {
  const expected = report.inventory.masterCounts;
  const counts = {
    sessions: catalog.sessions.length,
    schools: catalog.schools.length,
    classes: catalog.classes.length,
    houses: catalog.houses.length,
    schoolHouseLinks: catalog.schoolHouses.length,
  };
  for (const [key, count] of Object.entries(counts)) {
    if (count !== Number(expected[key])) {
      throw new Error(`Generated ${key} count ${count} does not match the reviewed dry run.`);
    }
  }
}

function buildImportSql({ batchId, catalog, importedAt, organizationSlug, sourceFingerprint }) {
  const organizationId = `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`;
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO school_operations_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, session_count, school_count, class_count, house_count,
      school_house_count, started_at, created_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${organizationId}, ${sqlLiteral(SOURCE_SYSTEM)},
      'tibethomes-newer-d1.sqlite', ${sqlLiteral(sourceFingerprint)}, 'running',
      ${catalog.sessions.length}, ${catalog.schools.length}, ${catalog.classes.length},
      ${catalog.houses.length}, ${catalog.schoolHouses.length},
      ${sqlLiteral(importedAt)}, ${sqlLiteral(importedAt)}
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', session_count = excluded.session_count,
      school_count = excluded.school_count, class_count = excluded.class_count,
      house_count = excluded.house_count, school_house_count = excluded.school_house_count,
      started_at = excluded.started_at, finished_at = NULL`,
  ];

  const latestSession = catalog.sessions.at(-1);
  statements.push(`UPDATE academic_session SET
      name = ${sqlLiteral(latestSession.name)}, starts_on = ${sqlLiteral(latestSession.startsOn)},
      ends_on = ${sqlLiteral(latestSession.endsOn)}, is_active = 1,
      source_system = ${sqlLiteral(SOURCE_SYSTEM)}, source_table = 'session',
      source_id = ${sqlLiteral(latestSession.sourceId)}, updated_at = ${sqlLiteral(importedAt)}
    WHERE organization_id = ${organizationId} AND name = '2026–27'
      AND source_system IS NULL`);

  statements.push(
    buildUpsert({
      table: "academic_session",
      columns: [
        "id",
        "organization_id",
        "name",
        "starts_on",
        "ends_on",
        "is_active",
        "source_system",
        "source_table",
        "source_id",
        "created_at",
        "updated_at",
      ],
      rows: catalog.sessions.map((item) => [
        item.id,
        rawSql(organizationId),
        item.name,
        item.startsOn,
        item.endsOn,
        1,
        SOURCE_SYSTEM,
        "session",
        item.sourceId,
        importedAt,
        importedAt,
      ]),
      conflict: "organization_id, name",
      updates:
        "starts_on = excluded.starts_on, ends_on = excluded.ends_on, is_active = 1, " +
        "source_system = excluded.source_system, source_table = excluded.source_table, " +
        "source_id = excluded.source_id, updated_at = excluded.updated_at",
    }),
  );
  statements.push(
    ...chunkedUpserts(catalog.schools, 50, (items) =>
      buildUpsert({
        table: "school_master",
        columns: [
          "id",
          "organization_id",
          "name",
          "location_name",
          "affiliation_number",
          "is_active",
          "source_system",
          "source_table",
          "source_id",
          "import_batch_id",
          "imported_at",
          "created_at",
          "updated_at",
        ],
        rows: items.map((item) => [
          item.id,
          rawSql(organizationId),
          item.name,
          item.locationName,
          item.affiliationNumber,
          item.isActive,
          SOURCE_SYSTEM,
          "school",
          item.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]),
        conflict: "organization_id, source_system, source_table, source_id",
        updates:
          "name = excluded.name, location_name = excluded.location_name, " +
          "affiliation_number = excluded.affiliation_number, is_active = excluded.is_active, " +
          "import_batch_id = excluded.import_batch_id, imported_at = excluded.imported_at, " +
          "updated_at = excluded.updated_at",
      }),
    ),
  );
  statements.push(
    ...chunkedUpserts(catalog.classes, 50, (items) =>
      buildUpsert({
        table: "academic_class_master",
        columns: [
          "id",
          "organization_id",
          "name",
          "level",
          "section",
          "title",
          "sort_order",
          "is_active",
          "source_system",
          "source_table",
          "source_id",
          "import_batch_id",
          "imported_at",
          "created_at",
          "updated_at",
        ],
        rows: items.map((item) => [
          item.id,
          rawSql(organizationId),
          item.name,
          item.level,
          item.section,
          item.title,
          item.sortOrder,
          item.isActive,
          SOURCE_SYSTEM,
          "class",
          item.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]),
        conflict: "organization_id, source_system, source_table, source_id",
        updates:
          "name = excluded.name, level = excluded.level, section = excluded.section, " +
          "title = excluded.title, sort_order = excluded.sort_order, " +
          "is_active = excluded.is_active, import_batch_id = excluded.import_batch_id, " +
          "imported_at = excluded.imported_at, updated_at = excluded.updated_at",
      }),
    ),
  );
  statements.push(
    buildUpsert({
      table: "house_master",
      columns: [
        "id",
        "organization_id",
        "name",
        "source_system",
        "source_table",
        "source_id",
        "import_batch_id",
        "imported_at",
        "created_at",
        "updated_at",
      ],
      rows: catalog.houses.map((item) => [
        item.id,
        rawSql(organizationId),
        item.name,
        SOURCE_SYSTEM,
        "house",
        item.sourceId,
        batchId,
        importedAt,
        importedAt,
        importedAt,
      ]),
      conflict: "organization_id, source_system, source_table, source_id",
      updates:
        "name = excluded.name, import_batch_id = excluded.import_batch_id, " +
        "imported_at = excluded.imported_at, updated_at = excluded.updated_at",
    }),
  );
  statements.push(
    buildUpsert({
      table: "school_house_master",
      columns: [
        "id",
        "organization_id",
        "school_id",
        "house_id",
        "source_system",
        "source_table",
        "source_id",
        "import_batch_id",
        "imported_at",
        "created_at",
        "updated_at",
      ],
      rows: catalog.schoolHouses.map((item) => [
        item.id,
        rawSql(organizationId),
        item.schoolId,
        item.houseId,
        SOURCE_SYSTEM,
        "school_house",
        item.sourceId,
        batchId,
        importedAt,
        importedAt,
        importedAt,
      ]),
      conflict: "organization_id, source_system, source_table, source_id",
      updates:
        "school_id = excluded.school_id, house_id = excluded.house_id, " +
        "import_batch_id = excluded.import_batch_id, imported_at = excluded.imported_at, " +
        "updated_at = excluded.updated_at",
    }),
  );
  statements.push(`UPDATE school_operations_import_batch
    SET status = 'completed', finished_at = ${sqlLiteral(importedAt)}
    WHERE id = ${sqlLiteral(batchId)}`);
  return `${statements.join(";\n\n")};\n`;
}

function chunkedUpserts(items, size, createStatement) {
  const statements = [];
  for (let index = 0; index < items.length; index += size) {
    statements.push(createStatement(items.slice(index, index + size)));
  }
  return statements;
}

function buildUpsert({ table, columns, rows, conflict, updates }) {
  const values = rows
    .map((items) => `(${items.map((item) => sqlValue(item)).join(", ")})`)
    .join(",\n      ");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n      ${values}\n    ON CONFLICT(${conflict}) DO UPDATE SET ${updates}`;
}

function rawSql(sql) {
  return { sql };
}

function sqlValue(value) {
  return value && typeof value === "object" && "sql" in value ? value.sql : sqlLiteral(value);
}

function executeImport(sqlPath, importTarget) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${importTarget}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error("Wrangler did not complete the School Operations import.");
  }
}

async function assertTargetBinding(databaseId, importTarget) {
  const configuration = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!configuration.includes(databaseId)) {
    throw new Error("The confirmed D1 target is not present in apps/web/wrangler.jsonc.");
  }
  if (importTarget === "local") return;
  const result = spawnSync("pnpm", ["exec", "wrangler", "d1", "info", "DB"], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || !result.stdout.includes(databaseId)) {
    throw new Error("The live DB binding does not match --confirm-database-id.");
  }
}

function assertDryRunReport(report) {
  if (
    report?.mode !== "dry_run" ||
    report?.privacy?.containsPersonalData !== false ||
    Number(report?.inventory?.academicRows ?? 0) !== 25_427 ||
    Number(report?.reconciliation?.missingPeople ?? -1) !== 0 ||
    Number(report?.reconciliation?.missingClasses ?? -1) !== 0 ||
    Number(report?.reconciliation?.missingSessions ?? -1) !== 0 ||
    Number(report?.reconciliation?.missingSchoolHouses ?? -1) !== 0
  ) {
    throw new Error("The reviewed School Operations dry-run report has not cleared import gates.");
  }
}

function requiredText(value, label) {
  const result = optionalText(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

function optionalInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  if (!Number.isInteger(result)) throw new Error(`Expected an integer, received ${value}.`);
  return result;
}
