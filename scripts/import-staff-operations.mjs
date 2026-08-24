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
  options.report ?? "reports/staff-operations-dry-run.json",
);
const target = requiredOption(options, "target");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");
if (!["local", "remote"].includes(target)) throw new Error("--target must be local or remote.");

await assertTargetBinding();
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertReport(report);
const sourceBefore = await stat(sourcePath);
const fingerprint = await sha256File(sourcePath);
if (fingerprint !== report.source.sha256) {
  throw new Error("The source no longer matches the reviewed staff dry run.");
}

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");
let workspace;
try {
  const data = readData(database);
  assertCounts(data);
  const importedAt = new Date().toISOString();
  const batchId = `staff-operations-${fingerprint.slice(0, 16)}-v1`;
  const sql = buildSql(data, batchId, importedAt);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== fingerprint
  ) {
    throw new Error("The legacy source changed while preparing the staff import.");
  }
  workspace = await mkdtemp(join(tmpdir(), "tsewa-staff-import-"));
  const sqlPath = join(workspace, "staff-operations.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`Wrangler did not complete the staff import: ${safeError(result)}`);
  }
  console.log(
    JSON.stringify({
      target,
      databaseId: confirmedDatabaseId,
      batchId,
      departments: data.departments.length,
      designations: data.designations.length,
      categories: data.categories.length,
      profiles: data.profiles.length,
      employmentEvents: data.events.length,
      sourceUnchanged: true,
      temporaryPersonalDataRemoved: true,
    }),
  );
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readData(connection) {
  const departmentSourceIds = new Set(
    connection
      .prepare("SELECT id FROM department")
      .all()
      .map((row) => text(row.id)),
  );
  const designationSourceIds = new Set(
    connection
      .prepare("SELECT id FROM designation")
      .all()
      .map((row) => text(row.id)),
  );
  const categorySourceIds = new Set(
    connection
      .prepare("SELECT id FROM staff_category")
      .all()
      .map((row) => text(row.id)),
  );
  const departments = connection
    .prepare("SELECT id,name FROM department ORDER BY id")
    .all()
    .map((row) => ({
      id: id("department", row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, "department name"),
    }));
  const designations = connection
    .prepare("SELECT id,name,department_id FROM designation ORDER BY id")
    .all()
    .map((row) => ({
      id: id("designation", row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, "designation name"),
      departmentId: departmentSourceIds.has(text(row.department_id))
        ? id("department", row.department_id)
        : null,
      legacyDepartmentId: optionalText(row.department_id),
    }));
  const categories = connection
    .prepare("SELECT id,name FROM staff_category ORDER BY id")
    .all()
    .map((row) => ({
      id: id("staff_category", row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, "staff category name"),
    }));
  const profiles = connection
    .prepare("SELECT * FROM staff ORDER BY id")
    .all()
    .map((row) => ({
      id: id("staff_profile", row.id),
      sourceId: text(row.id),
      personId: stablePersonId(organizationSlug, "staff", row.id),
      departmentId: departmentSourceIds.has(text(row.department_id))
        ? id("department", row.department_id)
        : null,
      designationId: designationSourceIds.has(text(row.designation_id))
        ? id("designation", row.designation_id)
        : null,
      categoryId: categorySourceIds.has(text(row.catogary_id))
        ? id("staff_category", row.catogary_id)
        : null,
      legacyDepartmentId: optionalText(row.department_id),
      legacyDesignationId: optionalText(row.designation_id),
      permanentOn: optionalDate(row.date_of_permanent),
      spouseName: optionalText(row.spouse_name),
      settlementName: optionalText(row.settlement_name),
      allocatedPlace: optionalText(row.place_allocated),
      motherName: optionalText(row.mothers_name),
      fatherName: optionalText(row.father_name),
      address: optionalText(row.address),
      maritalStatus: optionalText(row.marital_status),
      registrationCertificateNumber: optionalText(row.rcno),
      panNumber: optionalText(row.pan_no),
      phone: optionalText(row.telephone_no),
      email: optionalText(row.email),
      quarterNumber: optionalText(row.staff_quarter_no),
      nominee: optionalText(row.nominee),
      birthPlace: optionalText(row.birth_place),
      city: optionalText(row.city),
      region: optionalText(row.provence),
      country: optionalText(row.country),
      withdrawalReason: optionalText(row.widhdrawl_reason),
      withdrawalOn: optionalDate(row.widhdrawl_date),
      identityCardNumber: optionalText(row.i_card_no),
      greenBookNumber: optionalText(row.green_book_no),
      remarks: optionalText(row.remark),
    }));
  const events = connection
    .prepare(`SELECT value.*,location.name location_name,reason.name transfer_reason
      FROM staff_designation value
      LEFT JOIN location ON location.id=value.location_id
      LEFT JOIN transfer_reason reason ON reason.id=value.transfer_reason_id
      ORDER BY value.id`)
    .all()
    .map((row) => ({
      id: id("staff_designation", row.id),
      sourceId: text(row.id),
      personId: stablePersonId(organizationSlug, "staff", row.staff_id),
      departmentId: departmentSourceIds.has(text(row.department_id))
        ? id("department", row.department_id)
        : null,
      designationId: designationSourceIds.has(text(row.designation_id))
        ? id("designation", row.designation_id)
        : null,
      legacyDepartmentId: optionalText(row.department_id),
      legacyDesignationId: optionalText(row.designation_id),
      locationName: optionalText(row.location_name),
      effectiveOn: optionalDate(row.date),
      transferReason: optionalText(row.transfer_reason),
      remarks: optionalText(row.remarks),
    }));
  return { departments, designations, categories, profiles, events };
}

