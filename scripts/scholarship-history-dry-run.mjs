import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/scholarship-history-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const inventory = numbers(
    database
      .prepare(`SELECT
    (SELECT COUNT(*) FROM scholarship) AS scholarships,
    (SELECT COUNT(*) FROM scholarship_detail) AS annualDetails,
    (SELECT COUNT(*) FROM scholarship_sanction) AS sanctions,
    (SELECT COUNT(*) FROM scholarship_sanction_detail) AS sanctionLines,
    (SELECT COUNT(*) FROM scholarship_advance) AS cityAdvances,
    (SELECT COUNT(*) FROM scholarship_limit) AS limits,
    (SELECT COUNT(*) FROM course) AS courses,
    (SELECT COUNT(*) FROM course_category) AS courseCategories,
    (SELECT COUNT(*) FROM scholarship_head) AS heads`)
      .get(),
  );
  const linkChecks = numbers(
    database
      .prepare(`SELECT
    (SELECT COUNT(*) FROM scholarship value LEFT JOIN beneficiary person ON person.id=value.beneficiary_id WHERE person.id IS NULL) AS scholarshipsWithoutPerson,
    (SELECT COUNT(*) FROM scholarship value LEFT JOIN course ON course.id=value.course_id WHERE course.id IS NULL) AS scholarshipsWithoutCourse,
    (SELECT COUNT(*) FROM scholarship_detail detail LEFT JOIN scholarship value ON value.id=detail.scholarship_id WHERE value.id IS NULL) AS annualDetailsWithoutScholarship,
    (SELECT COUNT(*) FROM scholarship_sanction sanction LEFT JOIN scholarship value ON value.id=sanction.scholarship_id WHERE value.id IS NULL) AS sanctionsWithoutScholarship,
    (SELECT COUNT(*) FROM scholarship_sanction_detail line LEFT JOIN scholarship_sanction sanction ON sanction.id=line.scholarship_sanction_id WHERE sanction.id IS NULL) AS sanctionLinesWithoutSanction,
    (SELECT COUNT(*) FROM scholarship_sanction_detail line LEFT JOIN scholarship_head head ON head.id=line.scholarship_head_id WHERE head.id IS NULL) AS sanctionLinesWithoutHead,
    (SELECT COUNT(*) FROM scholarship_sanction_detail line JOIN scholarship_sanction sanction ON sanction.id=line.scholarship_sanction_id JOIN scholarship value ON value.id=sanction.scholarship_id WHERE value.beneficiary_id<>line.beneficiary_id) AS sanctionLinesWithDifferentPerson`)
      .get(),
  );
  if (linkChecks.scholarshipsWithoutPerson || linkChecks.scholarshipsWithoutCourse)
    throw new Error("Scholarship records have missing required legacy links.");
  if (linkChecks.sanctionsWithoutScholarship || linkChecks.sanctionLinesWithoutHead)
    throw new Error("Scholarship sanctions have missing required legacy links.");

  const rawRanges = database
    .prepare(`SELECT
    (SELECT MIN(admission_year) FROM scholarship) AS firstAdmissionYear,
    (SELECT MAX(admission_year) FROM scholarship) AS lastAdmissionYear,
    (SELECT MIN(substr(date,1,10)) FROM scholarship_sanction) AS firstSanctionOn,
    (SELECT MAX(substr(date,1,10)) FROM scholarship_sanction) AS lastSanctionOn,
    (SELECT SUM(amount) FROM scholarship_sanction) AS sanctionedAmount,
    (SELECT SUM(amount) FROM scholarship_sanction_detail) AS allocatedAmount`)
    .get();
  const ranges = {
    firstAdmissionYear: Number(rawRanges.firstAdmissionYear),
    lastAdmissionYear: Number(rawRanges.lastAdmissionYear),
    firstSanctionOn: rawRanges.firstSanctionOn,
    lastSanctionOn: rawRanges.lastSanctionOn,
    sanctionedAmount: Number(rawRanges.sanctionedAmount),
    allocatedAmount: Number(rawRanges.allocatedAmount),
  };
  const courseCategories = database
    .prepare(`SELECT category.name,COUNT(DISTINCT course.id) AS courses,
    COUNT(value.id) AS scholarships FROM course_category category
    LEFT JOIN course ON course.course_category_id=category.id
    LEFT JOIN scholarship value ON value.course_id=course.id
    GROUP BY category.id,category.name ORDER BY scholarships DESC`)
    .all()
    .map(numbersExceptName);
  const heads = database
    .prepare(`SELECT head.name,COUNT(line.id) AS allocations,
    SUM(line.amount) AS amount FROM scholarship_head head
    LEFT JOIN scholarship_sanction_detail line ON line.scholarship_head_id=head.id
    GROUP BY head.id,head.name ORDER BY allocations DESC`)
    .all()
    .map(numbersExceptName);
  const report = {
    schemaVersion: 1,
    mode: "scholarship_history_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: [
        "course_category",
        "course",
        "scholarship_head",
        "scholarship",
        "scholarship_detail",
        "scholarship_sanction",
        "scholarship_sanction_detail",
        "scholarship_advance",
        "scholarship_limit",
      ],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory,
    linkChecks,
    ranges,
    courseCategories,
    heads,
    proposedPolicy: {
      access: "Require scholarship.read for all records and scholarship.manage for mutations.",
      orphanAnnualDetails:
        "Retain the 12 orphan annual details with their legacy scholarship identifier instead of inventing a link.",
      orphanSanctionLines:
        "Retain the two sanction lines without a parent and their legacy sanction identifier.",
      editing:
        "Imported and new scholarship records remain editable with audit history because the legacy workflows supported correction.",
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
  console.log(JSON.stringify({ report: relative(repositoryRoot, outputPath), ...inventory }));
} finally {
  database.close();
}

function numbers(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item)]));
}
function numbersExceptName(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, key === "name" ? String(item) : Number(item)]),
  );
}
