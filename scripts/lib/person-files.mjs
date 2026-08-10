import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export const SOURCE_SYSTEM = "THF Office Manager";
export const DEFAULT_SOURCE_DATABASE = "../data-migration/d1/tibethomes-newer-d1.sqlite";

export function readPersonFiles(database, organizationSlug, identifier = null) {
  const rows = database
    .prepare(
      `WITH file_refs AS (
         SELECT 'beneficiary' AS person_source_table, beneficiary.id AS person_source_id,
                CAST(beneficiary.admission_no AS TEXT) AS primary_identifier,
                'profile_photo' AS category, 'Profile photo' AS label,
                'beneficiary' AS source_table, beneficiary.id AS source_id,
                beneficiary.photo_asset_id AS source_asset_id
         FROM beneficiary
         UNION ALL
         SELECT 'beneficiary', beneficiary.id, CAST(beneficiary.admission_no AS TEXT),
                'parents_photo', 'Parents photo', 'beneficiary', beneficiary.id,
                beneficiary.parents_image_asset_id
         FROM beneficiary
         UNION ALL
         SELECT 'beneficiary', beneficiary.id, CAST(beneficiary.admission_no AS TEXT),
                'guardian_1_photo', 'Primary guardian photo', 'beneficiary', beneficiary.id,
                beneficiary.guardian1_image_asset_id
         FROM beneficiary
         UNION ALL
         SELECT 'beneficiary', beneficiary.id, CAST(beneficiary.admission_no AS TEXT),
                'guardian_2_photo', 'Secondary guardian photo', 'beneficiary', beneficiary.id,
                beneficiary.guardian2_image_asset_id
         FROM beneficiary
         UNION ALL
         SELECT 'beneficiary', beneficiary.id, CAST(beneficiary.admission_no AS TEXT),
                'document', coalesce(nullif(trim(document.name), ''), 'Legacy document'),
                'document', document.id, document.image_asset_id
         FROM document
         JOIN beneficiary ON beneficiary.id = document.beneficiary_id
         UNION ALL
         SELECT 'staff', staff.id, CAST(staff.registration_no AS TEXT),
                'profile_photo', 'Profile photo', 'staff', staff.id, staff.photo_asset_id
         FROM staff
       )
       SELECT file_refs.person_source_table AS personSourceTable,
              file_refs.person_source_id AS personSourceId,
              file_refs.primary_identifier AS primaryIdentifier,
              file_refs.category, file_refs.label,
              file_refs.source_table AS sourceTable,
              file_refs.source_id AS sourceId,
              asset.id AS sourceAssetId, asset.object_key AS sourceObjectKey,
              asset.file_name AS sourceFileName, asset.content_type AS contentType,
              asset.byte_size AS byteSize, asset.sha256
       FROM file_refs
       JOIN asset ON asset.id = file_refs.source_asset_id
       WHERE (? IS NULL OR file_refs.primary_identifier = ?)
       ORDER BY file_refs.person_source_table, file_refs.person_source_id,
                CASE file_refs.category
                  WHEN 'profile_photo' THEN 0
                  WHEN 'parents_photo' THEN 1
                  WHEN 'guardian_1_photo' THEN 2
                  WHEN 'guardian_2_photo' THEN 3
                  ELSE 4
                END,
                file_refs.source_id`,
    )
    .all(identifier, identifier);

  return rows.map((row) => {
    const personId = stablePersonId(
      organizationSlug,
      requiredText(row.personSourceTable, "person source table"),
      requiredText(row.personSourceId, "person source ID"),
    );
    const sourceAssetId = requiredText(row.sourceAssetId, "source asset ID");
    const sourceObjectKey = requiredText(row.sourceObjectKey, "source object key");
    const extension = objectExtension(sourceObjectKey);
    const label = requiredText(row.label, "file label");
    const sourceFileName = optionalText(row.sourceFileName) ?? label;

    return {
      id: stableUuid(`tsewa|${organizationSlug}|person_file|${sourceAssetId}`),
      personId,
      personSourceTable: requiredText(row.personSourceTable, "person source table"),
      personSourceId: requiredText(row.personSourceId, "person source ID"),
      category: requiredText(row.category, "file category"),
      label,
      fileName: withExtension(sourceFileName, extension),
      contentType: requiredText(row.contentType, "content type"),
      byteSize: Number(row.byteSize),
      sha256: requiredText(row.sha256, "SHA-256"),
      sourceTable: requiredText(row.sourceTable, "source table"),
      sourceId: requiredText(row.sourceId, "source ID"),
      sourceAssetId,
      sourceObjectKey,
      targetObjectKey: `organizations/${organizationSlug}/people/${personId}/files/${sourceAssetId}.${extension}`,
      isPrimary: row.category === "profile_photo" ? 1 : 0,
    };
  });
}

export function stablePersonId(organizationSlug, sourceTable, sourceId) {
  return stableUuid(`tsewa|${organizationSlug}|${sourceTable}|${sourceId}`);
}

export function stableUuid(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function parseArguments(argumentsList) {
  const filtered = argumentsList.filter((argument) => argument !== "--");
  const parsed = {};
  for (let index = 0; index < filtered.length; index += 2) {
    const name = filtered[index];
    const value = filtered[index + 1];
    if (!name?.startsWith("--") || !value) throw new Error(`Invalid argument near ${name}.`);
    parsed[name.slice(2)] = value;
  }
  return parsed;
}

export function requiredOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

export function sqlLiteral(value) {
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

export function rawSql(value) {
  return { sql: value };
}

export function sha256File(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", rejectHash);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function objectExtension(objectKey) {
  const match = objectKey.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) throw new Error(`Source object has no safe extension: ${objectKey}`);
  return match[1].toLowerCase();
}

function withExtension(value, extension) {
  const clean = value.replaceAll(/[\r\n/\\]/g, "_").trim() || "legacy-file";
  return clean.toLowerCase().endsWith(`.${extension}`) ? clean : `${clean}.${extension}`;
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
