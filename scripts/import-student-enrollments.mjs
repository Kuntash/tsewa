import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  DEFAULT_SOURCE_DATABASE,
  parseArguments,
  rawSql,
  requiredOption,
  sha256File,
  sqlLiteral,
  stablePersonId,
  stableUuid,
} from "./lib/person-files.mjs";

const SOURCE_SYSTEM = "THF Office Manager";
const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const reportPath = resolve(
  repositoryRoot,
  options.report ?? "reports/student-enrollment-dry-run.json",
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
  throw new Error("The source fingerprint no longer matches the enrollment dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const enrollments = readEnrollments(database, organizationSlug);
  const offerings = readOfferings(database, organizationSlug);
  assertCounts(enrollments, offerings, report);
  const importedAt = new Date().toISOString();
  const batchId = `student-enrollment-import-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildImportSql({
    batchId,
    enrollments,
    importedAt,
    offerings,
    organizationSlug,
    report,
  });

  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed while enrollment import was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-student-enrollment-import-"));
  const sqlPath = join(workspace, "student-enrollment-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  executeImport(sqlPath, target);
  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    enrollments: enrollments.length,
    offerings: offerings.length,
    batchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

function readEnrollments(connection, slug) {
  return connection
    .prepare(
      `WITH ranked AS (
         SELECT beneficiary_class.*,
                ROW_NUMBER() OVER (
                  PARTITION BY beneficiary_id, session_id
                  ORDER BY date(date) DESC, id DESC
                ) AS session_rank
         FROM beneficiary_class
       )
       SELECT ranked.id AS sourceRecordId,
              ranked.beneficiary_id AS beneficiarySourceId,
              ranked.session_id AS sessionSourceId,
              session.session_year AS sessionName,
              school.id AS schoolSourceId,
              class.id AS classSourceId,
              house.id AS houseSourceId,
              ranked.date AS sourceRecordedOn,
              ranked.roll_no AS rollNumber,
              ranked.board_registration_no AS boardRegistrationNumber,
              ranked.result
       FROM ranked
       JOIN session ON session.id = ranked.session_id
       JOIN class ON class.id = ranked.class_id
       LEFT JOIN school ON school.id = ranked.school_id
       LEFT JOIN school_house ON school_house.id = ranked.house_id
       LEFT JOIN house ON house.id = school_house.house_id
       WHERE ranked.session_rank = 1
       ORDER BY ranked.session_id, ranked.beneficiary_id`,
    )
    .all()
    .map((item) => {
      const beneficiarySourceId = requiredText(item.beneficiarySourceId, "beneficiary source ID");
      const sessionSourceId = requiredText(item.sessionSourceId, "session source ID");
      const schoolSourceId = optionalText(item.schoolSourceId);
      const classSourceId = requiredText(item.classSourceId, "class source ID");
      const sourceRecordId = requiredText(item.sourceRecordId, "academic source ID");
      return {
        id: stableUuid(
          `tsewa|${slug}|student_enrollment|${beneficiarySourceId}|${sessionSourceId}`,
        ),
        personId: stablePersonId(slug, "beneficiary", beneficiarySourceId),
        sessionName: requiredText(item.sessionName, "session name"),
        schoolId: schoolSourceId ? stableUuid(`tsewa|${slug}|school|${schoolSourceId}`) : null,
        classId: stableUuid(`tsewa|${slug}|class|${classSourceId}`),
        houseId: item.houseSourceId
          ? stableUuid(`tsewa|${slug}|house|${item.houseSourceId}`)
          : null,
        offeringId: schoolSourceId
          ? offeringId(slug, sessionSourceId, schoolSourceId, classSourceId)
          : null,
        sourceRecordedOn: requiredText(item.sourceRecordedOn, "source recorded date"),
        rollNumber: optionalText(item.rollNumber),
        boardRegistrationNumber: optionalText(item.boardRegistrationNumber),
        result: optionalText(item.result),
        sourceAcademicRecordId: stableUuid(`tsewa|${slug}|beneficiary_class|${sourceRecordId}`),
        sourceId: `${beneficiarySourceId}|${sessionSourceId}`,
      };
    });
}

function readOfferings(connection, slug) {
  return connection
    .prepare(
      `WITH ranked AS (
         SELECT beneficiary_class.*,
                ROW_NUMBER() OVER (
                  PARTITION BY beneficiary_id, session_id
                  ORDER BY date(date) DESC, id DESC
                ) AS session_rank
         FROM beneficiary_class
       )
       SELECT DISTINCT ranked.session_id AS sessionSourceId,
              session.session_year AS sessionName,
              school.id AS schoolSourceId,
              class.id AS classSourceId
       FROM ranked
       JOIN session ON session.id = ranked.session_id
       JOIN school ON school.id = ranked.school_id
       JOIN class ON class.id = ranked.class_id
       WHERE ranked.session_rank = 1
       ORDER BY ranked.session_id, school.id, class.id`,
    )
    .all()
    .map((item) => {
      const sessionSourceId = requiredText(item.sessionSourceId, "session source ID");
      const schoolSourceId = requiredText(item.schoolSourceId, "school source ID");
      const classSourceId = requiredText(item.classSourceId, "class source ID");
      return {
        id: offeringId(slug, sessionSourceId, schoolSourceId, classSourceId),
        sessionName: requiredText(item.sessionName, "session name"),
        schoolId: stableUuid(`tsewa|${slug}|school|${schoolSourceId}`),
        classId: stableUuid(`tsewa|${slug}|class|${classSourceId}`),
        sourceId: `${sessionSourceId}|${schoolSourceId}|${classSourceId}`,
      };
    });
}

function buildImportSql({ batchId, enrollments, importedAt, offerings, organizationSlug, report }) {
  const organizationId = `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`;
  const sessionId = (name) =>
    rawSql(
      `(SELECT id FROM academic_session WHERE organization_id = ${organizationId} AND name = ${sqlLiteral(name)})`,
    );
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO student_enrollment_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, source_row_count, enrollment_count, superseded_row_count,
      offering_count, started_at, created_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${organizationId}, ${sqlLiteral(SOURCE_SYSTEM)},
      ${sqlLiteral(report.source.database)}, ${sqlLiteral(report.source.sha256)}, 'running',
      ${Number(report.inventory.sourceRows)}, 0, ${Number(report.inventory.supersededRows)},
      0, ${sqlLiteral(importedAt)}, ${sqlLiteral(importedAt)}
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', enrollment_count = 0, offering_count = 0,
      started_at = excluded.started_at, finished_at = NULL`,
  ];

  statements.push(
    ...chunkedUpserts(offerings, 25, (items) =>
      buildUpsert({
        table: "school_class_offering",
        columns: [
          "id",
          "organization_id",
          "academic_session_id",
          "school_id",
          "academic_class_id",
          "is_active",
          "origin",
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
          sessionId(item.sessionName),
          item.schoolId,
          item.classId,
          1,
          "legacy_observed",
          SOURCE_SYSTEM,
          "beneficiary_class_observed",
          item.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]),
        conflict: "organization_id, academic_session_id, school_id, academic_class_id",
        updates:
          "is_active = 1, origin = excluded.origin, source_system = excluded.source_system, " +
          "source_table = excluded.source_table, source_id = excluded.source_id, " +
          "import_batch_id = excluded.import_batch_id, imported_at = excluded.imported_at, " +
          "updated_at = excluded.updated_at",
      }),
    ),
  );
  statements.push(
    ...chunkedUpserts(enrollments, 20, (items) =>
      buildUpsert({
        table: "student_enrollment",
        columns: [
          "id",
          "organization_id",
          "person_id",
          "academic_session_id",
          "school_id",
          "academic_class_id",
          "house_id",
          "school_class_offering_id",
          "status",
          "status_source",
          "source_recorded_on",
          "roll_number",
          "board_registration_number",
          "result",
          "source_academic_record_id",
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
          item.personId,
          sessionId(item.sessionName),
          item.schoolId,
          item.classId,
          item.houseId,
          item.offeringId,
          "recorded",
          "legacy_allocation",
          item.sourceRecordedOn,
          item.rollNumber,
          item.boardRegistrationNumber,
          item.result,
          item.sourceAcademicRecordId,
          SOURCE_SYSTEM,
          "beneficiary_class_session",
          item.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]),
        conflict: "organization_id, person_id, academic_session_id",
        updates:
          "school_id = excluded.school_id, academic_class_id = excluded.academic_class_id, " +
          "house_id = excluded.house_id, school_class_offering_id = excluded.school_class_offering_id, " +
          "status = excluded.status, status_source = excluded.status_source, " +
          "source_recorded_on = excluded.source_recorded_on, roll_number = excluded.roll_number, " +
          "board_registration_number = excluded.board_registration_number, result = excluded.result, " +
          "source_academic_record_id = excluded.source_academic_record_id, " +
          "source_system = excluded.source_system, source_table = excluded.source_table, " +
          "source_id = excluded.source_id, import_batch_id = excluded.import_batch_id, " +
          "imported_at = excluded.imported_at, updated_at = excluded.updated_at",
      }),
    ),
  );
  statements.push(`UPDATE student_enrollment_import_batch
    SET status = 'completed',
        enrollment_count = (
          SELECT COUNT(*) FROM student_enrollment
          WHERE organization_id = ${organizationId} AND import_batch_id = ${sqlLiteral(batchId)}
        ),
        offering_count = (
          SELECT COUNT(*) FROM school_class_offering
          WHERE organization_id = ${organizationId} AND import_batch_id = ${sqlLiteral(batchId)}
        ),
        finished_at = ${sqlLiteral(importedAt)}
    WHERE id = ${sqlLiteral(batchId)}`);
  return `${statements.join(";\n\n")};\n`;
}

