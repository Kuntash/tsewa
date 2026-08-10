import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/class-master-reconciliation.json",
);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const sourceClasses = database
    .prepare(
      `SELECT id, name, title, section, level, class_sort AS sortOrder
       FROM class ORDER BY id`,
    )
    .all()
    .map((item) => ({
      sourceId: Number(item.id),
      sourceName: clean(item.name),
      sourceTitle: clean(item.title),
      sourceSection: cleanSection(item.section),
      sourceLevel: Number(item.level) || null,
      sourceSortOrder: Number(item.sortOrder) || null,
      canonicalName: canonicalName(item),
    }));

  const groups = Map.groupBy(sourceClasses, (item) => item.canonicalName.toLowerCase());
  const mappings = [...groups.values()]
    .map((items) => {
      const chosen = [...items].sort(compareCandidates)[0];
      return {
        canonicalName: chosen.canonicalName,
        canonicalSourceId: chosen.sourceId,
        sourceIds: items.map((item) => item.sourceId),
      };
    })
    .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
  const mergedGroups = mappings.filter((item) => item.sourceIds.length > 1);

  const selectedOfferings = database
    .prepare(
      `WITH ranked AS (
         SELECT beneficiary_class.*,
                ROW_NUMBER() OVER (
                  PARTITION BY beneficiary_id, session_id
                  ORDER BY date(date) DESC, id DESC
                ) AS session_rank
         FROM beneficiary_class
       )
       SELECT session.session_year AS sessionName, ranked.school_id AS schoolSourceId,
              ranked.class_id AS classSourceId
       FROM ranked
       JOIN session ON session.id = ranked.session_id
       WHERE ranked.session_rank = 1 AND ranked.school_id IS NOT NULL
       GROUP BY ranked.session_id, ranked.school_id, ranked.class_id`,
    )
    .all();
  const nameBySourceId = new Map(sourceClasses.map((item) => [item.sourceId, item.canonicalName]));
  const canonicalOfferings = new Set(
    selectedOfferings.map(
      (item) =>
        `${String(item.sessionName)}|${String(item.schoolSourceId)}|${nameBySourceId.get(Number(item.classSourceId))}`,
    ),
  );
  const raw2026 = selectedOfferings.filter((item) => String(item.sessionName) === "2026");
  const canonical2026 = new Set(
    raw2026.map(
      (item) => `${String(item.schoolSourceId)}|${nameBySourceId.get(Number(item.classSourceId))}`,
    ),
  );

  const report = {
    schemaVersion: 1,
    mode: "class_master_reconciliation_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      table: "class",
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    result: {
      sourceClasses: sourceClasses.length,
      canonicalClasses: mappings.length,
      mergedSourceClasses: sourceClasses.length - mappings.length,
      mergedGroups: mergedGroups.length,
      sourceOfferings: selectedOfferings.length,
      canonicalOfferings: canonicalOfferings.size,
      sourceOfferings2026: raw2026.length,
      canonicalOfferings2026: canonical2026.size,
    },
    policy: {
      identity: "Normalized class name, stream, and section",
      sourceRowsPreserved: true,
      sourceIdsHiddenFromDailyUi: true,
    },
    mergedGroups,
  };

  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The source changed during class reconciliation.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
      sourceClasses: sourceClasses.length,
      canonicalClasses: mappings.length,
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function clean(value) {
  return String(value ?? "")
    .trim()
    .replaceAll(/\s+/g, " ");
}

function cleanSection(value) {
  const section = clean(value);
  return /^(none|0|null|n\/a)$/i.test(section) ? "" : section;
}

function canonicalName(item) {
  const title = clean(item.title) || clean(item.name);
  const section = cleanSection(item.section);
  if (!section) return title;
  const comparableTitle = title.replaceAll(/["']/g, "").toLowerCase();
  return comparableTitle.endsWith(section.toLowerCase()) ? title : `${title} ${section}`;
}

function compareCandidates(left, right) {
  return candidateScore(right) - candidateScore(left) || left.sourceId - right.sourceId;
}

function candidateScore(item) {
  const expectedLevel = romanLevel(item.canonicalName);
  return (
    (expectedLevel && item.sourceLevel === expectedLevel ? 100 : 0) +
    (item.sourceTitle ? 20 : 0) +
    (item.sourceSortOrder ? 10 : 0) +
    (item.sourceSection ? 5 : 0)
  );
}

function romanLevel(value) {
  const token = value.match(/^(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\s|$)/)?.[1];
  if (!token) return null;
  const levels = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
    XI: 11,
    XII: 12,
  };
  return levels[token];
}
