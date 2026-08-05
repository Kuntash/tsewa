import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(
  repositoryRoot,
  options.source ?? "../data-migration/d1/tibethomes-newer-d1.sqlite",
);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/academic-history-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const fingerprint = await sha256(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });

database.exec("PRAGMA query_only = ON");

try {
  const core = row(
    database,
    `SELECT COUNT(*) AS sourceRows,
            COUNT(DISTINCT beneficiary_id) AS peopleWithHistory,
            SUM(id IS NULL) AS missingSourceIds,
            COUNT(*) - COUNT(DISTINCT id) AS duplicateSourceIds,
            SUM(beneficiary_id IS NULL) AS missingBeneficiaryIds,
            SUM(class_id IS NULL) AS missingClassIds,
            SUM(session_id IS NULL) AS missingSessionIds,
            SUM(date IS NULL OR trim(date) = '') AS missingDates,
            SUM(date IS NOT NULL AND trim(date) <> '' AND date(date) IS NULL) AS invalidDates,
            SUM(date(date) < '1900-01-01') AS pre1900Dates,
            SUM(date(date) > date('now')) AS futureDates,
            SUM(result IS NULL OR trim(result) = '') AS missingResults,
            SUM(roll_no IS NULL OR trim(roll_no) = '') AS missingRollNumbers,
            SUM(board_registration_no IS NULL OR trim(board_registration_no) = '') AS missingBoardRegistrationNumbers,
            SUM(description IS NULL OR trim(description) = '') AS missingDescriptions
     FROM beneficiary_class`,
  );
  const sourceKinds = rows(
    database,
    `SELECT beneficiary.type AS kind, COUNT(*) AS historyRows,
            COUNT(DISTINCT beneficiary_class.beneficiary_id) AS people
     FROM beneficiary_class
     JOIN beneficiary ON beneficiary.id = beneficiary_class.beneficiary_id
     GROUP BY beneficiary.type ORDER BY beneficiary.type`,
  );
  const missingBeneficiaryLinks = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     LEFT JOIN beneficiary ON beneficiary.id = beneficiary_class.beneficiary_id
     WHERE beneficiary.id IS NULL`,
  );
  const missingClassLinks = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     LEFT JOIN class ON class.id = beneficiary_class.class_id
     WHERE class.id IS NULL`,
  );
  const missingSessionLinks = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     LEFT JOIN session ON session.id = beneficiary_class.session_id
     WHERE session.id IS NULL`,
  );
  const missingSchoolLookups = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     LEFT JOIN school ON school.id = beneficiary_class.school_id
     WHERE school.id IS NULL`,
  );
  const missingHouseLookups = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     LEFT JOIN school_house ON school_house.id = beneficiary_class.house_id
     LEFT JOIN house ON house.id = school_house.house_id
     WHERE beneficiary_class.house_id IS NOT NULL AND house.id IS NULL`,
  );
  const schoolHouseAssociationMismatches = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     JOIN school_house ON school_house.id = beneficiary_class.house_id
     WHERE school_house.school_id <> beneficiary_class.school_id`,
  );
  const dateTieGroups = scalar(
    database,
    `SELECT COUNT(*) AS count FROM (
       SELECT beneficiary_id, date FROM beneficiary_class
       GROUP BY beneficiary_id, date HAVING COUNT(*) > 1
     )`,
  );
  const historyBeforeAdmission = scalar(
    database,
    `SELECT COUNT(*) AS count FROM beneficiary_class
     JOIN beneficiary ON beneficiary.id = beneficiary_class.beneficiary_id
     WHERE date(beneficiary_class.date) < date(beneficiary.admin_dt)`,
  );
  const totalBeneficiaries = scalar(database, "SELECT COUNT(*) AS count FROM beneficiary");
  const peopleWithoutHistory = totalBeneficiaries - Number(core.peopleWithHistory);
  const latest = row(
    database,
    `WITH ranked AS (
       SELECT beneficiary_class.*,
              ROW_NUMBER() OVER (
                PARTITION BY beneficiary_id ORDER BY date(date) DESC, id DESC
              ) AS rank
       FROM beneficiary_class
     )
     SELECT COUNT(*) AS count,
            SUM(school.id IS NULL) AS missingSchoolLookup,
            SUM(date(ranked.date) > date('now')) AS futureDated
     FROM ranked
     LEFT JOIN school ON school.id = ranked.school_id
     WHERE ranked.rank = 1`,
  );
  const maximumHistoryRows = scalar(
    database,
    `SELECT MAX(history_count) AS count FROM (
       SELECT COUNT(*) AS history_count FROM beneficiary_class GROUP BY beneficiary_id
     )`,
  );
  const blockedRows =
    Number(core.missingSourceIds) +
    Number(core.duplicateSourceIds) +
    Number(core.missingBeneficiaryIds) +
    Number(core.missingClassIds) +
    Number(core.missingSessionIds) +
    Number(core.missingDates) +
    Number(core.invalidDates) +
    missingBeneficiaryLinks +
    missingClassLinks +
    missingSessionLinks;
  const warningCount =
    Number(core.futureDates) +
    missingSchoolLookups +
    missingHouseLookups +
    schoolHouseAssociationMismatches +
    dateTieGroups +
    historyBeforeAdmission +
    peopleWithoutHistory;
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
      table: "beneficiary_class",
      repositoryRelativeLocation: normalizePath(relative(repositoryRoot, sourcePath)),
      sha256: fingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    reconciliation: {
      sourceRows: Number(core.sourceRows),
      eligibleRows: Number(core.sourceRows) - blockedRows,
      blockedRows,
      latestAcademicRecordCount: Number(latest.count),
      peopleWithHistory: Number(core.peopleWithHistory),
      peopleWithoutHistory,
      warningCount,
      importedRows: 0,
    },
    sourceKinds: {
      child: {
        historyRows: Number(sourceKinds.find((entry) => entry.kind === 0)?.historyRows ?? 0),
        people: Number(sourceKinds.find((entry) => entry.kind === 0)?.people ?? 0),
      },
      elderly: {
        historyRows: Number(sourceKinds.find((entry) => entry.kind === 1)?.historyRows ?? 0),
        people: Number(sourceKinds.find((entry) => entry.kind === 1)?.people ?? 0),
      },
    },
    quality: {
      missingSourceIds: Number(core.missingSourceIds),
      duplicateSourceIds: Number(core.duplicateSourceIds),
      missingBeneficiaryIds: Number(core.missingBeneficiaryIds),
      missingClassIds: Number(core.missingClassIds),
      missingSessionIds: Number(core.missingSessionIds),
      missingDates: Number(core.missingDates),
      invalidDates: Number(core.invalidDates),
      pre1900Dates: Number(core.pre1900Dates),
      futureDates: Number(core.futureDates),
      missingBeneficiaryLinks,
      missingClassLinks,
      missingSessionLinks,
      missingSchoolLookups,
      missingHouseLookups,
      schoolHouseAssociationMismatches,
      sameDayTieGroups: dateTieGroups,
      historyBeforeAdmission,
      missingResults: Number(core.missingResults),
      missingRollNumbers: Number(core.missingRollNumbers),
      missingBoardRegistrationNumbers: Number(core.missingBoardRegistrationNumbers),
      missingDescriptions: Number(core.missingDescriptions),
      latestMissingSchoolLookups: Number(latest.missingSchoolLookup),
      latestFutureDated: Number(latest.futureDated),
      maximumHistoryRowsPerPerson: maximumHistoryRows,
    },
    latestRecordRule: "latest parsed source date, then greatest source row ID",
  };

  assertAggregateOnly(report);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256(sourcePath)) !== fingerprint
  ) {
    throw new Error("The legacy source changed during the read-only academic dry run.");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      report: normalizePath(relative(repositoryRoot, outputPath)),
      sourceRows: report.reconciliation.sourceRows,
      eligibleRows: report.reconciliation.eligibleRows,
      blockedRows,
      latestAcademicRecordCount: report.reconciliation.latestAcademicRecordCount,
      sourceUnchanged: true,
    }),
  );
} finally {
  database.close();
}

function row(databaseConnection, sql) {
  return databaseConnection.prepare(sql).get();
}

function rows(databaseConnection, sql) {
  return databaseConnection.prepare(sql).all();
}

function scalar(databaseConnection, sql) {
  return Number(row(databaseConnection, sql)?.count ?? 0);
}

function assertAggregateOnly(report) {
  const forbiddenKeys = new Set([
    "displayName",
    "personId",
    "result",
    "rollNumber",
    "boardRegistrationNumber",
    "description",
    "sourceId",
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

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name?.startsWith("--") || !value) throw new Error(`Invalid argument near ${name}.`);
    parsed[name.slice(2)] = value;
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
