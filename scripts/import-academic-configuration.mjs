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
  stableUuid,
} from "./lib/person-files.mjs";

const root = resolve(import.meta.dirname, "..");
const webRoot = resolve(root, "apps/web");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(root, options.source ?? DEFAULT_SOURCE_DATABASE);
const reportPath = resolve(root, options.report ?? "reports/academic-configuration-dry-run.json");
const target = requiredOption(options, "target");
const slug = requiredOption(options, "organization-slug");
requiredOption(options, "confirm-database-id");
if (!["local", "remote"].includes(target)) throw new Error("--target must be local or remote.");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const before = await stat(sourcePath);
const fingerprint = await sha256File(sourcePath);
if (report.mode !== "academic_configuration_dry_run" || report.source.sha256 !== fingerprint)
  throw new Error("Run a matching academic configuration dry run first.");
const db = new DatabaseSync(sourcePath, { readOnly: true });
db.exec("PRAGMA query_only = ON");
let workspace;
try {
  const rows = readRows(db);
  for (const [key, value] of Object.entries(report.inventory)) {
    if (rows[key]?.length !== value) throw new Error(`Count changed for ${key}.`);
  }
  const importedAt = new Date().toISOString();
  const sql = buildSql(rows, importedAt);
  const after = await stat(sourcePath);
  if (
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    (await sha256File(sourcePath)) !== fingerprint
  )
    throw new Error("The legacy source changed while preparing the import.");
  workspace = await mkdtemp(join(tmpdir(), "tsewa-academic-config-"));
  const sqlPath = join(workspace, "academic-configuration.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || "Wrangler import failed.");
  console.log(
    JSON.stringify({
      target,
      ...Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])),
      sourceUnchanged: true,
    }),
  );
} finally {
  db.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readRows(connection) {
  return {
    subjectTypes: connection
      .prepare("SELECT id,session_id,name FROM subject_type ORDER BY id")
      .all(),
    subjectHeads: connection.prepare("SELECT id,session_id,name FROM stream ORDER BY id").all(),
    gradeTypes: connection.prepare("SELECT id,session_id,name FROM grade_type ORDER BY id").all(),
    grades: connection
      .prepare("SELECT id,name,start_range,end_range,points,grade_type_id FROM grade ORDER BY id")
      .all(),
    subjects: connection
      .prepare("SELECT id,subject_type_id,stream_id,grade_type_id FROM subject ORDER BY id")
      .all(),
    classSubjects: connection
      .prepare(
        "SELECT id,session_id,class_id,subject_id,max_marks,display_order FROM class_subject ORDER BY id",
      )
      .all(),
    assessmentLimits: connection
      .prepare(
        "SELECT id,session_id,class_id,subject_id,assessment_id,max_marks FROM class_subject_assessment ORDER BY id",
      )
      .all(),
  };
}

function buildSql(data, importedAt) {
  const org = rawSql(`(SELECT id FROM organization WHERE slug=${sqlLiteral(slug)})`);
  const id = (table, value) => stableUuid(`tsewa|${slug}|${table}|${String(value)}`);
  const statements = ["PRAGMA foreign_keys=ON"];
  add(
    statements,
    "academic_subject_type",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "name",
      "source_system",
      "source_table",
      "source_id",
      "imported_at",
    ],
    data.subjectTypes.map((x) => [
      id("subject_type", x.id),
      org,
      id("session", 1),
      x.name,
      "THF Office Manager",
      "subject_type",
      String(x.id),
      importedAt,
    ]),
  );
  add(
    statements,
    "academic_subject_head",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "name",
      "source_system",
      "source_table",
      "source_id",
      "imported_at",
    ],
    data.subjectHeads.map((x) => [
      id("stream", x.id),
      org,
      id("session", 1),
      x.name,
      "THF Office Manager",
      "stream",
      String(x.id),
      importedAt,
    ]),
  );
  add(
    statements,
    "academic_grade_type",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "name",
      "source_system",
      "source_table",
      "source_id",
      "imported_at",
    ],
    data.gradeTypes.map((x) => [
      id("grade_type", x.id),
      org,
      id("session", 1),
      x.name,
      "THF Office Manager",
      "grade_type",
      String(x.id),
      importedAt,
    ]),
  );
  add(
    statements,
    "academic_grade",
    [
      "id",
      "organization_id",
      "grade_type_id",
      "name",
      "starts_at",
      "ends_at",
      "points",
      "source_system",
      "source_table",
      "source_id",
      "imported_at",
    ],
    data.grades.map((x) => [
      id("grade", x.id),
      org,
      id("grade_type", x.grade_type_id),
      x.name,
      x.start_range,
      x.end_range,
      x.points,
      "THF Office Manager",
      "grade",
      String(x.id),
      importedAt,
    ]),
  );
  for (const x of data.subjects)
    statements.push(
      `UPDATE academic_subject SET subject_type_id=${sqlLiteral(id("subject_type", x.subject_type_id))},subject_head_id=${sqlLiteral(id("stream", x.stream_id))},grade_type_id=${sqlLiteral(id("grade_type", x.grade_type_id))},updated_at=${sqlLiteral(importedAt)} WHERE id=${sqlLiteral(id("subject", x.id))} AND organization_id=${org.sql}`,
    );
  add(
    statements,
    "academic_class_subject",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "academic_class_id",
      "subject_id",
      "maximum_marks",
      "display_order",
      "source_system",
      "source_table",
      "source_id",
      "imported_at",
    ],
    data.classSubjects.map((x) => [
      id("class_subject", x.id),
      org,
      id("session", x.session_id),
      id("class", x.class_id),
      id("subject", x.subject_id),
      x.max_marks,
      x.display_order,
      "THF Office Manager",
      "class_subject",
      String(x.id),
      importedAt,
    ]),
  );
  add(
    statements,
    "academic_class_subject_assessment",
    [
      "id",
      "organization_id",
      "academic_session_id",
      "academic_class_id",
      "subject_id",
      "assessment_id",
      "maximum_marks",
      "source_system",
      "source_table",
      "source_id",
      "imported_at",
    ],
    data.assessmentLimits.map((x) => [
      id("class_subject_assessment", x.id),
      org,
      id("session", x.session_id),
      id("class", x.class_id),
      id("subject", x.subject_id),
      id("assessment", x.assessment_id),
      x.max_marks,
      "THF Office Manager",
      "class_subject_assessment",
      String(x.id),
      importedAt,
    ]),
  );
  return `${statements.join(";\n")};\n`;
}

function add(statements, table, columns, rows) {
  for (let offset = 0; offset < rows.length; offset += 100) {
    const values = rows
      .slice(offset, offset + 100)
      .map((row) => `(${row.map((value) => value?.sql ?? sqlLiteral(value)).join(",")})`)
      .join(",\n");
    const updates = columns
      .filter((column) => column !== "id" && column !== "organization_id")
      .map((column) => `${column}=excluded.${column}`)
      .join(",");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${values} ON CONFLICT(id) DO UPDATE SET ${updates},updated_at=CURRENT_TIMESTAMP`,
    );
  }
}
