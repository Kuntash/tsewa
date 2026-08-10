import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/historical-results-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const inventory = numbers(
    database
      .prepare(`SELECT
    (SELECT COUNT(*) FROM subject) AS subjects,
    (SELECT COUNT(*) FROM term) AS terms,
    (SELECT COUNT(*) FROM assessment) AS assessments,
    (SELECT COUNT(*) FROM marks) AS markSheets,
    (SELECT COUNT(*) FROM marks_details) AS results`)
      .get(),
  );
  const checks = numbers(
    database
      .prepare(`SELECT
    (SELECT COUNT(*) FROM marks m LEFT JOIN session s ON s.id=m.session_id WHERE s.id IS NULL) AS missingSessions,
    (SELECT COUNT(*) FROM marks m LEFT JOIN subject s ON s.id=m.subject_id WHERE s.id IS NULL) AS missingSubjects,
    (SELECT COUNT(*) FROM marks m LEFT JOIN class c ON c.id=m.class_id WHERE c.id IS NULL) AS missingClasses,
    (SELECT COUNT(*) FROM marks m LEFT JOIN term t ON t.id=m.term_id WHERE t.id IS NULL) AS missingTerms,
    (SELECT COUNT(*) FROM marks_details d LEFT JOIN marks m ON m.id=d.marks_id WHERE m.id IS NULL) AS missingMarkSheets,
    (SELECT COUNT(*) FROM marks_details d LEFT JOIN beneficiary b ON b.id=d.beneficiary_id WHERE b.id IS NULL) AS missingPeople,
    (SELECT COUNT(*) FROM marks_details d LEFT JOIN assessment a ON a.id=d.assessment_id WHERE a.id IS NULL) AS missingAssessments`)
      .get(),
  );
  const sessions = database
    .prepare(`SELECT s.session_year AS name,
    COUNT(DISTINCT m.id) AS markSheets, COUNT(d.id) AS results,
    MIN(date(m.date)) AS firstRecordedOn, MAX(date(m.date)) AS lastRecordedOn
    FROM marks m JOIN session s ON s.id=m.session_id
    LEFT JOIN marks_details d ON d.marks_id=m.id
    GROUP BY s.id,s.session_year ORDER BY s.session_year`)
    .all()
    .map((row) => ({
      name: String(row.name),
      markSheets: Number(row.markSheets),
      results: Number(row.results),
      firstRecordedOn: row.firstRecordedOn,
      lastRecordedOn: row.lastRecordedOn,
    }));
  const laterSessions = Number(
    database
      .prepare(`SELECT COUNT(*) AS count FROM session
    WHERE CAST(session_year AS INTEGER) > 2012`)
      .get().count,
  );
  const laterResultSheets = Number(
    database
      .prepare(`SELECT COUNT(*) AS count FROM marks m
    JOIN session s ON s.id=m.session_id WHERE CAST(s.session_year AS INTEGER) > 2012`)
      .get().count,
  );
  if (Object.values(checks).some(Boolean))
    throw new Error(`Unresolved result links: ${JSON.stringify(checks)}`);

  const report = {
    schemaVersion: 1,
    mode: "historical_results_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: ["subject", "term", "assessment", "marks", "marks_details"],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory,
    linkChecks: checks,
    sessions,
    boundary: {
      laterSessionsInSource: laterSessions,
      resultSheetsAfter2012: laterResultSheets,
      conclusion:
        "The source has later academic sessions, but its marks tables contain records only for sessions 2011 and 2012.",
    },
    proposedPolicy: {
      sessionAssignment:
        "Preserve each source session exactly, including dates outside that session.",
      access: "View only",
      laterYears: "Do not create inferred results for years that have no source rows.",
    },
  };
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  )
    throw new Error("The legacy source changed during the dry run.");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: relative(repositoryRoot, outputPath),
      ...inventory,
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function numbers(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item)]));
}
