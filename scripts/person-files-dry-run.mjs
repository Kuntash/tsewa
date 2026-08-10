import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, readPersonFiles } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(repositoryRoot, options.output ?? "reports/person-files-dry-run.json");
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const files = readPersonFiles(database, "dry-run");
  const categoryCounts = Object.fromEntries(
    ["profile_photo", "parents_photo", "guardian_1_photo", "guardian_2_photo", "document"].map(
      (category) => [category, files.filter((file) => file.category === category).length],
    ),
  );
  const categoryBytes = Object.fromEntries(
    Object.keys(categoryCounts).map((category) => [
      category,
      files
        .filter((file) => file.category === category)
        .reduce((total, file) => total + file.byteSize, 0),
    ]),
  );
  const peopleWithFiles = new Set(
    files.map((file) => `${file.personSourceTable}:${file.personSourceId}`),
  ).size;
  const missingAssetReferences = Number(
    database
      .prepare(
        `WITH file_refs AS (
           SELECT photo_asset_id AS asset_id FROM beneficiary
           UNION ALL SELECT parents_image_asset_id FROM beneficiary
           UNION ALL SELECT guardian1_image_asset_id FROM beneficiary
           UNION ALL SELECT guardian2_image_asset_id FROM beneficiary
           UNION ALL SELECT image_asset_id FROM document
           UNION ALL SELECT photo_asset_id FROM staff
         )
         SELECT COUNT(*) AS count
         FROM file_refs LEFT JOIN asset ON asset.id = file_refs.asset_id
         WHERE file_refs.asset_id IS NOT NULL AND asset.id IS NULL`,
      )
      .get()?.count ?? 0,
  );
  const documentRowsWithoutAssets = Number(
    database.prepare("SELECT COUNT(*) AS count FROM document WHERE image_asset_id IS NULL").get()
      ?.count ?? 0,
  );
  const report = {
    schemaVersion: 1,
    mode: "dry_run",
    generatedAt: new Date().toISOString(),
    privacy: {
      classification: "aggregate-only",
      containsPersonalData: false,
      selectedRowValues: false,
    },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: ["asset", "beneficiary", "document", "staff"],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    reconciliation: {
      eligibleFileRows: files.length,
      eligibleByteCount: files.reduce((total, file) => total + file.byteSize, 0),
      peopleWithFiles,
      missingAssetReferences,
      documentRowsWithoutAssets,
      categoryCounts,
      categoryBytes,
    },
    policy: {
      genericImageDetectionApplied: false,
      preservationRule: "Every referenced asset is retained without placeholder classification.",
    },
  };

  assertAggregateOnly(report);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed during the read-only person-file dry run.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
      eligibleFiles: files.length,
      peopleWithFiles,
      missingAssetReferences,
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function assertAggregateOnly(report) {
  const forbiddenKeys = new Set([
    "displayName",
    "personId",
    "primaryIdentifier",
    "fileName",
    "label",
    "sourceId",
    "sourceAssetId",
    "objectKey",
  ]);
  visit(report, (key) => {
    if (forbiddenKeys.has(key)) throw new Error(`Forbidden report key: ${key}`);
  });
}

function visit(value, onKey) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) visit(item, onKey);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    onKey(key);
    visit(child, onKey);
  }
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