function offeringId(slug, sessionSourceId, schoolSourceId, classSourceId) {
  return stableUuid(
    `tsewa|${slug}|school_class_offering|${sessionSourceId}|${schoolSourceId}|${classSourceId}`,
  );
}

function assertCounts(enrollments, offerings, report) {
  if (enrollments.length !== Number(report.inventory.selectedEnrollments)) {
    throw new Error("Generated enrollment count does not match the reviewed dry run.");
  }
  if (offerings.length !== Number(report.inventory.observedOfferings)) {
    throw new Error("Generated offering count does not match the reviewed dry run.");
  }
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
    .map((items) => `(${items.map((item) => sqlLiteral(item)).join(", ")})`)
    .join(",\n      ");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n      ${values}\n    ON CONFLICT(${conflict}) DO UPDATE SET ${updates}`;
}

function executeImport(sqlPath, importTarget) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${importTarget}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    const diagnostic = `${result.stdout}\n${result.stderr}`
      .split("\n")
      .filter((line) => /error|failed|constraint|too many|no such/i.test(line))
      .map((line) => line.replaceAll(/'[^']*'/g, "'[redacted]'").trim())
      .filter(Boolean)
      .slice(-5)
      .join(" | ");
    throw new Error(
      `Wrangler did not complete the ${importTarget} enrollment import (exit ${result.status ?? "unknown"}). ${diagnostic || "Output was suppressed because it may contain personal data."}`,
    );
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
    report?.mode !== "student_enrollment_dry_run" ||
    report?.privacy?.containsPersonalData !== false ||
    Number(report?.inventory?.sourceRows ?? 0) !== 25_427 ||
    Number(report?.inventory?.selectedEnrollments ?? 0) !== 23_384 ||
    Number(report?.completeness?.missingPeople ?? -1) !== 0 ||
    Number(report?.completeness?.missingSessions ?? -1) !== 0 ||
    Number(report?.completeness?.missingClasses ?? -1) !== 0 ||
    Number(report?.completeness?.missingSchools ?? -1) !== 0 ||
    Number(report?.completeness?.missingSchoolHouses ?? -1) !== 0
  ) {
    throw new Error("The reviewed enrollment dry-run report has not cleared import gates.");
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
