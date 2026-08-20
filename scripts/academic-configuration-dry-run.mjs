import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const root = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(root, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(root, options.output ?? "reports/academic-configuration-dry-run.json");
const before = await stat(sourcePath);
const fingerprint = await sha256File(sourcePath);
const db = new DatabaseSync(sourcePath, { readOnly: true });
db.exec("PRAGMA query_only = ON");

try {
  const inventory = numbers(
    db
      .prepare(`SELECT
    (SELECT COUNT(*) FROM subject_type) subjectTypes,
    (SELECT COUNT(*) FROM stream) subjectHeads,
    (SELECT COUNT(*) FROM grade_type) gradeTypes,
    (SELECT COUNT(*) FROM grade) grades,
    (SELECT COUNT(*) FROM subject) subjects,
    (SELECT COUNT(*) FROM class_subject) classSubjects,
    (SELECT COUNT(*) FROM class_subject_assessment) assessmentLimits`)
      .get(),
  );
  const links = numbers(
    db
      .prepare(`SELECT
    (SELECT COUNT(*) FROM subject s LEFT JOIN subject_type x ON x.id=s.subject_type_id WHERE x.id IS NULL) missingSubjectTypes,
    (SELECT COUNT(*) FROM subject s LEFT JOIN stream x ON x.id=s.stream_id WHERE x.id IS NULL) missingSubjectHeads,
    (SELECT COUNT(*) FROM subject s LEFT JOIN grade_type x ON x.id=s.grade_type_id WHERE x.id IS NULL) missingSubjectGradeTypes,
    (SELECT COUNT(*) FROM grade g LEFT JOIN grade_type x ON x.id=g.grade_type_id WHERE x.id IS NULL) missingGradeTypes,
    (SELECT COUNT(*) FROM class_subject x LEFT JOIN subject s ON s.id=x.subject_id WHERE s.id IS NULL) missingClassSubjects,
    (SELECT COUNT(*) FROM class_subject x LEFT JOIN class c ON c.id=x.class_id WHERE c.id IS NULL) missingClasses,
    (SELECT COUNT(*) FROM class_subject_assessment x LEFT JOIN assessment a ON a.id=x.assessment_id WHERE a.id IS NULL) missingAssessments`)
      .get(),
  );
  if (Object.values(links).some(Boolean))
    throw new Error(`Unresolved configuration links: ${JSON.stringify(links)}`);
  const report = {
    schemaVersion: 1,
    mode: "academic_configuration_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      sha256: fingerprint,
      sizeBytes: before.size,
      openedReadOnly: true,
    },
    inventory,
    linkChecks: links,
    policy: {
      subjectHead:
        "Preserve the legacy stream table under its user-facing ASP.NET label, Subject Head.",
      mapping:
        "Preserve class subject order, class maximum marks, and assessment-specific maximum marks exactly.",
      catalogSession:
        "Attach the recovered catalog to session 2011, the only session containing subjects and class mappings; legacy zero and mismatched catalog session values were global defaults used by those subjects.",
      evaluationType:
        "Excluded because the recovered database contains no evaluation-type table or populated rows.",
    },
  };
  const after = await stat(sourcePath);
  if (
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    (await sha256File(sourcePath)) !== fingerprint
  )
    throw new Error("The legacy source changed during the dry run.");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({ report: relative(root, outputPath), ...inventory, sourceUnchanged: true }),
  );
} finally {
  db.close();
}

function numbers(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item)]));
}
