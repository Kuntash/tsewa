import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(repositoryRoot, options.output ?? "reports/health-history-dry-run.json");
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const inventory = numbers(
    database
      .prepare(`SELECT
        (SELECT COUNT(*) FROM patient_diagonosis) AS visits,
        (SELECT COUNT(*) FROM patient_diagonosis_details) AS diagnoses,
        (SELECT COUNT(*) FROM diagonosis_test) AS diagnosisTypes,
        (SELECT COUNT(*) FROM tb) AS tbRegistrations,
        (SELECT COUNT(*) FROM tb_details) AS tbDetails,
        (SELECT COUNT(*) FROM advance_sanction) AS medicalAdvances,
        (SELECT COUNT(*) FROM advance_sanction_detail) AS medicalAdvanceDetails,
        (SELECT COUNT(*) FROM advance_settlement) AS medicalSettlements,
        (SELECT COUNT(*) FROM settlement) AS settlementRows`)
      .get(),
  );
  const checks = numbers(
    database
      .prepare(`SELECT
        (SELECT COUNT(*) FROM patient_diagonosis_details detail
          LEFT JOIN patient_diagonosis visit ON visit.id=detail.patient_diagonosis_id
          WHERE visit.id IS NULL) AS diagnosesWithoutVisit,
        (SELECT COUNT(*) FROM patient_diagonosis_details detail
          LEFT JOIN diagonosis_test test ON test.id=detail.diagonosis_test_id
          WHERE test.id IS NULL) AS diagnosesWithoutType,
        (SELECT COUNT(*) FROM patient_diagonosis
          WHERE patient_name IS NULL OR trim(patient_name)='') AS visitsWithoutPatientName,
        (SELECT COUNT(*) FROM patient_diagonosis visit WHERE
          CASE WHEN visit.patient_type_id=3
            THEN NOT EXISTS (SELECT 1 FROM staff WHERE CAST(staff.registration_no AS TEXT)=CAST(visit.admission_no AS TEXT))
            ELSE NOT EXISTS (SELECT 1 FROM beneficiary WHERE CAST(beneficiary.admission_no AS TEXT)=CAST(visit.admission_no AS TEXT))
          END) AS visitsWithoutPerson,
        (SELECT COUNT(*) FROM tb_details detail
          LEFT JOIN tb parent ON parent.id=detail.tbid WHERE parent.id IS NULL) AS tbDetailsWithoutCase,
        (SELECT COUNT(*) FROM tb_details detail
          LEFT JOIN diagonosis_test test ON test.id=detail.diagonosis_test_id
          WHERE test.id IS NULL) AS tbDetailsWithoutType,
        (SELECT COUNT(*) FROM tb WHERE patient_name IS NULL OR trim(patient_name)='') AS tbCasesWithoutPatientName,
        (SELECT COUNT(*) FROM tb WHERE registration_date IS NULL OR trim(registration_date)='') AS tbCasesWithoutRegistrationDate,
        (SELECT COUNT(*) FROM tb record WHERE
          CASE WHEN record.patient_type_id=3
            THEN NOT EXISTS (SELECT 1 FROM staff WHERE trim(CAST(staff.registration_no AS TEXT))=trim(CAST(record.admission_no AS TEXT)))
            ELSE NOT EXISTS (SELECT 1 FROM beneficiary WHERE trim(CAST(beneficiary.admission_no AS TEXT))=trim(CAST(record.admission_no AS TEXT)))
          END) AS tbCasesWithoutPerson,
        (SELECT COUNT(*) FROM tb record
          LEFT JOIN tb_treatment_regimen lookup ON lookup.id=record.tb_treatment_regimen_id
          WHERE lookup.id IS NULL) AS tbCasesWithoutRegimen,
        (SELECT COUNT(*) FROM tb record
          LEFT JOIN tb_out_come lookup ON lookup.id=record.tb_out_come_id
          WHERE lookup.id IS NULL) AS tbCasesWithoutOutcome,
        (SELECT COUNT(*) FROM tb record
          LEFT JOIN tb_type lookup ON lookup.id=record.tb_type_id
          WHERE lookup.id IS NULL) AS tbCasesWithoutType,
        (SELECT COUNT(*) FROM tb record
          LEFT JOIN tb_case_type lookup ON lookup.id=record.tb_case_type
          WHERE lookup.id IS NULL) AS tbCasesWithoutCaseType,
        (SELECT COUNT(*) FROM advance_sanction_detail detail
          LEFT JOIN advance_sanction parent ON parent.id=detail.advance_sanction_id
          WHERE parent.id IS NULL) AS medicalDetailsWithoutAdvance,
        (SELECT COUNT(*) FROM advance_settlement link
          LEFT JOIN advance_sanction parent ON parent.id=link.advance_sanction_id
          WHERE parent.id IS NULL) AS medicalSettlementsWithoutAdvance,
        (SELECT COUNT(*) FROM advance_settlement link
          LEFT JOIN settlement value ON value.id=link.settlement_id
          WHERE value.id IS NULL) AS medicalSettlementsWithoutValue,
        (SELECT COUNT(*) FROM advance_sanction_detail detail
          LEFT JOIN sanction_type type ON type.id=detail.sanction_type_id
          WHERE type.id IS NULL) AS medicalDetailsWithoutSanctionType,
        (SELECT COUNT(*) FROM advance_sanction_detail detail
          WHERE detail.patient_id IS NULL OR CASE WHEN detail.patient_type_id=3
            THEN NOT EXISTS (SELECT 1 FROM staff WHERE id=detail.patient_id)
            ELSE NOT EXISTS (SELECT 1 FROM beneficiary WHERE id=detail.patient_id)
          END) AS medicalDetailsWithoutPerson`)
      .get(),
  );
  if (checks.diagnosesWithoutVisit)
    throw new Error(`Diagnosis details without a parent visit: ${checks.diagnosesWithoutVisit}`);
  if (checks.tbDetailsWithoutCase)
    throw new Error(`TB details without a parent case: ${checks.tbDetailsWithoutCase}`);
  if (checks.medicalDetailsWithoutAdvance)
    throw new Error(
      `Medical advance details without a parent: ${checks.medicalDetailsWithoutAdvance}`,
    );
  if (checks.medicalSettlementsWithoutAdvance || checks.medicalSettlementsWithoutValue)
    throw new Error("Medical settlement links have missing parents.");

  const patientKinds = database
    .prepare(`SELECT coalesce(type.name, 'Unknown') AS name, COUNT(*) AS count
      FROM patient_diagonosis visit
      LEFT JOIN patient_type type ON type.id=visit.patient_type_id
      GROUP BY visit.patient_type_id,type.name ORDER BY count DESC`)
    .all()
    .map((row) => ({ name: String(row.name), count: Number(row.count) }));
  const dateRange = database
    .prepare(`SELECT MIN(date(checkup_date)) AS firstVisitOn,
      MAX(date(checkup_date)) AS lastVisitOn FROM patient_diagonosis`)
    .get();
  const tbDateRange = database
    .prepare(`SELECT MIN(date(registration_date)) AS firstRegistrationOn,
      MAX(date(registration_date)) AS lastRegistrationOn,
      MIN(date(treatment_start_date)) AS firstTreatmentStartOn,
      MAX(date(treatment_end_date)) AS lastTreatmentEndOn FROM tb`)
    .get();
  const tbOutcomes = database
    .prepare(`SELECT coalesce(outcome.name, 'Unknown') AS name,COUNT(*) AS count
      FROM tb record LEFT JOIN tb_out_come outcome ON outcome.id=record.tb_out_come_id
      GROUP BY record.tb_out_come_id,outcome.name ORDER BY count DESC`)
    .all()
    .map((row) => ({ name: String(row.name), count: Number(row.count) }));
  const tbRegimens = database
    .prepare(`SELECT coalesce(regimen.name, 'Unknown') AS name,COUNT(*) AS count
      FROM tb record LEFT JOIN tb_treatment_regimen regimen
        ON regimen.id=record.tb_treatment_regimen_id
      GROUP BY record.tb_treatment_regimen_id,regimen.name ORDER BY count DESC`)
    .all()
    .map((row) => ({ name: String(row.name), count: Number(row.count) }));
  const medicalAdvanceRange = database
    .prepare(`SELECT MIN(date(date)) AS firstSanctionOn,MAX(date(date)) AS lastSanctionOn,
      SUM(advance_amount) AS advanceAmount FROM advance_sanction`)
    .get();
  const medicalSettlementRange = database
    .prepare(`SELECT MIN(date(value.date)) AS firstSettlementOn,
      MAX(date(value.date)) AS lastSettlementOn,
      SUM(value.total_expenses) AS totalExpenses,SUM(value.balance) AS balance
      FROM settlement value`)
    .get();
  const medicalSanctionTypes = database
    .prepare(`SELECT coalesce(type.name, 'Unknown') AS name,COUNT(*) AS count
      FROM advance_sanction_detail detail
      LEFT JOIN sanction_type type ON type.id=detail.sanction_type_id
      GROUP BY detail.sanction_type_id,type.name ORDER BY count DESC`)
    .all()
    .map((row) => ({ name: String(row.name), count: Number(row.count) }));

  const report = {
    schemaVersion: 3,
    mode: "health_history_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: [
        "patient_diagonosis",
        "patient_diagonosis_details",
        "diagonosis_test",
        "tb",
        "tb_details",
        "tb_treatment_regimen",
        "tb_out_come",
        "tb_type",
        "tb_case_type",
        "advance_sanction",
        "advance_sanction_detail",
        "advance_settlement",
        "settlement",
        "sanction_type",
      ],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory,
    linkChecks: checks,
    patientKinds,
    dateRange,
    tbDateRange,
    tbOutcomes,
    tbRegimens,
    medicalAdvanceRange,
    medicalSettlementRange,
    medicalSanctionTypes,
    proposedPolicy: {
      access: "Restricted by health.read; imported diagnosis history is view-only.",
      personLinks:
        "Link by the legacy admission or staff registration number; retain unmatched visits without inventing a person link.",
      missingDiagnosisTypes:
        "Preserve the legacy diagnosis type identifier when its lookup row is missing.",
      tbHistory:
        "Preserve TB registration, treatment dates, classification, outcome, tests, results, and notes as restricted read-only history.",
      medicalAdvances:
        "Preserve sanctions, patient allocations, hospital details, expenses, and settlement balances; retain five unlinked patient allocations without inventing person links.",
      nextSlices: ["health record editing"],
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
