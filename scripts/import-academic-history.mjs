import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(
  repositoryRoot,
  options.source ?? "../data-migration/d1/tibethomes-newer-d1.sqlite",
);
const reportPath = resolve(
  repositoryRoot,
  options.report ?? "reports/academic-history-dry-run.json",
);
const target = requiredOption(options, "target");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");

if (target !== "local" && target !== "remote") {
  throw new Error("--target must be either local or remote.");
}

await assertTargetBinding(confirmedDatabaseId);
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertDryRunReport(report);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256(sourcePath);
if (sourceFingerprint !== report.source.sha256) {
  throw new Error("The source fingerprint no longer matches the academic dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const records = readAcademicRecords(database, organizationSlug);
  const expectedCount = Number(report.reconciliation.eligibleRows);
  const latestCount = records.filter((record) => record.isLatest).length;
  if (records.length !== expectedCount) {
    throw new Error(
      `Academic generation produced ${records.length} rows; expected ${expectedCount}.`,
    );
  }
  if (latestCount !== Number(report.reconciliation.latestAcademicRecordCount)) {
    throw new Error("Generated latest-record count does not match the reviewed dry run.");
  }

  const importedAt = new Date().toISOString();
  const batchId = `academic-import-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildImportSql({
    records,
    report,
    organizationSlug,
    batchId,
    importedAt,
  });

  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed while academic import was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-academic-import-"));
  const sqlPath = join(workspace, "academic-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  executeImport(sqlPath, target);
  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    sourceRows: records.length,
    importedRows: records.length,
    latestAcademicRecordCount: latestCount,
    batchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

function readAcademicRecords(databaseConnection, slug) {
  return databaseConnection
    .prepare(
      `WITH ranked AS (
         SELECT beneficiary_class.*,
                ROW_NUMBER() OVER (
                  PARTITION BY beneficiary_id ORDER BY date(date) DESC, id DESC
                ) AS record_rank
         FROM beneficiary_class
       )
       SELECT ranked.id AS sourceId, ranked.beneficiary_id AS beneficiarySourceId,
              class.name AS className, class.level AS classLevel,
              class.section AS classSection, class.title AS classTitle,
              school.name AS schoolName, house.name AS houseName,
              session.session_year AS academicSession, ranked.date AS recordedOn,
              ranked.result, ranked.roll_no AS rollNumber,
              ranked.board_registration_no AS boardRegistrationNumber,
              ranked.description, ranked.record_rank AS recordRank
       FROM ranked
       JOIN class ON class.id = ranked.class_id
       JOIN session ON session.id = ranked.session_id
       LEFT JOIN school ON school.id = ranked.school_id
       LEFT JOIN school_house ON school_house.id = ranked.house_id
       LEFT JOIN house ON house.id = school_house.house_id
       ORDER BY ranked.id`,
    )
    .all()
    .map((row) => ({
      id: stableId(slug, "beneficiary_class", row.sourceId),
      personId: stableId(slug, "beneficiary", row.beneficiarySourceId),
      className: requiredText(row.className, "class name"),
      classLevel: optionalInteger(row.classLevel),
      classSection: optionalText(row.classSection),
      classTitle: optionalText(row.classTitle),
      schoolName: optionalText(row.schoolName),
      houseName: optionalText(row.houseName),
      academicSession: requiredText(row.academicSession, "academic session"),
      recordedOn: sourceText(row.recordedOn, "academic date"),
      result: optionalText(row.result),
      rollNumber: optionalText(row.rollNumber),
      boardRegistrationNumber: optionalText(row.boardRegistrationNumber),
      description: optionalText(row.description),
      isLatest: Number(row.recordRank) === 1,
      sourceId: requiredText(row.sourceId, "academic source ID"),
    }));
}

function buildImportSql({ records, report, organizationSlug, batchId, importedAt }) {
  const organizationId = `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`;
  const statements = [
    `INSERT INTO person_academic_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, source_count, imported_count, skipped_count,
      latest_record_count, started_at, created_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${organizationId}, 'THF Office Manager',
      ${sqlLiteral(report.source.database)}, ${sqlLiteral(report.source.sha256)},
      'running', ${Number(report.reconciliation.sourceRows)}, 0, 0,
      ${Number(report.reconciliation.latestAcademicRecordCount)},
      ${sqlLiteral(importedAt)}, ${sqlLiteral(importedAt)}
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', source_count = excluded.source_count,
      imported_count = 0, skipped_count = 0,
      latest_record_count = excluded.latest_record_count,
      started_at = excluded.started_at, finished_at = NULL`,
    `UPDATE person_academic_record SET is_latest = 0, updated_at = ${sqlLiteral(importedAt)}
     WHERE organization_id = ${organizationId}
       AND source_system = 'THF Office Manager'
       AND source_table = 'beneficiary_class'`,
  ];

  for (let index = 0; index < records.length; index += 25) {
    const values = records
      .slice(index, index + 25)
      .map((record) =>
        [
          record.id,
          rawSql(organizationId),
          record.personId,
          record.className,
          record.classLevel,
          record.classSection,
          record.classTitle,
          record.schoolName,
          record.houseName,
          record.academicSession,
          record.recordedOn,
          record.result,
          record.rollNumber,
          record.boardRegistrationNumber,
          record.description,
          record.isLatest ? 1 : 0,
          "THF Office Manager",
          "beneficiary_class",
          record.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]
          .map(sqlLiteral)
          .join(", "),
      );
    statements.push(`INSERT INTO person_academic_record (
      id, organization_id, person_id, class_name, class_level, class_section,
      class_title, school_name, house_name, academic_session, recorded_on,
      result, roll_number, board_registration_number, description, is_latest,
      source_system, source_table, source_id, import_batch_id, imported_at,
      created_at, updated_at
    ) VALUES\n      (${values.join("),\n      (")})
    ON CONFLICT(organization_id, source_system, source_table, source_id)
    DO UPDATE SET
      person_id = excluded.person_id, class_name = excluded.class_name,
      class_level = excluded.class_level, class_section = excluded.class_section,
      class_title = excluded.class_title, school_name = excluded.school_name,
      house_name = excluded.house_name, academic_session = excluded.academic_session,
      recorded_on = excluded.recorded_on, result = excluded.result,
      roll_number = excluded.roll_number,
      board_registration_number = excluded.board_registration_number,
      description = excluded.description, is_latest = excluded.is_latest,
      import_batch_id = excluded.import_batch_id,
      imported_at = excluded.imported_at, updated_at = excluded.updated_at`);
  }

  statements.push(
    `UPDATE person_academic_import_batch
     SET status = 'completed',
         imported_count = (
           SELECT COUNT(*) FROM person_academic_record
           WHERE organization_id = ${organizationId}
             AND import_batch_id = ${sqlLiteral(batchId)}
         ),
         latest_record_count = (
           SELECT COUNT(*) FROM person_academic_record
           WHERE organization_id = ${organizationId} AND is_latest = 1
         ),
         skipped_count = 0,
         finished_at = ${sqlLiteral(importedAt)}
     WHERE id = ${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function executeImport(sqlPath, target) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(
      `Wrangler did not complete the ${target} academic import (exit ${result.status ?? "unknown"}). Output was suppressed because it may contain personal data.`,
    );
  }
}

async function assertTargetBinding(databaseId) {
  const configuration = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!configuration.includes(databaseId)) {
    throw new Error("The confirmed database ID is not present in apps/web/wrangler.jsonc.");
  }
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
    report?.reconciliation?.blockedRows !== 0 ||
    report?.reconciliation?.sourceRows !== report?.reconciliation?.eligibleRows
  ) {
    throw new Error("The academic dry-run report has not cleared the import gates.");
  }
}

function stableId(organizationSlug, sourceTable, sourceId) {
  const hex = createHash("sha256")
    .update(`tsewa|${organizationSlug}|${sourceTable}|${sourceId}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
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
  if (!Number.isInteger(result)) throw new Error("Invalid class level.");
  return result;
}

function sourceText(value, label) {
  if (value === null || value === undefined || value === "") throw new Error(`Missing ${label}.`);
  return String(value);
}

function rawSql(value) {
  return { sql: value };
}

function sqlLiteral(value) {
  if (value && typeof value === "object" && "sql" in value) return value.sql;
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  const string = String(value);
  if (string.includes("\0")) throw new Error("Cannot serialize a string containing a null byte.");
  return `'${string.replaceAll("'", "''")}'`;
}

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name?.startsWith("--") || !value) throw new Error(`Invalid argument near ${name}.`);
    parsed[name.slice(2)] = value;
  }
  return parsed;
}

function requiredOption(optionsObject, name) {
  const value = optionsObject[name];
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

function sha256(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", rejectHash);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}
