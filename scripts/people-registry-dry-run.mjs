import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const argumentsByName = parseArguments(process.argv.slice(2));
const sourcePath = resolve(
  repositoryRoot,
  argumentsByName.source ?? "../data-migration/d1/tibethomes-newer-d1.sqlite",
);
const outputPath = resolve(
  repositoryRoot,
  argumentsByName.output ?? "reports/people-registry-dry-run.json",
);
const today = new Date().toISOString().slice(0, 10);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });

database.exec("PRAGMA query_only = ON");

try {
  const coreCounts = {
    child: scalar(database, "SELECT COUNT(*) AS count FROM beneficiary WHERE type = 0"),
    elderly: scalar(database, "SELECT COUNT(*) AS count FROM beneficiary WHERE type = 1"),
    staff: scalar(database, "SELECT COUNT(*) AS count FROM staff"),
  };

  const sources = [
    analyzeSource(database, beneficiaryDefinition(today)),
    analyzeSource(database, staffDefinition(today)),
  ];
  const sourceCount = Object.values(coreCounts).reduce((total, count) => total + count, 0);
  const eligibleCount = sources.reduce((total, source) => total + source.eligibleCount, 0);
  const blockedCount = sourceCount - eligibleCount;
  const errorCount = sources.reduce((total, source) => total + source.errorCount, 0);
  const warningCount = sources.reduce((total, source) => total + source.warningCount, 0);
  const expectedSourceCount = 9_072;
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
      repositoryRelativeLocation: normalizePath(relative(repositoryRoot, sourcePath)),
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    reconciliation: {
      expectedSourceCount,
      sourceCount,
      sourceCountMatches: sourceCount === expectedSourceCount,
      eligibleCount,
      blockedCount,
      errorCount,
      warningCount,
      issueCount: errorCount + warningCount,
      importedCount: 0,
    },
    coreCounts,
    sources,
  };

  assertAggregateOnly(report);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== sourceFingerprint
  ) {
    throw new Error("The legacy source changed while the read-only dry-run was executing.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      report: normalizePath(relative(repositoryRoot, outputPath)),
      sourceCount,
      eligibleCount,
      blockedCount,
      errorCount,
      warningCount,
      issueCount: errorCount + warningCount,
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function beneficiaryDefinition(currentDate) {
  return {
    table: "beneficiary",
    countSql: "SELECT COUNT(*) AS count FROM beneficiary",
    eligibleSql: `
      WITH duplicate_ids AS (
        SELECT id FROM beneficiary WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
      ),
      duplicate_identifiers AS (
        SELECT admission_no FROM beneficiary
        WHERE admission_no IS NOT NULL AND trim(CAST(admission_no AS TEXT)) <> ''
        GROUP BY admission_no HAVING COUNT(*) > 1
      )
      SELECT COUNT(*) AS count
      FROM beneficiary AS source
      LEFT JOIN duplicate_ids ON duplicate_ids.id = source.id
      LEFT JOIN duplicate_identifiers
        ON duplicate_identifiers.admission_no = source.admission_no
      WHERE source.id IS NOT NULL
        AND duplicate_ids.id IS NULL
        AND source.type IN (0, 1)
        AND source.status IN (1, 2)
        AND source.admission_no IS NOT NULL
        AND trim(CAST(source.admission_no AS TEXT)) <> ''
        AND duplicate_identifiers.admission_no IS NULL
        AND source.name IS NOT NULL
        AND trim(source.name) <> ''
    `,
    issues: [
      issue(
        "source_id_missing",
        "error",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE id IS NULL",
      ),
      issue(
        "source_id_duplicate",
        "error",
        `SELECT COALESCE(SUM(group_count), 0) AS count FROM (
          SELECT COUNT(*) AS group_count FROM beneficiary
          WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
        )`,
      ),
      issue(
        "kind_invalid",
        "error",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE type IS NULL OR type NOT IN (0, 1)",
      ),
      issue(
        "status_invalid",
        "error",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE status IS NULL OR status NOT IN (1, 2)",
      ),
      issue(
        "primary_identifier_missing",
        "error",
        `SELECT COUNT(*) AS count FROM beneficiary
         WHERE admission_no IS NULL OR trim(CAST(admission_no AS TEXT)) = ''`,
      ),
      issue(
        "primary_identifier_duplicate",
        "error",
        `SELECT COALESCE(SUM(group_count), 0) AS count FROM (
          SELECT COUNT(*) AS group_count FROM beneficiary
          WHERE admission_no IS NOT NULL AND trim(CAST(admission_no AS TEXT)) <> ''
          GROUP BY admission_no HAVING COUNT(*) > 1
        )`,
      ),
      issue(
        "display_name_missing",
        "error",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE name IS NULL OR trim(name) = ''",
      ),
      issue(
        "gender_unknown",
        "warning",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE gender IS NULL OR gender NOT IN (1, 2)",
      ),
      ...dateIssues("beneficiary", "dob", "date_of_birth", currentDate),
      ...dateIssues("beneficiary", "admin_dt", "admission_date", currentDate),
      issue(
        "admission_before_birth",
        "warning",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE date(admin_dt) < date(dob)",
      ),
      issue(
        "location_missing",
        "warning",
        "SELECT COUNT(*) AS count FROM beneficiary WHERE campus IS NULL OR trim(campus) = ''",
      ),
      issue(
        "photo_reference_missing",
        "warning",
        `SELECT COUNT(*) AS count FROM beneficiary
         WHERE photo_asset_id IS NULL OR trim(photo_asset_id) = ''`,
      ),
    ],
  };
}

function staffDefinition(currentDate) {
  return {
    table: "staff",
    countSql: "SELECT COUNT(*) AS count FROM staff",
    eligibleSql: `
      WITH duplicate_ids AS (
        SELECT id FROM staff WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
      ),
      duplicate_identifiers AS (
        SELECT registration_no FROM staff
        WHERE registration_no IS NOT NULL AND trim(registration_no) <> ''
        GROUP BY registration_no HAVING COUNT(*) > 1
      )
      SELECT COUNT(*) AS count
      FROM staff AS source
      LEFT JOIN duplicate_ids ON duplicate_ids.id = source.id
      LEFT JOIN duplicate_identifiers
        ON duplicate_identifiers.registration_no = source.registration_no
      WHERE source.id IS NOT NULL
        AND duplicate_ids.id IS NULL
        AND source.status IN (1, 2)
        AND source.registration_no IS NOT NULL
        AND trim(source.registration_no) <> ''
        AND duplicate_identifiers.registration_no IS NULL
        AND (
          (source.first_name IS NOT NULL AND trim(source.first_name) <> '')
          OR (source.last_name IS NOT NULL AND trim(source.last_name) <> '')
        )
    `,
    issues: [
      issue("source_id_missing", "error", "SELECT COUNT(*) AS count FROM staff WHERE id IS NULL"),
      issue(
        "source_id_duplicate",
        "error",
        `SELECT COALESCE(SUM(group_count), 0) AS count FROM (
          SELECT COUNT(*) AS group_count FROM staff
          WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
        )`,
      ),
      issue(
        "status_invalid",
        "error",
        "SELECT COUNT(*) AS count FROM staff WHERE status IS NULL OR status NOT IN (1, 2)",
      ),
      issue(
        "primary_identifier_missing",
        "error",
        "SELECT COUNT(*) AS count FROM staff WHERE registration_no IS NULL OR trim(registration_no) = ''",
      ),
      issue(
        "primary_identifier_duplicate",
        "error",
        `SELECT COALESCE(SUM(group_count), 0) AS count FROM (
          SELECT COUNT(*) AS group_count FROM staff
          WHERE registration_no IS NOT NULL AND trim(registration_no) <> ''
          GROUP BY registration_no HAVING COUNT(*) > 1
        )`,
      ),
      issue(
        "display_name_missing",
        "error",
        `SELECT COUNT(*) AS count FROM staff
         WHERE (first_name IS NULL OR trim(first_name) = '')
           AND (last_name IS NULL OR trim(last_name) = '')`,
      ),
      issue(
        "gender_unknown",
        "warning",
        "SELECT COUNT(*) AS count FROM staff WHERE sex IS NULL OR sex NOT IN (1, 2)",
      ),
      ...dateIssues("staff", "dob", "date_of_birth", currentDate),
      ...dateIssues("staff", "date_of_joining", "joining_date", currentDate),
      issue(
        "joining_before_birth",
        "warning",
        "SELECT COUNT(*) AS count FROM staff WHERE date(date_of_joining) < date(dob)",
      ),
      issue(
        "location_missing",
        "warning",
        "SELECT COUNT(*) AS count FROM staff WHERE place_allocated IS NULL OR trim(place_allocated) = ''",
      ),
      issue(
        "photo_reference_missing",
        "warning",
        "SELECT COUNT(*) AS count FROM staff WHERE photo_asset_id IS NULL OR trim(photo_asset_id) = ''",
      ),
    ],
  };
}

function dateIssues(table, column, prefix, currentDate) {
  return [
    issue(
      `${prefix}_missing`,
      "warning",
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${column} IS NULL OR trim(${column}) = ''`,
    ),
    issue(
      `${prefix}_invalid`,
      "warning",
      `SELECT COUNT(*) AS count FROM ${table}
       WHERE ${column} IS NOT NULL AND trim(${column}) <> '' AND date(${column}) IS NULL`,
    ),
    issue(
      `${prefix}_before_1900`,
      "warning",
      `SELECT COUNT(*) AS count FROM ${table} WHERE date(${column}) < '1900-01-01'`,
    ),
    issue(
      `${prefix}_in_future`,
      "warning",
      `SELECT COUNT(*) AS count FROM ${table} WHERE date(${column}) > ?`,
      [currentDate],
    ),
  ];
}

function issue(code, severity, sql, parameters = []) {
  return { code, severity, sql, parameters };
}

function analyzeSource(databaseConnection, definition) {
  const issues = definition.issues.map(({ code, severity, sql, parameters }) => ({
    code,
    severity,
    count: scalar(databaseConnection, sql, parameters),
  }));
  const sourceCount = scalar(databaseConnection, definition.countSql);
  const eligibleCount = scalar(databaseConnection, definition.eligibleSql);
  return {
    table: definition.table,
    sourceCount,
    eligibleCount,
    blockedCount: sourceCount - eligibleCount,
    errorCount: sumIssues(issues, "error"),
    warningCount: sumIssues(issues, "warning"),
    issues,
  };
}

function scalar(databaseConnection, sql, parameters = []) {
  const result = databaseConnection.prepare(sql).get(...parameters);
  return Number(result?.count ?? 0);
}

function sumIssues(issues, severity) {
  return issues
    .filter((entry) => entry.severity === severity)
    .reduce((total, entry) => total + entry.count, 0);
}

function assertAggregateOnly(report) {
  const forbiddenKeys = new Set([
    "address",
    "dateOfBirth",
    "displayName",
    "email",
    "name",
    "phone",
    "primaryIdentifier",
    "sourceId",
  ]);
  visit(report, (key) => {
    if (forbiddenKeys.has(key)) {
      throw new Error(`The aggregate report unexpectedly contains the key ${key}.`);
    }
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

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const current = argumentsList[index];
    if (current === "--source" || current === "--output") {
      const value = argumentsList[index + 1];
      if (!value) throw new Error(`${current} requires a value.`);
      parsed[current.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${current}`);
  }
  return parsed;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
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
