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
  options.report ?? "reports/placement-history-dry-run.json",
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
  throw new Error("The source fingerprint no longer matches the placement dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const placements = readPlacements(database, organizationSlug);
  const expectedCount = Number(report.reconciliation.eligibleRows);
  const currentCount = placements.filter((placement) => placement.isCurrent).length;
  if (placements.length !== expectedCount) {
    throw new Error(
      `Placement generation produced ${placements.length} rows; expected ${expectedCount}.`,
    );
  }
  if (currentCount !== Number(report.reconciliation.currentPlacementCount)) {
    throw new Error("Generated current-placement count does not match the reviewed dry run.");
  }

  const importedAt = new Date().toISOString();
  const batchId = `placement-import-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildImportSql({
    placements,
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
    throw new Error("The legacy source changed while placement import was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-placement-import-"));
  const sqlPath = join(workspace, "placement-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  executeImport(sqlPath, target);
  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    sourceRows: placements.length,
    importedRows: placements.length,
    currentPlacementCount: currentCount,
    batchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

function readPlacements(databaseConnection, slug) {
  return databaseConnection
    .prepare(
      `WITH ranked AS (
         SELECT beneficeary_home.*,
                ROW_NUMBER() OVER (
                  PARTITION BY beneficiary_id ORDER BY date(date) DESC, id DESC
                ) AS placement_rank
         FROM beneficeary_home
       )
       SELECT ranked.id AS sourceId, ranked.beneficiary_id AS beneficiarySourceId,
              home.name AS homeName, location.name AS locationName,
              type.name AS placementType, ranked.date AS startedOn,
              ranked.reason, ranked.remarks, ranked.placement_rank AS placementRank
       FROM ranked
       JOIN home ON home.id = ranked.home_id
       JOIN type ON type.id = home.type_id
       LEFT JOIN location ON location.id = home.location_id
       ORDER BY ranked.id`,
    )
    .all()
    .map((row) => ({
      id: stableId(slug, "beneficeary_home", row.sourceId),
      personId: stableId(slug, "beneficiary", row.beneficiarySourceId),
      homeName: requiredText(row.homeName, "home name"),
      locationName: optionalText(row.locationName),
      placementType: optionalText(row.placementType),
      startedOn: sourceText(row.startedOn, "placement date"),
      reason: optionalText(row.reason),
      remarks: optionalText(row.remarks),
      isCurrent: Number(row.placementRank) === 1,
      sourceId: requiredText(row.sourceId, "placement source ID"),
    }));
}

function buildImportSql({ placements, report, organizationSlug, batchId, importedAt }) {
  const organizationId = `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`;
  const statements = [
    `INSERT INTO person_placement_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, source_count, imported_count, skipped_count,
      current_placement_count, started_at, created_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${organizationId}, 'THF Office Manager',
      ${sqlLiteral(report.source.database)}, ${sqlLiteral(report.source.sha256)},
      'running', ${Number(report.reconciliation.sourceRows)}, 0, 0,
      ${Number(report.reconciliation.currentPlacementCount)},
      ${sqlLiteral(importedAt)}, ${sqlLiteral(importedAt)}
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', source_count = excluded.source_count,
      imported_count = 0, skipped_count = 0,
      current_placement_count = excluded.current_placement_count,
      started_at = excluded.started_at, finished_at = NULL`,
    `UPDATE person_placement SET is_current = 0, updated_at = ${sqlLiteral(importedAt)}
     WHERE organization_id = ${organizationId}
       AND source_system = 'THF Office Manager'
       AND source_table = 'beneficeary_home'`,
  ];

  for (let index = 0; index < placements.length; index += 25) {
    const values = placements
      .slice(index, index + 25)
      .map((placement) =>
        [
          placement.id,
          rawSql(organizationId),
          placement.personId,
          placement.homeName,
          placement.locationName,
          placement.placementType,
          placement.startedOn,
          placement.reason,
          placement.remarks,
          placement.isCurrent ? 1 : 0,
          "THF Office Manager",
          "beneficeary_home",
          placement.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]
          .map(sqlLiteral)
          .join(", "),
      );
    statements.push(`INSERT INTO person_placement (
      id, organization_id, person_id, home_name, location_name, placement_type,
      started_on, reason, remarks, is_current, source_system, source_table,
      source_id, import_batch_id, imported_at, created_at, updated_at
    ) VALUES\n      (${values.join("),\n      (")})
    ON CONFLICT(organization_id, source_system, source_table, source_id)
    DO UPDATE SET
      person_id = excluded.person_id, home_name = excluded.home_name,
      location_name = excluded.location_name,
      placement_type = excluded.placement_type,
      started_on = excluded.started_on, reason = excluded.reason,
      remarks = excluded.remarks, is_current = excluded.is_current,
      import_batch_id = excluded.import_batch_id,
      imported_at = excluded.imported_at, updated_at = excluded.updated_at`);
  }

  statements.push(
    `UPDATE person
     SET campus_or_location = (
           SELECT COALESCE(person_placement.location_name, person_placement.home_name)
           FROM person_placement
           WHERE person_placement.organization_id = person.organization_id
             AND person_placement.person_id = person.id
             AND person_placement.is_current = 1
         ),
         updated_at = ${sqlLiteral(importedAt)}
     WHERE organization_id = ${organizationId}
       AND source_system = 'THF Office Manager'
       AND source_table = 'beneficiary'
       AND EXISTS (
         SELECT 1 FROM person_placement
         WHERE person_placement.organization_id = person.organization_id
           AND person_placement.person_id = person.id
           AND person_placement.is_current = 1
       )`,
    `UPDATE person_placement_import_batch
     SET status = 'completed',
         imported_count = (
           SELECT COUNT(*) FROM person_placement
           WHERE organization_id = ${organizationId}
             AND import_batch_id = ${sqlLiteral(batchId)}
         ),
         current_placement_count = (
           SELECT COUNT(*) FROM person_placement
           WHERE organization_id = ${organizationId} AND is_current = 1
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
      `Wrangler did not complete the ${target} placement import (exit ${result.status ?? "unknown"}). Output was suppressed because it may contain personal data.`,
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
    throw new Error("The placement dry-run report has not cleared the import gates.");
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
