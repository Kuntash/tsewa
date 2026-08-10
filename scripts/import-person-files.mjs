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
const progressReportPath = resolve(
  repositoryRoot,
  options["progress-report"] ?? "reports/person-files-bulk-import.json",
);
const target = requiredOption(options, "target");
const bulkMode = options.scope === "all";
if (options.scope && !bulkMode) throw new Error("--scope only supports the value all.");
const identifier = bulkMode ? null : requiredOption(options, "identifier");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");
const sourceBucket = requiredOption(options, "source-bucket");
const targetBucket = requiredOption(options, "target-bucket");
const expectedFileCount = Number(requiredOption(options, "expected-file-count"));
const expectedByteCount = bulkMode ? Number(requiredOption(options, "expected-byte-count")) : null;
const expectedPeopleCount = bulkMode ? Number(requiredOption(options, "expected-people-count")) : 1;
const concurrency = Number(options.concurrency ?? (bulkMode ? 4 : 1));
const chunkSize = Number(options["chunk-size"] ?? (bulkMode ? 50 : expectedFileCount));
const planOnly = options["plan-only"] === "true";

if (!Number.isInteger(expectedFileCount) || expectedFileCount < 1) {
  throw new Error("--expected-file-count must be a positive integer.");
}
if (
  (bulkMode && (!Number.isSafeInteger(expectedByteCount) || expectedByteCount < 1)) ||
  !Number.isInteger(expectedPeopleCount) ||
  expectedPeopleCount < 1
) {
  throw new Error("Bulk mode requires positive expected byte and people counts.");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
  throw new Error("--concurrency must be an integer from 1 to 16.");
}
if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 100) {
  throw new Error("--chunk-size must be an integer from 1 to 100.");
}
if (target !== "local" && target !== "remote") {
  throw new Error("--target must be either local or remote.");
}
if (planOnly && !bulkMode) throw new Error("--plan-only is available only with --scope all.");

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
  const selectedPeople = new Set(files.map((file) => file.personId)).size;
  const selectedBytes = files.reduce((total, file) => total + file.byteSize, 0);
  if (selectedPeople !== expectedPeopleCount) {
    throw new Error(
      `The selected records produced ${selectedPeople} people; expected ${expectedPeopleCount}.`,
    );
  }
  if (bulkMode && selectedBytes !== expectedByteCount) {
    throw new Error(
      `The selected records produced ${selectedBytes} bytes; expected ${expectedByteCount}.`,
    );
  }
  if (!bulkMode && selectedPeople !== 1) {
    throw new Error("The pilot selector must resolve to exactly one person.");
  }

  const importedFiles = bulkMode ? readImportedFiles({ organizationSlug, target }) : new Map();
  const alreadyImported = [];
  const pendingFiles = [];
  for (const file of files) {
    const imported = importedFiles.get(file.sourceAssetId);
    if (!imported) {
      pendingFiles.push(file);
      continue;
    }
    if (
      imported.sha256 !== file.sha256 ||
      imported.byteSize !== file.byteSize ||
      imported.objectKey !== file.targetObjectKey
    ) {
      throw new Error(
        "Existing target metadata differs from the reviewed source; refusing to overwrite it.",
      );
    }
    alreadyImported.push(file);
  }

  let copiedFiles = 0;
  let copiedBytes = 0;
  for (let offset = 0; !planOnly && offset < pendingFiles.length; offset += chunkSize) {
    const chunk = pendingFiles.slice(offset, offset + chunkSize);
    const copied = await mapWithConcurrency(chunk, concurrency, (file) =>
      relayObject({ file, sourceBucket, targetBucket, target }),
    );
    const chunkBytes = copied.reduce((total, item) => total + item.byteSize, 0);
    const importedAt = new Date().toISOString();
    const batchHash = createHash("sha256")
      .update(chunk.map((file) => file.sourceAssetId).join("\n"))
      .digest("hex")
      .slice(0, 16);
    const batchId = bulkMode
      ? `file-import-${sourceFingerprint.slice(0, 16)}-bulk-${batchHash}-v1`
      : `file-import-${sourceFingerprint.slice(0, 16)}-${files[0].personSourceTable}-${files[0].personSourceId}-v1`;
    const sql = buildImportSql({
      batchId,
      files: chunk,
      importedAt,
      organizationSlug,
      sourceFingerprint,
    });
    const sourceDuringImport = await stat(sourcePath);
    if (
      sourceDuringImport.size !== sourceBefore.size ||
      sourceDuringImport.mtimeMs !== sourceBefore.mtimeMs
    ) {
      throw new Error("The legacy source changed while person files were being imported.");
    }

    workspace = await mkdtemp(join(tmpdir(), "tsewa-file-import-"));
    const sqlPath = join(workspace, "person-files-import.sql");
    await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
    executeD1Import(sqlPath, target);
    await rm(workspace, { recursive: true, force: true });
    workspace = undefined;

    copiedFiles += chunk.length;
    copiedBytes += chunkBytes;
    if (bulkMode) {
      await writeProgressReport({
        alreadyImported,
        copiedBytes,
        copiedFiles,
        expectedByteCount,
        expectedFileCount,
        expectedPeopleCount,
        pendingFiles,
        sourceFingerprint,
        target,
      });
      console.log(
        JSON.stringify({
          mode: "bulk",
          completedFiles: alreadyImported.length + copiedFiles,
          totalFiles: expectedFileCount,
          completedBytes:
            alreadyImported.reduce((total, file) => total + file.byteSize, 0) + copiedBytes,
          totalBytes: expectedByteCount,
        }),
      );
    }
  }

  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed while person files were being imported.");
  }

  outcome = {
    mode: bulkMode ? "bulk" : "single-person",
    target,
    databaseId: confirmedDatabaseId,
    selectedPeople,
    planOnly,
    alreadyImportedFiles: alreadyImported.length,
    pendingFiles: pendingFiles.length,
    copiedFiles,
    copiedBytes,
    completedFiles: alreadyImported.length + copiedFiles,
    completedBytes: alreadyImported.reduce((total, file) => total + file.byteSize, 0) + copiedBytes,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

async function mapWithConcurrency(items, limit, operation) {
  const results = Array.from({ length: items.length });
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function writeProgressReport({
  alreadyImported,
  copiedBytes,
  copiedFiles,
  expectedByteCount,
  expectedFileCount,
  expectedPeopleCount,
  pendingFiles,
  sourceFingerprint,
  target,
}) {
  const completedBytes =
    alreadyImported.reduce((total, file) => total + file.byteSize, 0) + copiedBytes;
  const report = {
    schemaVersion: 1,
    mode: "bulk_import",
    updatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: { sha256: sourceFingerprint, openedReadOnly: true, unchanged: true },
    target,
    expected: {
      files: expectedFileCount,
      bytes: expectedByteCount,
      people: expectedPeopleCount,
    },
    progress: {
      files: alreadyImported.length + copiedFiles,
      bytes: completedBytes,
      filesRemaining: pendingFiles.length - copiedFiles,
      bytesRemaining: expectedByteCount - completedBytes,
    },
    policy: { genericImageDetectionApplied: false },
  };
  await writeFile(progressReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function relayObject({ file, sourceBucket, targetBucket, target }) {
  const maximumAttempts = 4;
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await relayObjectOnce({ file, sourceBucket, targetBucket, target });
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts) break;
      await delay(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function relayObjectOnce({ file, sourceBucket, targetBucket, target }) {
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

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
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
  const selectedPeople = new Set(files.map((file) => file.personId)).size;
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO person_file_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, selected_person_count, source_file_count, imported_file_count,
      source_byte_count, imported_byte_count, started_at, finished_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${sqlLiteral(organizationId)}, ${sqlLiteral(SOURCE_SYSTEM)},
      'tibethomes-newer-d1.sqlite', ${sqlLiteral(sourceFingerprint)},
      'running', ${selectedPeople}, ${files.length}, 0, ${sourceBytes}, 0,
      ${sqlLiteral(importedAt)}, NULL
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', selected_person_count = ${selectedPeople},
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

function readImportedFiles({ organizationSlug, target }) {
  const command = `SELECT source_asset_id AS sourceAssetId,
      sha256, byte_size AS byteSize, r2_object_key AS objectKey
    FROM person_file
    WHERE organization_id = (
      SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)}
    ) AND source_system = ${sqlLiteral(SOURCE_SYSTEM)}`;
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--command", command, "--json"],
    {
      cwd: webRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    throw new Error("Wrangler could not read the target person-file checkpoint.");
  }

  let response;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new Error("Wrangler returned an invalid person-file checkpoint response.");
  }
  const rows = response.flatMap((entry) => entry.results ?? []);
  return new Map(
    rows.map((row) => [
      String(row.sourceAssetId),
      {
        sha256: String(row.sha256),
        byteSize: Number(row.byteSize),
        objectKey: String(row.objectKey),
      },
    ]),
  );
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
