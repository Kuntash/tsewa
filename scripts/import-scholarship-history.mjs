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
  options.report ?? "reports/scholarship-history-dry-run.json",
);
const target = requiredOption(options, "target");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");
if (!["local", "remote"].includes(target)) throw new Error("--target must be local or remote.");

await assertTargetBinding();
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertReport(report);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
if (sourceFingerprint !== report.source.sha256)
  throw new Error("The source no longer matches the reviewed dry run.");
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");
let workspace;
try {
  const data = readData(database);
  assertCounts(data);
  const importedAt = new Date().toISOString();
  const batchId = `scholarship-history-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildSql(data, batchId, importedAt);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  )
    throw new Error("The legacy source changed while preparing the import.");
  workspace = await mkdtemp(join(tmpdir(), "tsewa-scholarship-import-"));
  const sqlPath = join(workspace, "scholarship-history.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0)
    throw new Error(`Wrangler did not complete the scholarship import: ${safeError(result)}`);
  console.log(
    JSON.stringify({
      target,
      databaseId: confirmedDatabaseId,
      batchId,
      ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])),
      sourceUnchanged: true,
      temporaryPersonalDataRemoved: true,
    }),
  );
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readData(connection) {
  const courseCategories = connection
    .prepare("SELECT id,name FROM course_category ORDER BY id")
    .all()
    .map((row) => ({
      id: id("course_category", row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, "course category"),
    }));
  const courses = connection
    .prepare("SELECT id,course_name,course_category_id FROM course ORDER BY id")
    .all()
    .map((row) => ({
      id: id("course", row.id),
      sourceId: text(row.id),
      categoryId:
        row.course_category_id == null ? null : id("course_category", row.course_category_id),
      name: requiredText(row.course_name, "course"),
    }));
  const heads = connection
    .prepare("SELECT id,name FROM scholarship_head ORDER BY id")
    .all()
    .map((row) => ({
      id: id("scholarship_head", row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, "scholarship head"),
    }));
  const scholarships = connection
    .prepare(
      `SELECT value.*,gender.sex AS gender_name,city.city_name,category.name AS category_name,
      beneficiary.name AS beneficiary_name,beneficiary.admission_no AS beneficiary_admission_no
      FROM scholarship value JOIN beneficiary ON beneficiary.id=value.beneficiary_id
      LEFT JOIN gender ON gender.id=value.gender_id LEFT JOIN city ON city.id=value.city_id
      LEFT JOIN child_category category ON category.id=value.category_id ORDER BY value.id`,
    )
    .all()
    .map((row) => {
      const scholarshipName = requiredText(row.name, "scholarship student name");
      const scholarshipAdmission = optionalText(row.admision_no);
      return {
        id: id("scholarship", row.id),
        sourceId: text(row.id),
        personId: stablePersonId(organizationSlug, "beneficiary", row.beneficiary_id),
        sessionId: optionalId("session", row.session_id),
        courseId: id("course", row.course_id),
        beneficiaryCategory: optionalText(row.category_name),
        studentName: /^\d+(?:\s|$)/.test(scholarshipName)
          ? requiredText(row.beneficiary_name, "beneficiary name")
          : scholarshipName,
        admissionNumber:
          scholarshipAdmission === "0"
            ? optionalText(row.beneficiary_admission_no)
            : scholarshipAdmission,
        fatherName: optionalText(row.father_name),
        gender: gender(row.gender_name),
        dateOfBirth: optionalDate(row.dob),
        classStream: optionalText(row.class_stream),
        classPercentage: optionalNumber(row.class_percentage),
        admissionYear: optionalInteger(row.admission_year),
        courseDuration: optionalText(row.course_duration),
        collegeTraining: booleanNumber(row.college_training),
        cityName: optionalText(row.city_name),
        permanentAddress: optionalText(row.permanent_address),
        mailingAddress: optionalText(row.mailing_address),
        specialAllowance: booleanNumber(row.special_alowence),
        scholarshipAwarded: optionalNumber(row.scholarship_awarded),
        instituteName: optionalText(row.insttitute_name),
        bankAccountNumber: optionalText(row.bank_account_no),
        wardHealthRecord: optionalText(row.ward_health_record),
        needyCase: optionalText(row.needy_case),
        reason: optionalText(row.reason),
        status: Number(row.status) === 1 ? "active" : "closed",
        phone: optionalText(row.phone),
        ledgerNumber: optionalText(row.ledger_no),
      };
    });
  const legacyScholarshipIds = new Set(scholarships.map((item) => item.sourceId));
  const annualDetails = connection
    .prepare("SELECT * FROM scholarship_detail ORDER BY id")
    .all()
    .map((row) => ({
      id: id("scholarship_detail", row.id),
      sourceId: text(row.id),
      scholarshipId: legacyScholarshipIds.has(text(row.scholarship_id))
        ? id("scholarship", row.scholarship_id)
        : null,
      legacyScholarshipId: optionalText(row.scholarship_id),
      sessionId: optionalId("session", row.session_id),
      studyYear: optionalText(row.year) ?? "Not recorded",
      passed: booleanNumber(row.pass_fail),
      percentage: optionalNumber(row.percentage),
      division: optionalText(row.division),
      fees: optionalNumber(row.fees),
      remarks: optionalText(row.remarks),
    }));
  const sanctions = connection
    .prepare("SELECT * FROM scholarship_sanction ORDER BY id")
    .all()
    .map((row) => ({
      id: id("scholarship_sanction", row.id),
      sourceId: text(row.id),
      scholarshipId: id("scholarship", row.scholarship_id),
      sessionId: optionalId("session", row.session_id),
      amount: requiredNumber(row.amount, "sanction amount"),
      sanctionedOn: requiredDate(row.date, "sanction date"),
      periodFrom: optionalDate(row.date_from),
      periodTo: optionalDate(row.date_to),
      paymentReference: optionalText(row.cheque_dd),
      inFavourOf: optionalText(row.in_favour_of),
      remarks: optionalText(row.remarks),
    }));
  const legacySanctionIds = new Set(sanctions.map((item) => item.sourceId));
  const sanctionLines = connection
    .prepare(
      `SELECT line.*,sanction.scholarship_id AS parent_scholarship_id,city.city_name FROM scholarship_sanction_detail line LEFT JOIN scholarship_sanction sanction ON sanction.id=line.scholarship_sanction_id LEFT JOIN city ON city.id=line.city_id ORDER BY line.id`,
    )
    .all()
    .map((row) => ({
      id: id("scholarship_sanction_detail", row.id),
      sourceId: text(row.id),
      sanctionId: legacySanctionIds.has(text(row.scholarship_sanction_id))
        ? id("scholarship_sanction", row.scholarship_sanction_id)
        : null,
      scholarshipId:
        row.parent_scholarship_id == null ? null : id("scholarship", row.parent_scholarship_id),
      personId: stablePersonId(organizationSlug, "beneficiary", row.beneficiary_id),
      headId: id("scholarship_head", row.scholarship_head_id),
      cityName: optionalText(row.city_name),
      amount: requiredNumber(row.amount, "sanction line amount"),
      advanceOn: optionalDate(row.advance_date),
      legacySanctionId: optionalText(row.scholarship_sanction_id),
    }));
  const cityAdvances = connection
    .prepare(
      "SELECT value.*,city.city_name FROM scholarship_advance value LEFT JOIN city ON city.id=value.city_id ORDER BY value.id",
    )
    .all()
    .map((row) => ({
      id: id("scholarship_advance", row.id),
      sourceId: text(row.id),
      sessionId: optionalId("session", row.session_id),
      cityName: optionalText(row.city_name) ?? `Legacy city ${text(row.city_id)}`,
      amount: requiredNumber(row.amount, "city advance amount"),
    }));
  const limits = connection
    .prepare("SELECT * FROM scholarship_limit ORDER BY id")
    .all()
    .map((row) => ({
      id: id("scholarship_limit", row.id),
      sourceId: text(row.id),
      courseGroup: requiredText(row.course, "limit course group"),
      headName: requiredText(row.head, "limit head"),
      amount: optionalNumber(row.amount),
    }));
  return {
    courseCategories,
    courses,
    heads,
    scholarships,
    annualDetails,
    sanctions,
    sanctionLines,
    cityAdvances,
    limits,
  };
}

function buildSql(data, batchId, importedAt) {
  const organizationId = rawSql(
    `(SELECT id FROM organization WHERE slug=${sqlLiteral(organizationSlug)})`,
  );
  const common = (table, item) => [
    SOURCE_SYSTEM,
    table,
    item.sourceId,
    batchId,
    importedAt,
    importedAt,
    importedAt,
  ];
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO scholarship_import_batch (id,organization_id,source_system,source_database,source_fingerprint,status,scholarship_count,annual_detail_count,sanction_count,sanction_line_count,started_at,created_at) VALUES (${sqlLiteral(batchId)},${organizationId.sql},${sqlLiteral(SOURCE_SYSTEM)},'tibethomes-newer-d1.sqlite',${sqlLiteral(report.source.sha256)},'running',${data.scholarships.length},${data.annualDetails.length},${data.sanctions.length},${data.sanctionLines.length},${sqlLiteral(importedAt)},${sqlLiteral(importedAt)}) ON CONFLICT(id) DO UPDATE SET status='running',started_at=excluded.started_at,finished_at=NULL`,
  ];
  const source = [
    "source_system",
    "source_table",
    "source_id",
    "import_batch_id",
    "imported_at",
    "created_at",
    "updated_at",
  ];
  add(
    statements,
    "scholarship_course_category",
    ["id", "organization_id", "name", "is_active", ...source],
    data.courseCategories.map((x) => [
      x.id,
      organizationId,
      x.name,
      1,
      ...common("course_category", x),
    ]),
  );
  add(
    statements,
    "scholarship_course",
    ["id", "organization_id", "category_id", "name", "is_active", ...source],
    data.courses.map((x) => [
      x.id,
      organizationId,
      x.categoryId,
      x.name,
      1,
      ...common("course", x),
    ]),
  );
  add(
    statements,
    "scholarship_head",
    ["id", "organization_id", "name", "is_active", ...source],
    data.heads.map((x) => [x.id, organizationId, x.name, 1, ...common("scholarship_head", x)]),
  );
  add(
    statements,
    "scholarship_record",
    [
      "id",
      "organization_id",
      "person_id",
      "academic_session_id",
      "course_id",
      "beneficiary_category",
      "student_name",
      "admission_number",
      "father_name",
      "gender",
      "date_of_birth",
      "class_stream",
      "class_percentage",
      "admission_year",
      "course_duration",
      "college_training",
      "city_name",
      "permanent_address",
      "mailing_address",
      "special_allowance",
      "scholarship_awarded",
      "institute_name",
      "bank_account_number",
      "ward_health_record",
      "needy_case",
      "reason",
      "status",
      "phone",
      "ledger_number",
      ...source,
    ],
    data.scholarships.map((x) => [
      x.id,
      organizationId,
      x.personId,
      x.sessionId,
      x.courseId,
      x.beneficiaryCategory,
      x.studentName,
      x.admissionNumber,
      x.fatherName,
      x.gender,
      x.dateOfBirth,
      x.classStream,
      x.classPercentage,
      x.admissionYear,
      x.courseDuration,
      x.collegeTraining,
      x.cityName,
      x.permanentAddress,
      x.mailingAddress,
      x.specialAllowance,
      x.scholarshipAwarded,
      x.instituteName,
      x.bankAccountNumber,
      x.wardHealthRecord,
      x.needyCase,
      x.reason,
      x.status,
      x.phone,
      x.ledgerNumber,
      ...common("scholarship", x),
    ]),
  );
  add(
    statements,
    "scholarship_annual_detail",
    [
      "id",
      "organization_id",
      "scholarship_id",
      "academic_session_id",
      "legacy_scholarship_id",
      "study_year",
      "passed",
      "percentage",
      "division",
      "fees",
      "remarks",
      ...source,
    ],
    data.annualDetails.map((x) => [
      x.id,
      organizationId,
      x.scholarshipId,
      x.sessionId,
      x.legacyScholarshipId,
      x.studyYear,
      x.passed,
      x.percentage,
      x.division,
      x.fees,
      x.remarks,
      ...common("scholarship_detail", x),
    ]),
  );
  add(
    statements,
    "scholarship_sanction",
    [
      "id",
      "organization_id",
      "scholarship_id",
      "academic_session_id",
      "amount",
      "sanctioned_on",
      "period_from",
      "period_to",
      "payment_reference",
      "in_favour_of",
      "remarks",
      ...source,
    ],
    data.sanctions.map((x) => [
      x.id,
      organizationId,
      x.scholarshipId,
      x.sessionId,
      x.amount,
      x.sanctionedOn,
      x.periodFrom,
      x.periodTo,
      x.paymentReference,
      x.inFavourOf,
      x.remarks,
      ...common("scholarship_sanction", x),
    ]),
  );
  add(
    statements,
    "scholarship_sanction_line",
    [
      "id",
      "organization_id",
      "sanction_id",
      "scholarship_id",
      "person_id",
      "head_id",
      "city_name",
      "amount",
      "advance_on",
      "legacy_sanction_id",
      ...source,
    ],
    data.sanctionLines.map((x) => [
      x.id,
      organizationId,
      x.sanctionId,
      x.scholarshipId,
      x.personId,
      x.headId,
      x.cityName,
      x.amount,
      x.advanceOn,
      x.legacySanctionId,
      ...common("scholarship_sanction_detail", x),
    ]),
  );
  add(
    statements,
    "scholarship_city_advance",
    ["id", "organization_id", "academic_session_id", "city_name", "amount", ...source],
    data.cityAdvances.map((x) => [
      x.id,
      organizationId,
      x.sessionId,
      x.cityName,
      x.amount,
      ...common("scholarship_advance", x),
    ]),
  );
  add(
    statements,
    "scholarship_limit",
    ["id", "organization_id", "course_group", "head_name", "amount", "is_active", ...source],
    data.limits.map((x) => [
      x.id,
      organizationId,
      x.courseGroup,
      x.headName,
      x.amount,
      1,
      ...common("scholarship_limit", x),
    ]),
  );
  statements.push(
    `UPDATE scholarship_import_batch SET status='completed',finished_at=${sqlLiteral(importedAt)} WHERE id=${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function add(statements, table, columns, rows, chunkSize = 25) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const values = rows
      .slice(index, index + chunkSize)
      .map((row) => `(${row.map(sqlValue).join(",")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES\n${values}\nON CONFLICT(organization_id,source_system,source_table,source_id) DO UPDATE SET ${columns
        .filter(
          (column) =>
            ![
              "id",
              "organization_id",
              "source_system",
              "source_table",
              "source_id",
              "created_at",
            ].includes(column),
        )
        .map((column) => `${column}=excluded.${column}`)
        .join(",")}`,
    );
  }
}
function sqlValue(value) {
  return value && typeof value === "object" && "sql" in value ? value.sql : sqlLiteral(value);
}
function id(table, sourceId) {
  return stableUuid(`tsewa|${organizationSlug}|${table}|${text(sourceId)}`);
}
function optionalId(table, value) {
  return value == null ? null : id(table, value);
}
function text(value) {
  return String(value);
}
function optionalText(value) {
  return value == null ? null : String(value).trim() || null;
}
function requiredText(value, label) {
  const result = optionalText(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}
function optionalNumber(value) {
  if (value == null || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid number ${value}`);
  return result;
}
function requiredNumber(value, label) {
  const result = optionalNumber(value);
  if (result == null) throw new Error(`Missing ${label}.`);
  return result;
}
function optionalInteger(value) {
  const result = optionalNumber(value);
  return result == null ? null : Math.trunc(result);
}
function booleanNumber(value) {
  return Number(value) ? 1 : 0;
}
function optionalDate(value) {
  return optionalText(value)?.slice(0, 10) ?? null;
}
function requiredDate(value, label) {
  const result = optionalDate(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}
function gender(value) {
  const normalized = optionalText(value)?.toLowerCase();
  return normalized === "m" ? "male" : normalized === "f" ? "female" : null;
}
function assertCounts(data) {
  for (const [key, expected] of Object.entries(report.inventory)) {
    const mapping = {
      scholarships: "scholarships",
      annualDetails: "annualDetails",
      sanctions: "sanctions",
      sanctionLines: "sanctionLines",
      cityAdvances: "cityAdvances",
      limits: "limits",
      courses: "courses",
      courseCategories: "courseCategories",
      heads: "heads",
    }[key];
    if (mapping && data[mapping].length !== Number(expected))
      throw new Error(`${key} count does not match dry run.`);
  }
}
function assertReport(value) {
  if (
    value?.mode !== "scholarship_history_dry_run" ||
    value?.schemaVersion !== 1 ||
    value?.privacy?.containsPersonalData !== false ||
    Number(value?.linkChecks?.scholarshipsWithoutPerson) ||
    Number(value?.linkChecks?.scholarshipsWithoutCourse) ||
    Number(value?.linkChecks?.sanctionsWithoutScholarship) ||
    Number(value?.linkChecks?.sanctionLinesWithoutHead)
  )
    throw new Error("The reviewed scholarship dry run has not cleared import gates.");
}
function safeError(result) {
  return (
    `${result.stdout}\n${result.stderr}`
      .split("\n")
      .filter((line) => /error|failed|constraint|no such/i.test(line))
      .slice(-5)
      .join(" | ") || `exit ${result.status}`
  );
}
async function assertTargetBinding() {
  const config = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!config.includes(confirmedDatabaseId))
    throw new Error("The confirmed D1 target is not configured.");
  if (target === "local") return;
  const result = spawnSync("pnpm", ["exec", "wrangler", "d1", "info", "DB"], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || !result.stdout.includes(confirmedDatabaseId))
    throw new Error("The live D1 binding does not match the confirmed database.");
}