function buildSql(data, batchId, importedAt) {
  const organizationId = rawSql(
    `(SELECT id FROM organization WHERE slug=${sqlLiteral(organizationSlug)})`,
  );
  const common = (sourceTable, sourceId) => [
    SOURCE_SYSTEM,
    sourceTable,
    sourceId,
    batchId,
    importedAt,
    importedAt,
    importedAt,
  ];
  const statements = [
    `INSERT INTO staff_import_batch
      (id,organization_id,source_system,source_database,source_fingerprint,status,
       department_count,designation_count,category_count,profile_count,employment_event_count,
       started_at,created_at)
     VALUES (${sqlLiteral(batchId)},${sqlLiteral(organizationId)},${sqlLiteral(SOURCE_SYSTEM)},
       'tibethomes-newer-d1.sqlite',${sqlLiteral(report.source.sha256)},'running',
       ${data.departments.length},${data.designations.length},${data.categories.length},
       ${data.profiles.length},${data.events.length},${sqlLiteral(importedAt)},${sqlLiteral(importedAt)})
     ON CONFLICT(id) DO UPDATE SET status='running',started_at=excluded.started_at,finished_at=NULL`,
  ];

  addRows(
    statements,
    "staff_department",
    ["id", "organization_id", "name", "is_active", ...sourceColumns()],
    data.departments.map((item) => [
      item.id,
      organizationId,
      item.name,
      1,
      ...common("department", item.sourceId),
    ]),
    "name=excluded.name,is_active=excluded.is_active,import_batch_id=excluded.import_batch_id,imported_at=excluded.imported_at,updated_at=excluded.updated_at",
  );
  addRows(
    statements,
    "staff_designation",
    [
      "id",
      "organization_id",
      "department_id",
      "legacy_department_id",
      "name",
      "is_active",
      ...sourceColumns(),
    ],
    data.designations.map((item) => [
      item.id,
      organizationId,
      item.departmentId,
      item.legacyDepartmentId,
      item.name,
      1,
      ...common("designation", item.sourceId),
    ]),
    "department_id=excluded.department_id,legacy_department_id=excluded.legacy_department_id,name=excluded.name,is_active=excluded.is_active,import_batch_id=excluded.import_batch_id,imported_at=excluded.imported_at,updated_at=excluded.updated_at",
  );
  addRows(
    statements,
    "staff_category",
    ["id", "organization_id", "name", "is_active", ...sourceColumns()],
    data.categories.map((item) => [
      item.id,
      organizationId,
      item.name,
      1,
      ...common("staff_category", item.sourceId),
    ]),
    "name=excluded.name,is_active=excluded.is_active,import_batch_id=excluded.import_batch_id,imported_at=excluded.imported_at,updated_at=excluded.updated_at",
  );
  addRows(
    statements,
    "staff_profile",
    [
      "id",
      "organization_id",
      "person_id",
      "department_id",
      "designation_id",
      "category_id",
      "legacy_department_id",
      "legacy_designation_id",
      "permanent_on",
      "spouse_name",
      "settlement_name",
      "allocated_place",
      "mother_name",
      "father_name",
      "address",
      "marital_status",
      "registration_certificate_number",
      "pan_number",
      "phone",
      "email",
      "quarter_number",
      "nominee",
      "birth_place",
      "city",
      "region",
      "country",
      "withdrawal_reason",
      "withdrawal_on",
      "identity_card_number",
      "green_book_number",
      "remarks",
      ...sourceColumns(),
    ],
    data.profiles.map((item) => [
      item.id,
      organizationId,
      item.personId,
      item.departmentId,
      item.designationId,
      item.categoryId,
      item.legacyDepartmentId,
      item.legacyDesignationId,
      item.permanentOn,
      item.spouseName,
      item.settlementName,
      item.allocatedPlace,
      item.motherName,
      item.fatherName,
      item.address,
      item.maritalStatus,
      item.registrationCertificateNumber,
      item.panNumber,
      item.phone,
      item.email,
      item.quarterNumber,
      item.nominee,
      item.birthPlace,
      item.city,
      item.region,
      item.country,
      item.withdrawalReason,
      item.withdrawalOn,
      item.identityCardNumber,
      item.greenBookNumber,
      item.remarks,
      ...common("staff", item.sourceId),
    ]),
    "department_id=excluded.department_id,designation_id=excluded.designation_id,category_id=excluded.category_id,legacy_department_id=excluded.legacy_department_id,legacy_designation_id=excluded.legacy_designation_id,permanent_on=excluded.permanent_on,spouse_name=excluded.spouse_name,settlement_name=excluded.settlement_name,allocated_place=excluded.allocated_place,mother_name=excluded.mother_name,father_name=excluded.father_name,address=excluded.address,marital_status=excluded.marital_status,registration_certificate_number=excluded.registration_certificate_number,pan_number=excluded.pan_number,phone=excluded.phone,email=excluded.email,quarter_number=excluded.quarter_number,nominee=excluded.nominee,birth_place=excluded.birth_place,city=excluded.city,region=excluded.region,country=excluded.country,withdrawal_reason=excluded.withdrawal_reason,withdrawal_on=excluded.withdrawal_on,identity_card_number=excluded.identity_card_number,green_book_number=excluded.green_book_number,remarks=excluded.remarks,import_batch_id=excluded.import_batch_id,imported_at=excluded.imported_at,updated_at=excluded.updated_at",
  );
  addRows(
    statements,
    "staff_employment_event",
    [
      "id",
      "organization_id",
      "person_id",
      "department_id",
      "designation_id",
      "legacy_department_id",
      "legacy_designation_id",
      "location_name",
      "effective_on",
      "transfer_reason",
      "remarks",
      ...sourceColumns(),
    ],
    data.events.map((item) => [
      item.id,
      organizationId,
      item.personId,
      item.departmentId,
      item.designationId,
      item.legacyDepartmentId,
      item.legacyDesignationId,
      item.locationName,
      item.effectiveOn,
      item.transferReason,
      item.remarks,
      ...common("staff_designation", item.sourceId),
    ]),
    "department_id=excluded.department_id,designation_id=excluded.designation_id,legacy_department_id=excluded.legacy_department_id,legacy_designation_id=excluded.legacy_designation_id,location_name=excluded.location_name,effective_on=excluded.effective_on,transfer_reason=excluded.transfer_reason,remarks=excluded.remarks,import_batch_id=excluded.import_batch_id,imported_at=excluded.imported_at,updated_at=excluded.updated_at",
  );
  statements.push(
    `UPDATE staff_import_batch SET status='completed',finished_at=${sqlLiteral(importedAt)}
     WHERE id=${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function addRows(statements, table, columns, rows, update) {
  for (let offset = 0; offset < rows.length; offset += 50) {
    const values = rows
      .slice(offset, offset + 50)
      .map((row) => `(${row.map(sqlLiteral).join(",")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES\n${values}\nON CONFLICT(id) DO UPDATE SET ${update}`,
    );
  }
}

function sourceColumns() {
  return [
    "source_system",
    "source_table",
    "source_id",
    "import_batch_id",
    "imported_at",
    "created_at",
    "updated_at",
  ];
}

function id(table, sourceId) {
  return stableUuid(`tsewa|${organizationSlug}|${table}|${text(sourceId)}`);
}

function assertCounts(data) {
  const actual = {
    staff: data.profiles.length,
    departments: data.departments.length,
    designations: data.designations.length,
    categories: data.categories.length,
    employmentEvents: data.events.length,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (Number(report.inventory[key]) !== value) {
      throw new Error(`Staff import ${key} count ${value} does not match dry run.`);
    }
  }
}

function assertReport(value) {
  if (
    value?.schemaVersion !== 1 ||
    value?.mode !== "staff_operations_dry_run" ||
    value?.privacy?.containsPersonalData !== false
  ) {
    throw new Error("The staff dry-run report is invalid.");
  }
}

async function assertTargetBinding() {
  const configuration = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!configuration.includes(confirmedDatabaseId)) {
    throw new Error("The confirmed database ID is not present in apps/web/wrangler.jsonc.");
  }
  const result = spawnSync("pnpm", ["exec", "wrangler", "d1", "info", "DB"], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || !result.stdout.includes(confirmedDatabaseId)) {
    throw new Error("The live DB binding does not match --confirm-database-id.");
  }
}

function safeError(result) {
  return String(result.stderr || result.stdout || "unknown error")
    .replaceAll(/[\w.+-]+@[\w.-]+/g, "[email]")
    .slice(0, 1_000);
}

function optionalDate(value) {
  const result = optionalText(value);
  if (!result) return null;
  const date = result.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
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

function text(value) {
  return String(value ?? "");
}
