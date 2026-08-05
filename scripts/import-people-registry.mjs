import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
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
  options.report ?? "reports/people-registry-dry-run.json",
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
  throw new Error("The source fingerprint no longer matches the reviewed dry-run report.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const people = readPeople(database, organizationSlug);
  const expectedCount = Number(report.reconciliation.eligibleCount);
  if (people.length !== expectedCount) {
    throw new Error(
      `Import generation produced ${people.length} rows; the reviewed dry run expected ${expectedCount}.`,
    );
  }

  const importedAt = new Date().toISOString();
  const fingerprintPrefix = sourceFingerprint.slice(0, 16);
  const importBatchId = `import-${fingerprintPrefix}-v1`;
  const dryRunBatchId = `dryrun-${fingerprintPrefix}`;
  const sql = buildImportSql({
    people,
    report,
    organizationSlug,
    importBatchId,
    dryRunBatchId,
    importedAt,
  });

  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed while the read-only import was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-people-import-"));
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  const sqlPath = join(workspace, "people-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });

  executeImport(sqlPath, target);
  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    sourceCount: report.reconciliation.sourceCount,
    importedCount: people.length,
    importBatchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

function readPeople(databaseConnection, slug) {
  const beneficiaries = databaseConnection
    .prepare(
      `SELECT beneficiary.id AS sourceId, beneficiary.type, beneficiary.status,
              beneficiary.admission_no AS primaryIdentifier,
              beneficiary.name AS displayName, beneficiary.gender,
              beneficiary.dob AS dateOfBirth,
              beneficiary.admin_dt AS admittedOrJoinedOn,
              beneficiary.campus AS campusOrLocation,
              nationality.country AS nationality,
              beneficiary.photo_asset_id AS photoAssetKey
       FROM beneficiary
       JOIN nationality ON nationality.id = beneficiary.nationality
       ORDER BY beneficiary.id`,
    )
    .all()
    .map((row) => ({
      id: stablePersonId(slug, "beneficiary", row.sourceId),
      kind: row.type === 0 ? "child" : "elderly",
      status: row.status === 1 ? "active" : "inactive",
      identifierKind: "admission",
      primaryIdentifier: requiredText(row.primaryIdentifier, "beneficiary identifier"),
      displayName: requiredText(row.displayName, "beneficiary display name"),
      gender: mapGender(row.gender),
      dateOfBirth: sourceText(row.dateOfBirth),
      admittedOrJoinedOn: sourceText(row.admittedOrJoinedOn),
      campusOrLocation: optionalText(row.campusOrLocation),
      nationality: optionalText(row.nationality),
      photoAssetKey: optionalText(row.photoAssetKey),
      sourceTable: "beneficiary",
      sourceId: requiredText(row.sourceId, "beneficiary source ID"),
    }));

  const staff = databaseConnection
    .prepare(
      `SELECT id AS sourceId, registration_no AS primaryIdentifier,
              first_name AS firstName, last_name AS lastName, status, sex,
              dob AS dateOfBirth, date_of_joining AS admittedOrJoinedOn,
              place_allocated AS campusOrLocation, country AS nationality,
              photo_asset_id AS photoAssetKey
       FROM staff
       ORDER BY id`,
    )
    .all()
    .map((row) => ({
      id: stablePersonId(slug, "staff", row.sourceId),
      kind: "staff",
      status: row.status === 1 ? "active" : "inactive",
      identifierKind: "staff",
      primaryIdentifier: requiredText(row.primaryIdentifier, "staff identifier"),
      displayName: [optionalText(row.firstName), optionalText(row.lastName)]
        .filter(Boolean)
        .join(" "),
      gender: mapGender(row.sex),
      dateOfBirth: sourceText(row.dateOfBirth),
      admittedOrJoinedOn: sourceText(row.admittedOrJoinedOn),
      campusOrLocation: optionalText(row.campusOrLocation),
      nationality: optionalText(row.nationality),
      photoAssetKey: optionalText(row.photoAssetKey),
      sourceTable: "staff",
      sourceId: requiredText(row.sourceId, "staff source ID"),
    }));

  for (const person of [...beneficiaries, ...staff]) {
    if (!person.displayName) throw new Error("A generated person has no display name.");
  }
  return [...beneficiaries, ...staff];
}

function buildImportSql({
  people,
  report,
  organizationSlug,
  importBatchId,
  dryRunBatchId,
  importedAt,
}) {
  const organizationId = `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`;
  const statements = [
    `INSERT INTO person_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      mode, status, source_count, eligible_count, imported_count, skipped_count,
      issue_count, started_at, created_at
    ) VALUES (
      ${sqlLiteral(importBatchId)}, ${organizationId}, 'THF Office Manager',
      ${sqlLiteral(report.source.database)}, ${sqlLiteral(report.source.sha256)},
      'import', 'running', ${Number(report.reconciliation.sourceCount)},
      ${Number(report.reconciliation.eligibleCount)}, 0, 0,
      ${Number(report.reconciliation.issueCount)}, ${sqlLiteral(importedAt)},
      ${sqlLiteral(importedAt)}
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', source_count = excluded.source_count,
      eligible_count = excluded.eligible_count, imported_count = 0,
      skipped_count = 0, issue_count = excluded.issue_count,
      started_at = excluded.started_at, finished_at = NULL`,
  ];

  for (let index = 0; index < people.length; index += 100) {
    const values = people
      .slice(index, index + 100)
      .map((person) =>
        [
          person.id,
          rawSql(organizationId),
          person.kind,
          person.status,
          person.identifierKind,
          person.primaryIdentifier,
          person.displayName,
          person.gender,
          person.dateOfBirth,
          person.admittedOrJoinedOn,
          person.campusOrLocation,
          person.nationality,
          person.photoAssetKey,
          "THF Office Manager",
          person.sourceTable,
          person.sourceId,
          importBatchId,
          importedAt,
          importedAt,
          importedAt,
        ]
          .map(sqlLiteral)
          .join(", "),
      );
    statements.push(`INSERT INTO person (
      id, organization_id, kind, status, identifier_kind, primary_identifier,
      display_name, gender, date_of_birth, admitted_or_joined_on,
      campus_or_location, nationality, photo_asset_key, source_system,
      source_table, source_id, import_batch_id, imported_at, created_at, updated_at
    ) VALUES\n      (${values.join("),\n      (")})
    ON CONFLICT(organization_id, source_system, source_table, source_id)
    DO UPDATE SET
      kind = excluded.kind, status = excluded.status,
      identifier_kind = excluded.identifier_kind,
      primary_identifier = excluded.primary_identifier,
      display_name = excluded.display_name, gender = excluded.gender,
      date_of_birth = excluded.date_of_birth,
      admitted_or_joined_on = excluded.admitted_or_joined_on,
      campus_or_location = excluded.campus_or_location,
      nationality = excluded.nationality,
      photo_asset_key = excluded.photo_asset_key,
      import_batch_id = excluded.import_batch_id,
      imported_at = excluded.imported_at,
      updated_at = excluded.updated_at`);
  }

  statements.push(
    `INSERT INTO person_import_issue_summary (
      import_batch_id, source_table, issue_code, severity, record_count
    ) SELECT ${sqlLiteral(importBatchId)}, source_table, issue_code, severity, record_count
      FROM person_import_issue_summary
      WHERE import_batch_id = ${sqlLiteral(dryRunBatchId)}
    ON CONFLICT(import_batch_id, source_table, issue_code) DO UPDATE SET
      severity = excluded.severity, record_count = excluded.record_count`,
    `UPDATE person_import_batch
      SET status = 'completed',
          imported_count = (
            SELECT COUNT(*) FROM person
            WHERE organization_id = ${organizationId}
              AND import_batch_id = ${sqlLiteral(importBatchId)}
          ),
          skipped_count = 0,
          finished_at = ${sqlLiteral(importedAt)}
      WHERE id = ${sqlLiteral(importBatchId)}`,
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
      `Wrangler did not complete the ${target} people import (exit ${result.status ?? "unknown"}). Output was suppressed because it may contain personal data.`,
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
    report?.reconciliation?.sourceCountMatches !== true ||
    report?.reconciliation?.blockedCount !== 0 ||
    report?.reconciliation?.errorCount !== 0
  ) {
    throw new Error("The reviewed dry-run report has not cleared the import gates.");
  }
}

function stablePersonId(organizationSlug, sourceTable, sourceId) {
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

function mapGender(value) {
  if (value === 1) return "male";
  if (value === 2) return "female";
  return "unknown";
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

function sourceText(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function rawSql(value) {
  return { sql: value };
}

function sqlLiteral(value) {
  if (value && typeof value === "object" && "sql" in value) return value.sql;
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot serialize a non-finite number.");
    return String(value);
  }
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
