import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/school-operations-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const sessions = rows(
    database,
    `SELECT session.id AS sourceSessionId,
            session.session_year AS sessionName,
            date(session.year_from) AS startsOn,
            date(session.year_to) AS endsOn,
            COUNT(beneficiary_class.id) AS academicRows,
            COUNT(DISTINCT beneficiary_class.beneficiary_id) AS people
     FROM session
     LEFT JOIN beneficiary_class ON beneficiary_class.session_id = session.id
     GROUP BY session.id, session.session_year, session.year_from, session.year_to
     ORDER BY date(session.year_from), session.id`,
  );
  const core = row(
    database,
    `SELECT COUNT(*) AS academicRows,
            COUNT(DISTINCT beneficiary_id) AS peopleWithAcademicHistory,
            COUNT(DISTINCT session_id) AS referencedSessions,
            COUNT(DISTINCT school_id) AS referencedSchools,
            COUNT(DISTINCT class_id) AS referencedClasses,
            COUNT(DISTINCT house_id) AS referencedSchoolHouses
     FROM beneficiary_class`,
  );
  const masters = row(
    database,
    `SELECT (SELECT COUNT(*) FROM session) AS sessions,
            (SELECT COUNT(*) FROM school) AS schools,
            (SELECT COUNT(*) FROM class) AS classes,
            (SELECT COUNT(*) FROM house) AS houses,
            (SELECT COUNT(*) FROM school_house) AS schoolHouseLinks`,
  );
  const reconciliation = row(
    database,
    `SELECT
       SUM(beneficiary.id IS NULL) AS missingPeople,
       SUM(class.id IS NULL) AS missingClasses,
       SUM(session.id IS NULL) AS missingSessions,
       SUM(school.id IS NULL) AS missingSchools,
       SUM(beneficiary_class.house_id IS NOT NULL AND school_house.id IS NULL) AS missingSchoolHouses
     FROM beneficiary_class
     LEFT JOIN beneficiary ON beneficiary.id = beneficiary_class.beneficiary_id
     LEFT JOIN class ON class.id = beneficiary_class.class_id
     LEFT JOIN session ON session.id = beneficiary_class.session_id
     LEFT JOIN school ON school.id = beneficiary_class.school_id
     LEFT JOIN school_house ON school_house.id = beneficiary_class.house_id`,
  );
  const currentSession = row(
    database,
    `WITH selected_session AS (
       SELECT id, session_year, date(year_from) AS startsOn, date(year_to) AS endsOn
       FROM session ORDER BY date(year_from) DESC, id DESC LIMIT 1
     ), ranked AS (
       SELECT beneficiary_class.*,
              ROW_NUMBER() OVER (
                PARTITION BY beneficiary_class.beneficiary_id
                ORDER BY date(beneficiary_class.date) DESC, beneficiary_class.id DESC
              ) AS rank
       FROM beneficiary_class
       JOIN selected_session ON selected_session.id = beneficiary_class.session_id
     )
     SELECT selected_session.session_year AS name,
            selected_session.startsOn,
            selected_session.endsOn,
            COUNT(ranked.id) AS academicRows,
            COUNT(DISTINCT ranked.beneficiary_id) AS students,
            COUNT(DISTINCT CASE WHEN ranked.rank = 1 THEN ranked.school_id END) AS schools,
            COUNT(DISTINCT CASE WHEN ranked.rank = 1 THEN ranked.class_id END) AS classes,
            COUNT(DISTINCT CASE WHEN ranked.rank = 1 THEN ranked.house_id END) AS schoolHouses,
            SUM(CASE WHEN ranked.rank > 1 THEN 1 ELSE 0 END) AS supersededSameSessionRows
     FROM selected_session LEFT JOIN ranked ON 1 = 1`,
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
      tables: ["session", "school", "class", "house", "school_house", "beneficiary_class"],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory: {
      academicRows: Number(core.academicRows),
      peopleWithAcademicHistory: Number(core.peopleWithAcademicHistory),
      referencedSessions: Number(core.referencedSessions),
      referencedSchools: Number(core.referencedSchools),
      referencedClasses: Number(core.referencedClasses),
      referencedSchoolHouses: Number(core.referencedSchoolHouses),
      masterCounts: numberValues(masters),
      sessions: sessions.map((session) => ({
        sourceSessionId: Number(session.sourceSessionId),
        name: String(session.sessionName),
        startsOn: String(session.startsOn),
        endsOn: String(session.endsOn),
        academicRows: Number(session.academicRows),
        people: Number(session.people),
      })),
      latestSession: {
        name: String(currentSession.name),
        startsOn: String(currentSession.startsOn),
        endsOn: String(currentSession.endsOn),
        academicRows: Number(currentSession.academicRows),
        students: Number(currentSession.students),
        schools: Number(currentSession.schools),
        classes: Number(currentSession.classes),
        schoolHouses: Number(currentSession.schoolHouses),
        supersededSameSessionRows: Number(currentSession.supersededSameSessionRows),
      },
    },
    reconciliation: numberValues(reconciliation),
    proposedPolicy: {
      sessionIsSecurityBoundary: false,
      organizationIsSecurityBoundary: true,
      peopleRegistrySessionScoped: false,
      schoolOperationsSessionScoped: true,
      latestRecordRule: "Latest source date, breaking same-date ties with greatest source row ID.",
    },
  };

  assertAggregateOnly(report);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed during the School Operations dry run.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
      sessions: Number(masters.sessions),
      academicRows: Number(core.academicRows),
      latestSessionStudents: Number(currentSession.students),
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function rows(databaseConnection, sql) {
  return databaseConnection.prepare(sql).all();
}

function row(databaseConnection, sql) {
  return databaseConnection.prepare(sql).get();
}

function numberValues(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item)]));
}

function assertAggregateOnly(report) {
  const forbiddenKeys = new Set([
    "displayName",
    "personId",
    "primaryIdentifier",
    "fileName",
    "label",
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
