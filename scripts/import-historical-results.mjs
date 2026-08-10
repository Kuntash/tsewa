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
  options.report ?? "reports/historical-results-dry-run.json",
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
  throw new Error("The source no longer matches the dry run.");
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
try {
  const data = readData(database);
  assertCounts(data);
  const importedAt = new Date().toISOString();
  const batchId = `historical-results-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildSql(data, batchId, importedAt);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  )
    throw new Error("The legacy source changed while preparing the import.");
  workspace = await mkdtemp(join(tmpdir(), "tsewa-results-import-"));
  const sqlPath = join(workspace, "historical-results.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    {
      cwd: webRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0)
    throw new Error(`Wrangler did not complete the results import: ${safeError(result)}`);
  console.log(
    JSON.stringify({
      target,
      databaseId: confirmedDatabaseId,
      batchId,
      subjects: data.subjects.length,
      terms: data.terms.length,
      assessments: data.assessments.length,
      markSheets: data.markSheets.length,
      results: data.results.length,
      sourceUnchanged: true,
      temporaryPersonalDataRemoved: true,
    }),
  );
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readData(connection) {
  const subjects = connection
    .prepare(
      `SELECT id,session_id,name,alias_name,optional,passing_per,active FROM subject ORDER BY id`,
    )
    .all()
    .map((r) => ({
      id: id("subject", r.id),
      sourceId: text(r.id),
      sessionId: id("session", r.session_id),
      name: requiredText(r.name, "subject name"),
      shortName: optionalText(r.alias_name),
      optional: Number(r.optional) ? 1 : 0,
      passingPercentage: optionalNumber(r.passing_per),
      active: Number(r.active) ? 1 : 0,
    }));
  const terms = connection
    .prepare(`SELECT id,name,active FROM term ORDER BY id`)
    .all()
    .map((r) => ({
      id: id("term", r.id),
      sourceId: text(r.id),
      name: requiredText(r.name, "term name"),
      active: Number(r.active) ? 1 : 0,
    }));
  const assessments = connection
    .prepare(`SELECT id,session_id,term_id,name,active FROM assessment ORDER BY id`)
    .all()
    .map((r) => ({
      id: id("assessment", r.id),
      sourceId: text(r.id),
      sessionId: id("session", r.session_id),
      termId: id("term", r.term_id),
      name: requiredText(r.name, "assessment name"),
      active: Number(r.active) ? 1 : 0,
    }));
  const markSheets = connection
    .prepare(
      `SELECT id,session_id,school_id,class_id,subject_id,term_id,date,verified,sub_max_marks FROM marks ORDER BY id`,
    )
    .all()
    .map((r) => ({
      id: id("marks", r.id),
      sourceId: text(r.id),
      sessionId: id("session", r.session_id),
      schoolId: id("school", r.school_id),
      classId: id("class", r.class_id),
      subjectId: id("subject", r.subject_id),
      termId: id("term", r.term_id),
      recordedOn: optionalText(r.date),
      verified: Number(r.verified) ? 1 : 0,
      maximumMarks: optionalNumber(r.sub_max_marks),
    }));
  const results = connection
    .prepare(
      `SELECT id,marks_id,beneficiary_id,assessment_id,marks,max_marks,marks_description FROM marks_details ORDER BY id`,
    )
    .all()
    .map((r) => ({
      id: id("marks_details", r.id),
      sourceId: text(r.id),
      markSheetId: id("marks", r.marks_id),
      personId: stablePersonId(organizationSlug, "beneficiary", text(r.beneficiary_id)),
      assessmentId: id("assessment", r.assessment_id),
      marks: optionalNumber(r.marks),
      maximumMarks: optionalNumber(r.max_marks),
      note: optionalText(r.marks_description),
    }));
  return { subjects, terms, assessments, markSheets, results };
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
    `INSERT INTO historical_results_import_batch
    (id,organization_id,source_system,source_database,source_fingerprint,status,subject_count,term_count,assessment_count,mark_sheet_count,result_count,started_at,created_at)
    VALUES (${sqlLiteral(batchId)},${organizationId.sql},${sqlLiteral(SOURCE_SYSTEM)},'tibethomes-newer-d1.sqlite',${sqlLiteral(report.source.sha256)},'running',${data.subjects.length},${data.terms.length},${data.assessments.length},${data.markSheets.length},${data.results.length},${sqlLiteral(importedAt)},${sqlLiteral(importedAt)})
    ON CONFLICT(id) DO UPDATE SET status='running',started_at=excluded.started_at,finished_at=NULL`,
  ];
  add(
    statements,
    "academic_subject",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "name",
      "short_name",
      "is_optional",
      "passing_percentage",
      "is_active",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.subjects.map((x) => [
      x.id,
      organizationId,
      x.sessionId,
      x.name,
      x.shortName,
      x.optional,
      x.passingPercentage,
      x.active,
      ...common("subject", x),
    ]),
    30,
  );
  add(
    statements,
    "academic_term",
    [
      "id",
      "organization_id",
      "name",
      "is_active",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.terms.map((x) => [x.id, organizationId, x.name, x.active, ...common("term", x)]),
    30,
  );
  add(
    statements,
    "academic_assessment",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "term_id",
      "name",
      "is_active",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.assessments.map((x) => [
      x.id,
      organizationId,
      x.sessionId,
      x.termId,
      x.name,
      x.active,
      ...common("assessment", x),
    ]),
    30,
  );
  add(
    statements,
    "mark_sheet",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "school_id",
      "academic_class_id",
      "subject_id",
      "term_id",
      "recorded_on",
      "is_verified",
      "maximum_marks",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.markSheets.map((x) => [
      x.id,
      organizationId,
      x.sessionId,
      x.schoolId,
      x.classId,
      x.subjectId,
      x.termId,
      x.recordedOn,
      x.verified,
      x.maximumMarks,
      ...common("marks", x),
    ]),
    25,
  );
  add(
    statements,
    "student_mark",
    [
      "id",
      "organization_id",
      "mark_sheet_id",
      "person_id",
      "assessment_id",
      "marks",
      "maximum_marks",
      "note",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.results.map((x) => [
      x.id,
      organizationId,
      x.markSheetId,
      x.personId,
      x.assessmentId,
      x.marks,
      x.maximumMarks,
      x.note,
      ...common("marks_details", x),
    ]),
    50,
  );
  statements.push(
    `UPDATE historical_results_import_batch SET status='completed',finished_at=${sqlLiteral(importedAt)} WHERE id=${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function add(statements, table, columns, rows, chunkSize) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const values = rows
      .slice(index, index + chunkSize)
      .map((row) => `(${row.map(sqlValue).join(",")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES\n${values}\nON CONFLICT(organization_id,source_system,source_table,source_id) DO UPDATE SET import_batch_id=excluded.import_batch_id,imported_at=excluded.imported_at,updated_at=excluded.updated_at`,
    );
  }
}
function sqlValue(value) {
  return value && typeof value === "object" && "sql" in value ? value.sql : sqlLiteral(value);
}
function id(table, sourceId) {
  return stableUuid(`tsewa|${organizationSlug}|${table}|${text(sourceId)}`);
}
function text(value) {
  return String(value);
}
function requiredText(value, label) {
  const result = optionalText(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}
function optionalText(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}
function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid number ${value}`);
  return n;
}
function assertCounts(data) {
  for (const [key, expected] of Object.entries(report.inventory))
    if (data[key]?.length !== Number(expected))
      throw new Error(`${key} count does not match dry run.`);
}
function assertReport(value) {
  if (
    value?.mode !== "historical_results_dry_run" ||
    value?.privacy?.containsPersonalData !== false ||
    Object.values(value?.linkChecks ?? {}).some(Number)
  )
    throw new Error("The reviewed results dry run has not cleared import gates.");
}
function safeError(result) {
  return (
    `${result.stdout}\n${result.stderr}`
      .split("\n")
      .filter((line) => /error|failed|constraint|no such/i.test(line))
      .slice(-4)
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
