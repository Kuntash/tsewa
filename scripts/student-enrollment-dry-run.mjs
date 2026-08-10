import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/student-enrollment-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const inventory = row(
    database,
    `WITH ranked AS (
       SELECT beneficiary_class.*,
              ROW_NUMBER() OVER (
                PARTITION BY beneficiary_id, session_id
                ORDER BY date(date) DESC, id DESC
              ) AS session_rank
       FROM beneficiary_class
     ), selected AS (SELECT * FROM ranked WHERE session_rank = 1),
     versions AS (
       SELECT beneficiary_id, session_id, COUNT(*) AS rows,
              COUNT(DISTINCT school_id) AS schools,
              COUNT(DISTINCT class_id) AS classes,
              COUNT(DISTINCT house_id) AS houses,
              COUNT(DISTINCT coalesce(roll_no, '')) AS rolls,
              COUNT(DISTINCT date(date)) AS dates
       FROM beneficiary_class GROUP BY beneficiary_id, session_id
     )
     SELECT
       (SELECT COUNT(*) FROM beneficiary_class) AS sourceRows,
       (SELECT COUNT(*) FROM selected) AS selectedEnrollments,
       (SELECT COUNT(*) FROM beneficiary_class) - (SELECT COUNT(*) FROM selected)
         AS supersededRows,
       (SELECT COUNT(*) FROM versions WHERE rows > 1) AS multirowStudentSessions,
       (SELECT COUNT(*) FROM versions WHERE schools > 1) AS changedSchool,
       (SELECT COUNT(*) FROM versions WHERE classes > 1) AS changedClass,
       (SELECT COUNT(*) FROM versions WHERE houses > 1) AS changedHouse,
       (SELECT COUNT(*) FROM versions WHERE rolls > 1) AS changedRoll,
       (SELECT COUNT(*) FROM versions WHERE dates = 1 AND rows > 1) AS sameDateDuplicates,
       (SELECT COUNT(DISTINCT session_id || '|' || school_id || '|' || class_id)
          FROM selected WHERE school_id IS NOT NULL) AS observedOfferings`,
  );
  const completeness = row(
    database,
    `WITH ranked AS (
       SELECT beneficiary_class.*,
              ROW_NUMBER() OVER (
                PARTITION BY beneficiary_id, session_id
                ORDER BY date(date) DESC, id DESC
              ) AS session_rank
       FROM beneficiary_class
     ), selected AS (SELECT * FROM ranked WHERE session_rank = 1)
     SELECT COUNT(*) AS enrollments,
            SUM(beneficiary.id IS NULL) AS missingPeople,
            SUM(session.id IS NULL) AS missingSessions,
            SUM(class.id IS NULL) AS missingClasses,
            SUM(selected.school_id IS NOT NULL AND school.id IS NULL) AS missingSchools,
            SUM(selected.house_id IS NOT NULL AND school_house.id IS NULL) AS missingSchoolHouses,
            SUM(selected.school_id IS NULL OR school.id IS NULL) AS unmappedSchool,
            SUM(nullif(trim(selected.roll_no), '') IS NULL) AS missingRoll,
            SUM(nullif(trim(selected.result), '') IS NULL) AS missingResult,
            SUM(nullif(trim(selected.board_registration_no), '') IS NULL)
              AS missingBoardRegistration
     FROM selected
     LEFT JOIN beneficiary ON beneficiary.id = selected.beneficiary_id
     LEFT JOIN session ON session.id = selected.session_id
     LEFT JOIN class ON class.id = selected.class_id
     LEFT JOIN school ON school.id = selected.school_id
     LEFT JOIN school_house ON school_house.id = selected.house_id`,
  );
  const sessionRows = rows(
    database,
    `WITH ranked AS (
       SELECT beneficiary_class.*,
              ROW_NUMBER() OVER (
                PARTITION BY beneficiary_id, session_id
                ORDER BY date(date) DESC, id DESC
              ) AS session_rank
       FROM beneficiary_class
     ), selected AS (SELECT * FROM ranked WHERE session_rank = 1)
     SELECT session.session_year AS name, COUNT(selected.id) AS enrollments,
            COUNT(DISTINCT selected.school_id) AS schools,
            COUNT(DISTINCT selected.class_id) AS classes,
            COUNT(DISTINCT CASE WHEN selected.school_id IS NOT NULL
              THEN selected.school_id || '|' || selected.class_id END) AS offerings,
            SUM(CASE WHEN selected.id IS NOT NULL
              AND (selected.school_id IS NULL OR school.id IS NULL)
              THEN 1 ELSE 0 END) AS unmappedSchool
     FROM session
     LEFT JOIN selected ON selected.session_id = session.id
     LEFT JOIN school ON school.id = selected.school_id
     GROUP BY session.id, session.session_year, session.year_from
     ORDER BY date(session.year_from), session.id`,
  );
  const dateReview = row(
    database,
    `WITH ranked AS (
       SELECT beneficiary_class.*,
              ROW_NUMBER() OVER (
                PARTITION BY beneficiary_id, session_id
                ORDER BY date(date) DESC, id DESC
              ) AS session_rank
       FROM beneficiary_class
     ), selected AS (SELECT * FROM ranked WHERE session_rank = 1)
     SELECT SUM(date(selected.date) < date(session.year_from)) AS beforeSession,
            SUM(date(selected.date) > date(session.year_to)) AS afterSession
     FROM selected JOIN session ON session.id = selected.session_id`,
  );

  const report = {
    schemaVersion: 1,
    mode: "student_enrollment_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: {
      classification: "aggregate-only",
      containsPersonalData: false,
      selectedRowValues: false,
    },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: ["beneficiary_class", "beneficiary", "session", "school", "class", "school_house"],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory: numberValues(inventory),
    completeness: numberValues(completeness),
    dateReview: numberValues(dateReview),
    sessions: sessionRows.map((item) => ({
      name: String(item.name),
      enrollments: Number(item.enrollments),
      schools: Number(item.schools),
      classes: Number(item.classes),
      offerings: Number(item.offerings),
      unmappedSchool: Number(item.unmappedSchool),
    })),
    proposedPolicy: {
      selectionRule:
        "One record per person and session: latest source date, breaking same-date ties with greatest source row ID.",
      importedStatus: "recorded",
      importedStatusMeaning:
        "The legacy source records an allocation but does not provide an enrollment lifecycle status.",
      suspiciousDates: "Preserve as source-authoritative and expose for later cleanup.",
      sourceRowsRemainInAcademicHistory: true,
    },
  };

  assertAggregateOnly(report);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed during the enrollment dry run.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
      selectedEnrollments: Number(inventory.selectedEnrollments),
      observedOfferings: Number(inventory.observedOfferings),
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function rows(connection, sql) {
  return connection.prepare(sql).all();
}

function row(connection, sql) {
  return connection.prepare(sql).get();
}

function numberValues(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item)]));
}

function assertAggregateOnly(report) {
  const forbiddenKeys = new Set([
    "displayName",
    "personId",
    "primaryIdentifier",
    "beneficiaryId",
    "rollNumber",
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
