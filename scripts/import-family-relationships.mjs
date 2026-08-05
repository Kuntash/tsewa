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
  options.report ?? "reports/family-relationships-dry-run.json",
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
const sourceFingerprint = await sha256(sourcePath);
if (sourceFingerprint !== report.source.sha256) {
  throw new Error("The source fingerprint no longer matches the family dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
let outcome;
try {
  const profiles = readFamilyProfiles(database, organizationSlug);
  const relationships = readRelationships(database, organizationSlug);
  const expectedProfiles = Number(report.reconciliation.eligibleProfiles);
  const expectedRelationships = Number(report.reconciliation.eligibleRelationshipRows);
  const reviewCount = relationships.filter((relationship) => relationship.reviewFlag).length;
  if (profiles.length !== expectedProfiles) {
    throw new Error(
      `Family generation produced ${profiles.length} profiles; expected ${expectedProfiles}.`,
    );
  }
  if (relationships.length !== expectedRelationships) {
    throw new Error(
      `Family generation produced ${relationships.length} relationships; expected ${expectedRelationships}.`,
    );
  }
  if (reviewCount !== Number(report.quality.reviewRows)) {
    throw new Error("Generated relationship review count does not match the reviewed dry run.");
  }

  const importedAt = new Date().toISOString();
  const batchId = `family-import-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildImportSql({
    profiles,
    relationships,
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
    throw new Error("The legacy source changed while the family import was being prepared.");
  }

  workspace = await mkdtemp(join(tmpdir(), "tsewa-family-import-"));
  const sqlPath = join(workspace, "family-import.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  executeImport(sqlPath, target);
  outcome = {
    target,
    databaseId: confirmedDatabaseId,
    importedProfiles: profiles.length,
    importedRelationships: relationships.length,
    reviewCount,
    batchId,
    sourceUnchanged: true,
  };
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, temporaryPersonalDataRemoved: true }));

function readFamilyProfiles(databaseConnection, slug) {
  return databaseConnection
    .prepare(
      `SELECT beneficiary.id AS sourceId, parantage.name AS parentageStatus,
              beneficiary.mother_name AS motherName,
              beneficiary.father_name AS fatherName,
              beneficiary.mothers_occupation AS motherOccupation,
              beneficiary.father_occupation AS fatherOccupation,
              beneficiary.parents_phone AS parentsPhone,
              beneficiary.parents_permanent_add AS parentsPermanentAddress,
              beneficiary.guardian1_name AS guardian1Name,
              beneficiary.guardian1_address AS guardian1Address,
              beneficiary.guardian1_email AS guardian1Email,
              beneficiary.guardian1_phone AS guardian1Phone,
              beneficiary.guardian1_mobile AS guardian1Mobile,
              beneficiary.guardian2_name AS guardian2Name,
              beneficiary.guardian2_address AS guardian2Address,
              beneficiary.guardian2_email AS guardian2Email,
              beneficiary.guardian2_phone AS guardian2Phone,
              beneficiary.guardian2_mobile AS guardian2Mobile,
              beneficiary.martials_stutus AS maritalStatus,
              beneficiary.spous_name AS spouseName,
              beneficiary.numberof_children AS numberOfChildren
       FROM beneficiary
       LEFT JOIN parantage ON parantage.id = beneficiary.parentage_id
       WHERE ${familyProfilePredicate()}
       ORDER BY beneficiary.id`,
    )
    .all()
    .map((row) => ({
      id: stableId(slug, "beneficiary_family", row.sourceId),
      personId: stableId(slug, "beneficiary", row.sourceId),
      parentageStatus:
        optionalText(row.parentageStatus)?.toLowerCase() === "none"
          ? null
          : optionalText(row.parentageStatus),
      motherName: optionalText(row.motherName),
      fatherName: optionalText(row.fatherName),
      motherOccupation: optionalText(row.motherOccupation),
      fatherOccupation: optionalText(row.fatherOccupation),
      parentsPhone: optionalText(row.parentsPhone),
      parentsPermanentAddress: optionalText(row.parentsPermanentAddress),
      guardian1Name: optionalText(row.guardian1Name),
      guardian1Address: optionalText(row.guardian1Address),
      guardian1Email: optionalText(row.guardian1Email),
      guardian1Phone: optionalText(row.guardian1Phone),
      guardian1Mobile: optionalText(row.guardian1Mobile),
      guardian2Name: optionalText(row.guardian2Name),
      guardian2Address: optionalText(row.guardian2Address),
      guardian2Email: optionalText(row.guardian2Email),
      guardian2Phone: optionalText(row.guardian2Phone),
      guardian2Mobile: optionalText(row.guardian2Mobile),
      maritalStatus: optionalText(row.maritalStatus),
      spouseName: optionalText(row.spouseName),
      numberOfChildren: optionalText(row.numberOfChildren),
      sourceId: requiredText(row.sourceId, "family source ID"),
    }));
}

function readRelationships(databaseConnection, slug) {
  return databaseConnection
    .prepare(
      `SELECT id AS sourceId, beneficiary_id AS beneficiarySourceId,
              beneficiary_sibling_id AS relatedBeneficiarySourceId,
              COUNT(*) OVER (
                PARTITION BY beneficiary_id, beneficiary_sibling_id
              ) AS directionalCount
       FROM sibling_details
       ORDER BY id`,
    )
    .all()
    .map((row) => ({
      id: stableId(slug, "sibling_details", row.sourceId),
      personId: stableId(slug, "beneficiary", row.beneficiarySourceId),
      relatedPersonId: stableId(slug, "beneficiary", row.relatedBeneficiarySourceId),
      reviewFlag:
        Number(row.beneficiarySourceId) === Number(row.relatedBeneficiarySourceId)
          ? "self_reference"
          : Number(row.directionalCount) > 1
            ? "duplicate_source_link"
            : null,
      sourceId: requiredText(row.sourceId, "relationship source ID"),
    }));
}

function buildImportSql({
  profiles,
  relationships,
  report,
  organizationSlug,
  batchId,
  importedAt,
}) {
  const organizationId = `(SELECT id FROM organization WHERE slug = ${sqlLiteral(organizationSlug)})`;
  const statements = [
    `INSERT INTO person_family_import_batch (
      id, organization_id, source_system, source_database, source_fingerprint,
      status, source_profile_count, imported_profile_count,
      source_relationship_count, imported_relationship_count, review_count,
      started_at, created_at
    ) VALUES (
      ${sqlLiteral(batchId)}, ${organizationId}, 'THF Office Manager',
      ${sqlLiteral(report.source.database)}, ${sqlLiteral(report.source.sha256)},
      'running', ${profiles.length}, 0, ${relationships.length}, 0,
      ${Number(report.quality.reviewRows)}, ${sqlLiteral(importedAt)}, ${sqlLiteral(importedAt)}
    ) ON CONFLICT(id) DO UPDATE SET
      status = 'running', source_profile_count = excluded.source_profile_count,
      imported_profile_count = 0,
      source_relationship_count = excluded.source_relationship_count,
      imported_relationship_count = 0, review_count = excluded.review_count,
      started_at = excluded.started_at, finished_at = NULL`,
  ];

  for (let index = 0; index < profiles.length; index += 20) {
    const values = profiles
      .slice(index, index + 20)
      .map((profile) =>
        [
          profile.id,
          rawSql(organizationId),
          profile.personId,
          profile.parentageStatus,
          profile.motherName,
          profile.fatherName,
          profile.motherOccupation,
          profile.fatherOccupation,
          profile.parentsPhone,
          profile.parentsPermanentAddress,
          profile.guardian1Name,
          profile.guardian1Address,
          profile.guardian1Email,
          profile.guardian1Phone,
          profile.guardian1Mobile,
          profile.guardian2Name,
          profile.guardian2Address,
          profile.guardian2Email,
          profile.guardian2Phone,
          profile.guardian2Mobile,
          profile.maritalStatus,
          profile.spouseName,
          profile.numberOfChildren,
          "THF Office Manager",
          "beneficiary",
          profile.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]
          .map(sqlLiteral)
          .join(", "),
      );
    statements.push(`INSERT INTO person_family_profile (
      id, organization_id, person_id, parentage_status, mother_name, father_name,
      mother_occupation, father_occupation, parents_phone, parents_permanent_address,
      guardian_1_name, guardian_1_address, guardian_1_email, guardian_1_phone,
      guardian_1_mobile, guardian_2_name, guardian_2_address, guardian_2_email,
      guardian_2_phone, guardian_2_mobile, marital_status, spouse_name,
      number_of_children, source_system, source_table, source_id, import_batch_id,
      imported_at, created_at, updated_at
    ) VALUES\n      (${values.join("),\n      (")})
    ON CONFLICT(organization_id, source_system, source_table, source_id)
    DO UPDATE SET
      person_id = excluded.person_id, parentage_status = excluded.parentage_status,
      mother_name = excluded.mother_name, father_name = excluded.father_name,
      mother_occupation = excluded.mother_occupation,
      father_occupation = excluded.father_occupation,
      parents_phone = excluded.parents_phone,
      parents_permanent_address = excluded.parents_permanent_address,
      guardian_1_name = excluded.guardian_1_name,
      guardian_1_address = excluded.guardian_1_address,
      guardian_1_email = excluded.guardian_1_email,
      guardian_1_phone = excluded.guardian_1_phone,
      guardian_1_mobile = excluded.guardian_1_mobile,
      guardian_2_name = excluded.guardian_2_name,
      guardian_2_address = excluded.guardian_2_address,
      guardian_2_email = excluded.guardian_2_email,
      guardian_2_phone = excluded.guardian_2_phone,
      guardian_2_mobile = excluded.guardian_2_mobile,
      marital_status = excluded.marital_status, spouse_name = excluded.spouse_name,
      number_of_children = excluded.number_of_children,
      import_batch_id = excluded.import_batch_id,
      imported_at = excluded.imported_at, updated_at = excluded.updated_at`);
  }

  for (let index = 0; index < relationships.length; index += 50) {
    const values = relationships
      .slice(index, index + 50)
      .map((relationship) =>
        [
          relationship.id,
          rawSql(organizationId),
          relationship.personId,
          relationship.relatedPersonId,
          "sibling",
          relationship.reviewFlag,
          "THF Office Manager",
          "sibling_details",
          relationship.sourceId,
          batchId,
          importedAt,
          importedAt,
          importedAt,
        ]
          .map(sqlLiteral)
          .join(", "),
      );
    statements.push(`INSERT INTO person_relationship (
      id, organization_id, person_id, related_person_id, relationship_type,
      review_flag, source_system, source_table, source_id, import_batch_id,
      imported_at, created_at, updated_at
    ) VALUES\n      (${values.join("),\n      (")})
    ON CONFLICT(organization_id, source_system, source_table, source_id)
    DO UPDATE SET
      person_id = excluded.person_id, related_person_id = excluded.related_person_id,
      relationship_type = excluded.relationship_type, review_flag = excluded.review_flag,
      import_batch_id = excluded.import_batch_id,
      imported_at = excluded.imported_at, updated_at = excluded.updated_at`);
  }

  statements.push(
    `UPDATE person_family_import_batch
     SET status = 'completed',
         imported_profile_count = (
           SELECT COUNT(*) FROM person_family_profile
           WHERE organization_id = ${organizationId} AND import_batch_id = ${sqlLiteral(batchId)}
         ),
         imported_relationship_count = (
           SELECT COUNT(*) FROM person_relationship
           WHERE organization_id = ${organizationId} AND import_batch_id = ${sqlLiteral(batchId)}
         ),
         review_count = (
           SELECT COUNT(*) FROM person_relationship
           WHERE organization_id = ${organizationId}
             AND import_batch_id = ${sqlLiteral(batchId)} AND review_flag IS NOT NULL
         ),
         finished_at = ${sqlLiteral(importedAt)}
     WHERE id = ${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function familyProfilePredicate() {
  return `(beneficiary.parentage_id IS NOT NULL AND beneficiary.parentage_id <> 0
    OR trim(coalesce(beneficiary.mother_name, '')) <> ''
    OR trim(coalesce(beneficiary.father_name, '')) <> ''
    OR trim(coalesce(beneficiary.mothers_occupation, '')) <> ''
    OR trim(coalesce(beneficiary.father_occupation, '')) <> ''
    OR trim(coalesce(beneficiary.parents_phone, '')) <> ''
    OR trim(coalesce(beneficiary.parents_permanent_add, '')) <> ''
    OR trim(coalesce(beneficiary.guardian1_name, '')) <> ''
    OR trim(coalesce(beneficiary.guardian1_address, '')) <> ''
    OR trim(coalesce(beneficiary.guardian1_email, '')) <> ''
    OR trim(coalesce(beneficiary.guardian1_phone, '')) <> ''
    OR trim(coalesce(beneficiary.guardian1_mobile, '')) <> ''
    OR trim(coalesce(beneficiary.guardian2_name, '')) <> ''
    OR trim(coalesce(beneficiary.guardian2_address, '')) <> ''
    OR trim(coalesce(beneficiary.guardian2_email, '')) <> ''
    OR trim(coalesce(beneficiary.guardian2_phone, '')) <> ''
    OR trim(coalesce(beneficiary.guardian2_mobile, '')) <> ''
    OR trim(coalesce(beneficiary.martials_stutus, '')) <> ''
    OR trim(coalesce(beneficiary.spous_name, '')) <> ''
    OR trim(coalesce(beneficiary.numberof_children, '')) <> '')`;
}

function executeImport(sqlPath, selectedTarget) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${selectedTarget}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(
      `Wrangler did not complete the ${selectedTarget} family import (exit ${result.status ?? "unknown"}). Output was suppressed because it may contain personal data.`,
    );
  }
}

async function assertTargetBinding(databaseId, selectedTarget) {
  const configuration = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!configuration.includes(databaseId)) {
    throw new Error("The confirmed database ID is not present in apps/web/wrangler.jsonc.");
  }
  if (selectedTarget === "local") return;
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
    report?.reconciliation?.blockedRelationshipRows !== 0 ||
    report?.reconciliation?.sourceRelationshipRows !==
      report?.reconciliation?.eligibleRelationshipRows
  ) {
    throw new Error("The family dry-run report has not cleared the import gates.");
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
