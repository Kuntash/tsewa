import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(
  repositoryRoot,
  options.source ?? "../data-migration/d1/tibethomes-newer-d1.sqlite",
);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/family-relationships-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const fingerprint = await sha256(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });

database.exec("PRAGMA query_only = ON");

try {
  const profiles = row(
    database,
    `SELECT COUNT(*) AS beneficiaryRows,
            SUM(${familyProfilePredicate()}) AS eligibleProfiles,
            SUM(parentage_id IS NOT NULL AND parentage_id <> 0) AS populatedParentage,
            SUM(trim(coalesce(mother_name, '')) <> '' OR trim(coalesce(father_name, '')) <> '') AS populatedParentNames,
            SUM(trim(coalesce(guardian1_name, '')) <> '' OR trim(coalesce(guardian2_name, '')) <> '') AS populatedGuardians,
            SUM(trim(coalesce(martials_stutus, '')) <> '' OR trim(coalesce(spous_name, '')) <> '' OR trim(coalesce(numberof_children, '')) <> '') AS populatedOwnFamily
     FROM beneficiary`,
  );
  const relationships = row(
    database,
    `SELECT COUNT(*) AS sourceRows,
            COUNT(DISTINCT beneficiary_id) AS peopleWithRelationships,
            SUM(id IS NULL) AS missingSourceIds,
            COUNT(*) - COUNT(DISTINCT id) AS duplicateSourceIds,
            SUM(beneficiary_id IS NULL) AS missingPersonIds,
            SUM(beneficiary_sibling_id IS NULL) AS missingRelatedPersonIds,
            SUM(beneficiary_id = beneficiary_sibling_id) AS selfReferences
     FROM sibling_details`,
  );
  const missingPersonLinks = scalar(
    database,
    `SELECT COUNT(*) AS count FROM sibling_details
     LEFT JOIN beneficiary ON beneficiary.id = sibling_details.beneficiary_id
     WHERE beneficiary.id IS NULL`,
  );
  const missingRelatedPersonLinks = scalar(
    database,
    `SELECT COUNT(*) AS count FROM sibling_details
     LEFT JOIN beneficiary ON beneficiary.id = sibling_details.beneficiary_sibling_id
     WHERE beneficiary.id IS NULL`,
  );
  const duplicateDirectionalGroups = scalar(
    database,
    `SELECT COUNT(*) AS count FROM (
       SELECT beneficiary_id, beneficiary_sibling_id
       FROM sibling_details
       GROUP BY beneficiary_id, beneficiary_sibling_id
       HAVING COUNT(*) > 1
     )`,
  );
  const duplicateDirectionalRows = scalar(
    database,
    `SELECT coalesce(SUM(group_count), 0) AS count FROM (
       SELECT COUNT(*) AS group_count
       FROM sibling_details
       GROUP BY beneficiary_id, beneficiary_sibling_id
       HAVING COUNT(*) > 1
     )`,
  );
  const reciprocalRows = scalar(
    database,
    `SELECT COUNT(*) AS count FROM sibling_details AS relationship
     WHERE EXISTS (
       SELECT 1 FROM sibling_details AS reverse_relationship
       WHERE reverse_relationship.beneficiary_id = relationship.beneficiary_sibling_id
         AND reverse_relationship.beneficiary_sibling_id = relationship.beneficiary_id
     )`,
  );
  const reviewRows = scalar(
    database,
    `SELECT COUNT(*) AS count FROM (
       SELECT beneficiary_id, beneficiary_sibling_id,
              COUNT(*) OVER (
                PARTITION BY beneficiary_id, beneficiary_sibling_id
              ) AS directional_count
       FROM sibling_details
     )
     WHERE beneficiary_id = beneficiary_sibling_id OR directional_count > 1`,
  );
  const blockedRelationships =
    Number(relationships.missingSourceIds) +
    Number(relationships.duplicateSourceIds) +
    Number(relationships.missingPersonIds) +
    Number(relationships.missingRelatedPersonIds) +
    missingPersonLinks +
    missingRelatedPersonLinks;
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
      tables: ["beneficiary", "parantage", "sibling_details"],
      repositoryRelativeLocation: normalizePath(relative(repositoryRoot, sourcePath)),
      sha256: fingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    reconciliation: {
      beneficiaryRows: Number(profiles.beneficiaryRows),
      eligibleProfiles: Number(profiles.eligibleProfiles),
      sourceRelationshipRows: Number(relationships.sourceRows),
      eligibleRelationshipRows: Number(relationships.sourceRows) - blockedRelationships,
      blockedRelationshipRows: blockedRelationships,
      peopleWithRelationships: Number(relationships.peopleWithRelationships),
      importedProfiles: 0,
      importedRelationships: 0,
    },
    quality: {
      populatedParentage: Number(profiles.populatedParentage),
      populatedParentNames: Number(profiles.populatedParentNames),
      populatedGuardians: Number(profiles.populatedGuardians),
      populatedOwnFamily: Number(profiles.populatedOwnFamily),
      missingSourceIds: Number(relationships.missingSourceIds),
      duplicateSourceIds: Number(relationships.duplicateSourceIds),
      missingPersonIds: Number(relationships.missingPersonIds),
      missingRelatedPersonIds: Number(relationships.missingRelatedPersonIds),
      missingPersonLinks,
      missingRelatedPersonLinks,
      selfReferences: Number(relationships.selfReferences),
      duplicateDirectionalGroups,
      duplicateDirectionalRows,
      reciprocalRows,
      reviewRows,
    },
    preservationRule:
      "All source relationships are retained; self-references and duplicate directional links are flagged for review.",
  };

  assertAggregateOnly(report);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== fingerprint
  ) {
    throw new Error("The legacy source changed during the read-only family dry run.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: normalizePath(relative(repositoryRoot, outputPath)),
      eligibleProfiles: report.reconciliation.eligibleProfiles,
      eligibleRelationships: report.reconciliation.eligibleRelationshipRows,
      blockedRelationships,
      reviewRows: report.quality.reviewRows,
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function familyProfilePredicate() {
  return `(parentage_id IS NOT NULL AND parentage_id <> 0
    OR trim(coalesce(mother_name, '')) <> ''
    OR trim(coalesce(father_name, '')) <> ''
    OR trim(coalesce(mothers_occupation, '')) <> ''
    OR trim(coalesce(father_occupation, '')) <> ''
    OR trim(coalesce(parents_phone, '')) <> ''
    OR trim(coalesce(parents_permanent_add, '')) <> ''
    OR trim(coalesce(guardian1_name, '')) <> ''
    OR trim(coalesce(guardian1_address, '')) <> ''
    OR trim(coalesce(guardian1_email, '')) <> ''
    OR trim(coalesce(guardian1_phone, '')) <> ''
    OR trim(coalesce(guardian1_mobile, '')) <> ''
    OR trim(coalesce(guardian2_name, '')) <> ''
    OR trim(coalesce(guardian2_address, '')) <> ''
    OR trim(coalesce(guardian2_email, '')) <> ''
    OR trim(coalesce(guardian2_phone, '')) <> ''
    OR trim(coalesce(guardian2_mobile, '')) <> ''
    OR trim(coalesce(martials_stutus, '')) <> ''
    OR trim(coalesce(spous_name, '')) <> ''
    OR trim(coalesce(numberof_children, '')) <> '')`;
}

function row(databaseConnection, sql) {
  return databaseConnection.prepare(sql).get();
}

function scalar(databaseConnection, sql) {
  return Number(row(databaseConnection, sql)?.count ?? 0);
}

function assertAggregateOnly(report) {
  const forbiddenKeys = new Set([
    "displayName",
    "personId",
    "relatedPersonId",
    "motherName",
    "fatherName",
    "guardianName",
    "phone",
    "email",
    "address",
    "sourceId",
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

function parseArguments(argumentsList) {
  const filteredArguments = argumentsList.filter((argument) => argument !== "--");
  const parsed = {};
  for (let index = 0; index < filteredArguments.length; index += 2) {
    const name = filteredArguments[index];
    const value = filteredArguments[index + 1];
    if (!name?.startsWith("--") || !value) throw new Error(`Invalid argument near ${name}.`);
    parsed[name.slice(2)] = value;
  }
  return parsed;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
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
