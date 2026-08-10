import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  DEFAULT_SOURCE_DATABASE,
  SOURCE_SYSTEM,
  parseArguments,
  rawSql,
  readPersonFiles,
  requiredOption,
  sha256File,
  sqlLiteral,
} from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const reportPath = resolve(repositoryRoot, options.report ?? "reports/person-files-dry-run.json");
const target = requiredOption(options, "target");
const identifier = requiredOption(options, "identifier");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");
const sourceBucket = requiredOption(options, "source-bucket");
const targetBucket = requiredOption(options, "target-bucket");
const expectedFileCount = Number(requiredOption(options, "expected-file-count"));

if (!Number.isInteger(expectedFileCount) || expectedFileCount < 1) {
  throw new Error("--expected-file-count must be a positive integer.");
}
if (target !== "local" && target !== "remote") {
  throw new Error("--target must be either local or remote.");
}

await assertTargetBindings({ confirmedDatabaseId, target, targetBucket });
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertDryRunReport(report);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
if (sourceFingerprint !== report.source.sha256) {
  throw new Error("The source fingerprint no longer matches the person-file dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const files = readPersonFiles(database, organizationSlug, identifier);
  if (files.length !== expectedFileCount) {
    throw new Error(
      `The selected record produced ${files.length} files; expected ${expectedFileCount}.`,
    );
  }
  if (new Set(files.map((file) => file.personId)).size !== 1) {
    throw new Error("The pilot selector must resolve to exactly one person.");
  }

  let copiedBytes = 0;
  for (const file of files) {
    const copied = await relayObject({ file, sourceBucket, targetBucket, target });
    copiedBytes += copied.byteSize;
  }

  const importedAt = new Date().toISOString();
  const batchId = `file-import-${sourceFingerprint.slice(0, 16)}-${files[0].personSourceTable}-${files[0].personSourceId}-v1`;
  const sql = buildImportSql({
    batchId,
    files,
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
    throw new Error("The legacy source changed while the person-file pilot was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-file-import-"));
  const sqlPath = join(workspace, "person-files-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  executeD1Import(sqlPath, target);

  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    selectedPeople: 1,
    importedFiles: files.length,
    importedBytes: copiedBytes,
    batchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

async function relayObject({ file, sourceBucket, targetBucket, target }) {
  const hash = createHash("sha256");
  let byteSize = 0;
  const source = spawnWrangler([
    "r2",
    "object",
    "get",
    `${sourceBucket}/${file.sourceObjectKey}`,
    "--remote",
    "--pipe",
  ]);
  const destination = spawnWrangler(
    [
      "r2",
      "object",
      "put",
      `${targetBucket}/${file.targetObjectKey}`,
      `--${target}`,
      "--pipe",
      "--content-type",
      file.contentType,
      "--force",
    ],
    true,
  );

  source.stdout.on("data", (chunk) => {
    hash.update(chunk);
    byteSize += chunk.length;
  });
  source.stdout.pipe(destination.stdin);
  const [sourceStatus, destinationStatus] = await Promise.all([
    waitForProcess(source),
    waitForProcess(destination),
  ]);
  if (sourceStatus !== 0 || destinationStatus !== 0) {
    throw new Error("Wrangler could not relay a verified legacy object to the target R2 bucket.");
  }
  if (byteSize !== file.byteSize || hash.digest("hex") !== file.sha256) {
    throw new Error("A relayed legacy object did not match its D1 size and SHA-256 metadata.");
  }

  const verified = await hashR2Object(targetBucket, file.targetObjectKey, target);
  if (verified.byteSize !== file.byteSize || verified.sha256 !== file.sha256) {
    throw new Error("A target R2 object did not pass the post-upload size and SHA-256 check.");
  }
  return verified;
}

async function hashR2Object(bucket, objectKey, target) {
  const hash = createHash("sha256");
  let byteSize = 0;
  const process = spawnWrangler([
    "r2",
    "object",
    "get",
    `${bucket}/${objectKey}`,
    `--${target}`,
    "--pipe",
  ]);
  process.stdout.on("data", (chunk) => {
    hash.update(chunk);
    byteSize += chunk.length;
  });
  const status = await waitForProcess(process);
  if (status !== 0) throw new Error("Wrangler could not verify a target R2 object.");
  return { byteSize, sha256: hash.digest("hex") };
}

function spawnWrangler(argumentsList, writableInput = false) {
  return spawn("pnpm", ["exec", "wrangler", ...argumentsList], {
    cwd: webRoot,
    stdio: [writableInput ? "pipe" : "ignore", "pipe", "ignore"],
  });
}

function waitForProcess(child) {
  return new Promise((resolveStatus, rejectStatus) => {
    child.on("error", rejectStatus);
    child.on("close", (status) => resolveStatus(status ?? 1));
  });
}

function buildImportSql({ batchId, files, importedAt, organizationSlug, sourceFingerprint }) {
  const organizationId = rawSql(
    `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`,
  );
  const sourceBytes = files.reduce((total, file) => total + file.byteSize, 0);
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO person_file_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, selected_person_count, source_file_count, imported_file_count,
      source_byte_count, imported_byte_count, started_at, finished_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${sqlLiteral(organizationId)}, ${sqlLiteral(SOURCE_SYSTEM)},
      'tibethomes-newer-d1.sqlite', ${sqlLiteral(sourceFingerprint)},
      'running', 1, ${files.length}, 0, ${sourceBytes}, 0,
      ${sqlLiteral(importedAt)}, NULL
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', selected_person_count = 1,
      source_file_count = excluded.source_file_count,
      imported_file_count = 0, source_byte_count = excluded.source_byte_count,
      imported_byte_count = 0, started_at = excluded.started_at, finished_at = NULL`,
  ];

  for (let index = 0; index < files.length; index += 100) {
    const values = files
      .slice(index, index + 100)
      .map((file) =>
        [
          file.id,
          organizationId,
          file.personId,
          file.category,
          file.label,
          file.fileName,
          file.contentType,
          file.byteSize,
          file.sha256,
          file.targetObjectKey,
          file.isPrimary,
          SOURCE_SYSTEM,
          file.sourceTable,
          file.sourceId,
          file.sourceAssetId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]
          .map(sqlLiteral)
          .join(", "),
      );
    statements.push(`INSERT INTO person_file (
      id, organization_id, person_id, category, label, file_name, content_type,
      byte_size, sha256, r2_object_key, is_primary, source_system, source_table,
      source_id, source_asset_id, import_batch_id, imported_at, created_at, updated_at
    ) VALUES\n      (${values.join("),\n      (")})
    ON CONFLICT(organization_id, source_system, source_asset_id) DO UPDATE SET
      person_id = excluded.person_id, category = excluded.category,
      label = excluded.label, file_name = excluded.file_name,
      content_type = excluded.content_type, byte_size = excluded.byte_size,
      sha256 = excluded.sha256, r2_object_key = excluded.r2_object_key,
      is_primary = excluded.is_primary, source_table = excluded.source_table,
      source_id = excluded.source_id, import_batch_id = excluded.import_batch_id,
      imported_at = excluded.imported_at, updated_at = excluded.updated_at`);
  }

  statements.push(`UPDATE person_file_import_batch
    SET status = 'completed',
        imported_file_count = (
          SELECT COUNT(*) FROM person_file WHERE import_batch_id = ${sqlLiteral(batchId)}
        ),
        imported_byte_count = (
          SELECT coalesce(SUM(byte_size), 0) FROM person_file
          WHERE import_batch_id = ${sqlLiteral(batchId)}
        ),
        finished_at = ${sqlLiteral(importedAt)}
    WHERE id = ${sqlLiteral(batchId)}`);

  return `${statements.join(";\n\n")};\n`;
}

function executeD1Import(sqlPath, target) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(
      `Wrangler did not complete the ${target} person-file import. Output was suppressed because it may contain personal data.`,
    );
  }
}

async function assertTargetBindings({ confirmedDatabaseId, target, targetBucket }) {
  const configuration = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!configuration.includes(confirmedDatabaseId) || !configuration.includes(targetBucket)) {
    throw new Error("The confirmed D1 or R2 target is not present in apps/web/wrangler.jsonc.");
  }
  if (target === "local") return;

  const database = spawnSync("pnpm", ["exec", "wrangler", "d1", "info", "DB"], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (database.status !== 0 || !database.stdout.includes(confirmedDatabaseId)) {
    throw new Error("The live DB binding does not match --confirm-database-id.");
  }
  const bucket = spawnSync("pnpm", ["exec", "wrangler", "r2", "bucket", "info", targetBucket], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (bucket.status !== 0 || !bucket.stdout.includes(targetBucket)) {
    throw new Error("The live R2 bucket does not match --target-bucket.");
  }
}

function assertDryRunReport(report) {
  if (
    report?.mode !== "dry_run" ||
    report?.privacy?.containsPersonalData !== false ||
    report?.policy?.genericImageDetectionApplied !== false ||
    Number(report?.reconciliation?.eligibleFileRows ?? 0) < 1 ||
    Number(report?.reconciliation?.missingAssetReferences ?? -1) !== 0
  ) {
    throw new Error("The reviewed person-file dry-run report has not cleared the import gates.");
  }
}
