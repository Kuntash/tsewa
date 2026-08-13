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
  stablePersonId,
  stableUuid,
} from "./lib/person-files.mjs";

const SOURCE_SYSTEM = "THF Office Manager";
const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const reportPath = resolve(repositoryRoot, options.report ?? "reports/health-history-dry-run.json");
const target = requiredOption(options, "target");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");
if (!["local", "remote"].includes(target)) throw new Error("--target must be local or remote.");

await assertTargetBinding();
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertReport(report);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
if (sourceFingerprint !== report.source.sha256)
  throw new Error("The source no longer matches the reviewed dry run.");
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

let workspace;
try {
  const data = readData(database);
  if (
    data.visits.length !== report.inventory.visits ||
    data.diagnoses.length !== report.inventory.diagnoses ||
    data.tbCases.length !== report.inventory.tbRegistrations ||
    data.tbDetails.length !== report.inventory.tbDetails ||
    data.medicalAdvances.length !== report.inventory.medicalAdvances ||
    data.medicalAdvanceDetails.length !== report.inventory.medicalAdvanceDetails ||
    data.medicalSettlements.length !== report.inventory.medicalSettlements
  )
    throw new Error("Health history counts do not match the reviewed dry run.");
  const linkedPersonCount = data.visits.filter((visit) => visit.personId).length;
  if (data.visits.length - linkedPersonCount !== report.linkChecks.visitsWithoutPerson)
    throw new Error("Unlinked health visit count changed since the dry run.");
  const linkedTbCaseCount = data.tbCases.filter((item) => item.personId).length;
  if (data.tbCases.length - linkedTbCaseCount !== report.linkChecks.tbCasesWithoutPerson)
    throw new Error("Unlinked TB case count changed since the dry run.");
  const linkedMedicalDetailCount = data.medicalAdvanceDetails.filter(
    (item) => item.personId,
  ).length;
  if (
    data.medicalAdvanceDetails.length - linkedMedicalDetailCount !==
    report.linkChecks.medicalDetailsWithoutPerson
  )
    throw new Error("Unlinked medical advance patient count changed since the dry run.");

  const importedAt = new Date().toISOString();
  const batchId = `health-history-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildSql(
    data,
    batchId,
    importedAt,
    linkedPersonCount,
    linkedTbCaseCount,
    linkedMedicalDetailCount,
  );
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  )
    throw new Error("The legacy source changed while preparing the import.");

  workspace = await mkdtemp(join(tmpdir(), "tsewa-health-import-"));
  const sqlPath = join(workspace, "health-history.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0)
    throw new Error(`Wrangler did not complete the health import: ${safeError(result)}`);
  console.log(
    JSON.stringify({
      target,
      databaseId: confirmedDatabaseId,
      batchId,
      visits: data.visits.length,
      diagnoses: data.diagnoses.length,
      tbCases: data.tbCases.length,
      tbDetails: data.tbDetails.length,
      linkedPeople: linkedPersonCount,
      unlinkedPeople: data.visits.length - linkedPersonCount,
      linkedTbCases: linkedTbCaseCount,
      unlinkedTbCases: data.tbCases.length - linkedTbCaseCount,
      medicalAdvances: data.medicalAdvances.length,
      medicalAdvanceDetails: data.medicalAdvanceDetails.length,
      medicalSettlements: data.medicalSettlements.length,
      linkedMedicalPatients: linkedMedicalDetailCount,
      unlinkedMedicalPatients: data.medicalAdvanceDetails.length - linkedMedicalDetailCount,
      sourceUnchanged: true,
      temporaryPersonalDataRemoved: true,
    }),
  );
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readData(connection) {
  const beneficiaryByAdmission = new Map(
    connection
      .prepare(
        `SELECT id,CAST(admission_no AS TEXT) AS number FROM beneficiary WHERE admission_no IS NOT NULL`,
      )
      .all()
      .map((row) => [String(row.number).trim(), String(row.id)]),
  );
  const staffByRegistration = new Map(
    connection
      .prepare(
        `SELECT id,CAST(registration_no AS TEXT) AS number FROM staff WHERE registration_no IS NOT NULL`,
      )
      .all()
      .map((row) => [String(row.number).trim(), String(row.id)]),
  );
  const visits = connection
    .prepare(`SELECT visit.*, type.name AS patient_type, gender.sex AS gender_name,
      location.name AS referral_location_name
      FROM patient_diagonosis visit
      LEFT JOIN patient_type type ON type.id=visit.patient_type_id
      LEFT JOIN gender ON gender.id=visit.gender_id
      LEFT JOIN location ON location.id=visit.reff_location
      ORDER BY visit.id`)
    .all()
    .map((row) => {
      const sourceId = String(row.id);
      const admissionNumber = optionalText(row.admission_no);
      const personSourceTable = Number(row.patient_type_id) === 3 ? "staff" : "beneficiary";
      const personSourceId = admissionNumber
        ? personSourceTable === "staff"
          ? staffByRegistration.get(admissionNumber)
          : beneficiaryByAdmission.get(admissionNumber)
        : undefined;
      return {
        id: id("patient_diagonosis", sourceId),
        sourceId,
        personId: personSourceId
          ? stablePersonId(organizationSlug, personSourceTable, personSourceId)
          : null,
        patientName: optionalText(row.patient_name) ?? `Unknown legacy patient ${sourceId}`,
        patientKind: patientKind(row.patient_type),
        admissionNumber,
        gender: gender(row.gender_name),
        homeName: optionalText(row.home),
        ageAtVisit: optionalInteger(row.age),
        checkupDate: requiredDate(row.checkup_date, `checkup date ${sourceId}`),
        admittedOn: optionalDate(row.date_of_admission),
        dischargedOn: optionalDate(row.dateof_discharge),
        doctorName: optionalText(row.doctor_name),
        referredTo: optionalText(row.reffered_to),
        referralLocation:
          optionalText(row.referral_location_name) ?? optionalText(row.reff_location),
        remarks: optionalText(row.remarks),
        hepatitisBStatus: optionalText(row.hepatitis_b_status),
      };
    });
  const diagnoses = connection
    .prepare(`SELECT detail.id,detail.patient_diagonosis_id,detail.date,detail.remarks,
      detail.diagonosis_test_id,test.name AS diagnosis_name
      FROM patient_diagonosis_details detail
      LEFT JOIN diagonosis_test test ON test.id=detail.diagonosis_test_id
      ORDER BY detail.id`)
    .all()
    .map((row) => ({
      id: id("patient_diagonosis_details", row.id),
      sourceId: String(row.id),
      healthVisitId: id("patient_diagonosis", row.patient_diagonosis_id),
      diagnosisName:
        optionalText(row.diagnosis_name) ??
        `Legacy diagnosis/test ${String(row.diagonosis_test_id)}`,
      recordedOn: optionalDate(row.date),
      remarks: optionalText(row.remarks),
    }));
  const tbCases = connection
    .prepare(`SELECT record.*,patient_type.name AS patient_type,
      gender.sex AS gender_name,regimen.name AS regimen_name,outcome.name AS outcome_name,
      tb_type.name AS tb_type_name,case_type.name AS case_type_name
      FROM tb record
      LEFT JOIN patient_type ON patient_type.id=record.patient_type_id
      LEFT JOIN gender ON gender.id=record.gender_id
      LEFT JOIN tb_treatment_regimen regimen ON regimen.id=record.tb_treatment_regimen_id
      LEFT JOIN tb_out_come outcome ON outcome.id=record.tb_out_come_id
      LEFT JOIN tb_type ON tb_type.id=record.tb_type_id
      LEFT JOIN tb_case_type case_type ON case_type.id=record.tb_case_type
      ORDER BY record.id`)
    .all()
    .map((row) => {
      const sourceId = String(row.id);
      const admissionNumber = optionalText(row.admission_no);
      const personSourceTable = Number(row.patient_type_id) === 3 ? "staff" : "beneficiary";
      const personSourceId = admissionNumber
        ? personSourceTable === "staff"
          ? staffByRegistration.get(admissionNumber)
          : beneficiaryByAdmission.get(admissionNumber)
        : undefined;
      return {
        id: id("tb", sourceId),
        sourceId,
        personId: personSourceId
          ? stablePersonId(organizationSlug, personSourceTable, personSourceId)
          : null,
        patientName: optionalText(row.patient_name) ?? `Unknown legacy TB patient ${sourceId}`,
        patientKind: patientKind(row.patient_type),
        tbCardNumber: optionalText(row.tb_card_no),
        admissionNumber,
        fatherName: optionalText(row.father_name),
        gender: gender(row.gender_name),
        ageAtRegistration: optionalInteger(row.age),
        homeName: optionalText(row.home),
        treatmentRegimen:
          optionalText(row.regimen_name) ??
          `Legacy treatment regimen ${String(row.tb_treatment_regimen_id)}`,
        registrationDate: requiredDate(row.registration_date, `TB registration date ${sourceId}`),
        treatmentStartDate: optionalDate(row.treatment_start_date),
        treatmentEndDate: optionalDate(row.treatment_end_date),
        outcome:
          optionalText(row.outcome_name) ?? `Legacy TB outcome ${String(row.tb_out_come_id)}`,
        tbType: optionalText(row.tb_type_name) ?? `Legacy TB type ${String(row.tb_type_id)}`,
        caseType:
          optionalText(row.case_type_name) ?? `Legacy TB case type ${String(row.tb_case_type)}`,
        remarks: optionalText(row.remarks),
      };
    });
  const tbDetails = connection
    .prepare(`SELECT detail.id,detail.tbid,detail.date,detail.result,detail.remarks,
      detail.diagonosis_test_id,test.name AS test_name
      FROM tb_details detail
      LEFT JOIN diagonosis_test test ON test.id=detail.diagonosis_test_id
      ORDER BY detail.id`)
    .all()
    .map((row) => ({
      id: id("tb_details", row.id),
      sourceId: String(row.id),
      tbCaseId: id("tb", row.tbid),
      recordedOn: requiredDate(row.date, `TB detail date ${String(row.id)}`),
      testName:
        optionalText(row.test_name) ?? `Legacy diagnosis/test ${String(row.diagonosis_test_id)}`,
      result: optionalText(row.result),
      remarks: optionalText(row.remarks),
    }));
  const medicalAdvances = connection
    .prepare(`SELECT * FROM advance_sanction ORDER BY id`)
    .all()
    .map((row) => ({
      id: id("advance_sanction", row.id),
      sourceId: String(row.id),
      sanctionedOn: requiredDate(row.date, `medical advance date ${String(row.id)}`),
      nurseName: optionalText(row.nurse_name),
      sanctionNumber: optionalText(row.sanction_no),
      advanceAmount: requiredNumber(row.advance_amount, `medical advance amount ${String(row.id)}`),
      referringDoctorName: optionalText(row.ref_by_doctor_name),
      referralLocation: optionalText(row.ref_location),
      remarks: optionalText(row.remarks),
    }));
  const medicalAdvanceDetails = connection
    .prepare(`SELECT detail.*,patient_type.name AS patient_type,
      gender.sex AS gender_name,type.name AS sanction_type_name
      FROM advance_sanction_detail detail
      LEFT JOIN patient_type ON patient_type.id=detail.patient_type_id
      LEFT JOIN gender ON gender.id=detail.gender_id
      LEFT JOIN sanction_type type ON type.id=detail.sanction_type_id
      ORDER BY detail.id`)
    .all()
    .map((row) => {
      const sourceId = String(row.id);
      const personSourceTable = Number(row.patient_type_id) === 3 ? "staff" : "beneficiary";
      const personSourceId = optionalText(row.patient_id);
      return {
        id: id("advance_sanction_detail", sourceId),
        sourceId,
        medicalAdvanceId: id("advance_sanction", row.advance_sanction_id),
        personId: personSourceId
          ? stablePersonId(organizationSlug, personSourceTable, personSourceId)
          : null,
        patientName: optionalText(row.patient_name) ?? `Unknown legacy patient ${sourceId}`,
        patientKind: patientKind(row.patient_type),
        sanctionType:
          optionalText(row.sanction_type_name) ??
          `Legacy sanction type ${String(row.sanction_type_id)}`,
        homeName: optionalText(row.home),
        gender: gender(row.gender_name),
        ageAtSanction: optionalInteger(row.age),
        medication: optionalText(row.medication),
        referredToDoctorName: optionalText(row.ref_to_doctor_name),
        hospitalRegistrationNumber: optionalText(row.hospital_reg_no),
        hospitalReferredTo: optionalText(row.hospital_ref_to),
        hospitalAdmitted: optionalText(row.hospital_admitted),
        diagnosis: optionalText(row.diagonosis),
        admittedOn: optionalDate(row.admit_date),
        dischargedOn: optionalDate(row.discharge_date),
        surgeryType: optionalText(row.surgery_type),
        amount: optionalNumber(row.amount),
        remarks: optionalText(row.remarks),
      };
    });
  const medicalSettlements = connection
    .prepare(`SELECT link.id AS link_id,link.advance_sanction_id,link.settlement_id,value.*
      FROM advance_settlement link
      JOIN settlement value ON value.id=link.settlement_id
      ORDER BY link.id`)
    .all()
    .map((row) => ({
      id: id("advance_settlement", row.link_id),
      sourceId: String(row.link_id),
      medicalAdvanceId: id("advance_sanction", row.advance_sanction_id),
      legacySettlementId: String(row.settlement_id),
      settledOn: requiredDate(row.date, `medical settlement date ${String(row.link_id)}`),
      billNumber: optionalText(row.bill_no),
      nurseTada: optionalNumber(row.nurse_tada),
      totalExpenses: optionalNumber(row.total_expenses),
      extraExpenses: optionalNumber(row.extra_expenses),
      balance: optionalNumber(row.balance),
      remarks: optionalText(row.remarks),
    }));
  return {
    visits,
    diagnoses,
    tbCases,
    tbDetails,
    medicalAdvances,
    medicalAdvanceDetails,
    medicalSettlements,
  };
}

function buildSql(
  data,
  batchId,
  importedAt,
  linkedPersonCount,
  linkedTbCaseCount,
  linkedMedicalDetailCount,
) {
  const organizationId = rawSql(
    `(SELECT id FROM organization WHERE slug=${sqlLiteral(organizationSlug)})`,
  );
  const common = (table, item) => [
    SOURCE_SYSTEM,
    table,
    item.sourceId,
    batchId,
    importedAt,
    importedAt,
    importedAt,
  ];
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO health_history_import_batch
      (id,organization_id,source_system,source_database,source_fingerprint,status,visit_count,diagnosis_count,tb_case_count,tb_detail_count,medical_advance_count,medical_advance_detail_count,medical_settlement_count,linked_person_count,unlinked_person_count,started_at,created_at)
      VALUES (${sqlLiteral(batchId)},${organizationId.sql},${sqlLiteral(SOURCE_SYSTEM)},'tibethomes-newer-d1.sqlite',${sqlLiteral(report.source.sha256)},'running',${data.visits.length},${data.diagnoses.length},${data.tbCases.length},${data.tbDetails.length},${data.medicalAdvances.length},${data.medicalAdvanceDetails.length},${data.medicalSettlements.length},${linkedPersonCount + linkedTbCaseCount + linkedMedicalDetailCount},${data.visits.length - linkedPersonCount + data.tbCases.length - linkedTbCaseCount + data.medicalAdvanceDetails.length - linkedMedicalDetailCount},${sqlLiteral(importedAt)},${sqlLiteral(importedAt)})
      ON CONFLICT(id) DO UPDATE SET status='running',visit_count=excluded.visit_count,
        diagnosis_count=excluded.diagnosis_count,tb_case_count=excluded.tb_case_count,
        tb_detail_count=excluded.tb_detail_count,medical_advance_count=excluded.medical_advance_count,
        medical_advance_detail_count=excluded.medical_advance_detail_count,
        medical_settlement_count=excluded.medical_settlement_count,
        linked_person_count=excluded.linked_person_count,
        unlinked_person_count=excluded.unlinked_person_count,started_at=excluded.started_at,finished_at=NULL`,
  ];
  add(
    statements,
    "health_visit",
    [
      "id",
      "organization_id",
      "person_id",
      "patient_name",
      "patient_kind",
      "admission_number",
      "gender",
      "home_name",
      "age_at_visit",
      "checkup_date",
      "admitted_on",
      "discharged_on",
      "doctor_name",
      "referred_to",
      "referral_location",
      "remarks",
      "hepatitis_b_status",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.visits.map((item) => [
      item.id,
      organizationId,
      item.personId,
      item.patientName,
      item.patientKind,
      item.admissionNumber,
      item.gender,
      item.homeName,
      item.ageAtVisit,
      item.checkupDate,
      item.admittedOn,
      item.dischargedOn,
      item.doctorName,
      item.referredTo,
      item.referralLocation,
      item.remarks,
      item.hepatitisBStatus,
      ...common("patient_diagonosis", item),
    ]),
    20,
  );
  add(
    statements,
    "health_diagnosis",
    [
      "id",
      "organization_id",
      "health_visit_id",
      "diagnosis_name",
      "recorded_on",
      "remarks",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.diagnoses.map((item) => [
      item.id,
      organizationId,
      item.healthVisitId,
      item.diagnosisName,
      item.recordedOn,
      item.remarks,
      ...common("patient_diagonosis_details", item),
    ]),
    35,
  );
  add(
    statements,
    "health_tb_case",
    [
      "id",
      "organization_id",
      "person_id",
      "patient_name",
      "patient_kind",
      "tb_card_number",
      "admission_number",
      "father_name",
      "gender",
      "age_at_registration",
      "home_name",
      "treatment_regimen",
      "registration_date",
      "treatment_start_date",
      "treatment_end_date",
      "outcome",
      "tb_type",
      "case_type",
      "remarks",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.tbCases.map((item) => [
      item.id,
      organizationId,
      item.personId,
      item.patientName,
      item.patientKind,
      item.tbCardNumber,
      item.admissionNumber,
      item.fatherName,
      item.gender,
      item.ageAtRegistration,
      item.homeName,
      item.treatmentRegimen,
      item.registrationDate,
      item.treatmentStartDate,
      item.treatmentEndDate,
      item.outcome,
      item.tbType,
      item.caseType,
      item.remarks,
      ...common("tb", item),
    ]),
    18,
  );
  add(
    statements,
    "health_tb_detail",
    [
      "id",
      "organization_id",
      "tb_case_id",
      "recorded_on",
      "test_name",
      "result",
      "remarks",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.tbDetails.map((item) => [
      item.id,
      organizationId,
      item.tbCaseId,
      item.recordedOn,
      item.testName,
      item.result,
      item.remarks,
      ...common("tb_details", item),
    ]),
    30,
  );
  add(
    statements,
    "health_medical_advance",
    [
      "id",
      "organization_id",
      "sanctioned_on",
      "nurse_name",
      "sanction_number",
      "advance_amount",
      "referring_doctor_name",
      "referral_location",
      "remarks",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.medicalAdvances.map((item) => [
      item.id,
      organizationId,
      item.sanctionedOn,
      item.nurseName,
      item.sanctionNumber,
      item.advanceAmount,
      item.referringDoctorName,
      item.referralLocation,
      item.remarks,
      ...common("advance_sanction", item),
    ]),
    30,
  );
  add(
    statements,
    "health_medical_advance_detail",
    [
      "id",
      "organization_id",
      "medical_advance_id",
      "person_id",
      "patient_name",
      "patient_kind",
      "sanction_type",
      "home_name",
      "gender",
      "age_at_sanction",
      "medication",
      "referred_to_doctor_name",
      "hospital_registration_number",
      "hospital_referred_to",
      "hospital_admitted",
      "diagnosis",
      "admitted_on",
      "discharged_on",
      "surgery_type",
      "amount",
      "remarks",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.medicalAdvanceDetails.map((item) => [
      item.id,
      organizationId,
      item.medicalAdvanceId,
      item.personId,
      item.patientName,
      item.patientKind,
      item.sanctionType,
      item.homeName,
      item.gender,
      item.ageAtSanction,
      item.medication,
      item.referredToDoctorName,
      item.hospitalRegistrationNumber,
      item.hospitalReferredTo,
      item.hospitalAdmitted,
      item.diagnosis,
      item.admittedOn,
      item.dischargedOn,
      item.surgeryType,
      item.amount,
      item.remarks,
      ...common("advance_sanction_detail", item),
    ]),
    15,
  );
  add(
    statements,
    "health_medical_settlement",
    [
      "id",
      "organization_id",
      "medical_advance_id",
      "settled_on",
      "bill_number",
      "nurse_tada",
      "total_expenses",
      "extra_expenses",
      "balance",
      "remarks",
      "legacy_settlement_id",
      "source_system",
      "source_table",
      "source_id",
      "import_batch_id",
      "imported_at",
      "created_at",
      "updated_at",
    ],
    data.medicalSettlements.map((item) => [
      item.id,
      organizationId,
      item.medicalAdvanceId,
      item.settledOn,
      item.billNumber,
      item.nurseTada,
      item.totalExpenses,
      item.extraExpenses,
      item.balance,
      item.remarks,
      item.legacySettlementId,
      ...common("advance_settlement", item),
    ]),
    25,
  );
  statements.push(
    `UPDATE health_history_import_batch SET status='completed',finished_at=${sqlLiteral(importedAt)} WHERE id=${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function add(statements, table, columns, rows, chunkSize) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const values = rows
      .slice(index, index + chunkSize)
      .map((row) => `(${row.map(sqlValue).join(",")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES\n${values}\n` +
        `ON CONFLICT(organization_id,source_system,source_table,source_id) DO UPDATE SET ` +
        columns
          .filter(
            (column) =>
              ![
                "id",
                "organization_id",
                "source_system",
                "source_table",
                "source_id",
                "created_at",
              ].includes(column),
          )
          .map((column) => `${column}=excluded.${column}`)
          .join(","),
    );
  }
}

function sqlValue(value) {
  return value && typeof value === "object" && "sql" in value ? value.sql : sqlLiteral(value);
}
function id(table, sourceId) {
  return stableUuid(`tsewa|${organizationSlug}|${table}|${String(sourceId)}`);
}
function optionalText(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}
function optionalInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isInteger(result) ? result : null;
}
function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function requiredNumber(value, label) {
  const result = optionalNumber(value);
  if (result === null) throw new Error(`Missing ${label}.`);
  return result;
}
function optionalDate(value) {
  const result = optionalText(value);
  return result ? result.slice(0, 10) : null;
}
function requiredDate(value, label) {
  const result = optionalDate(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}
function patientKind(value) {
  const normalized = optionalText(value)?.toLowerCase();
  return normalized === "child" || normalized === "elderly" || normalized === "staff"
    ? normalized
    : "other";
}
function gender(value) {
  const normalized = optionalText(value)?.toLowerCase();
  return normalized === "m" ? "male" : normalized === "f" ? "female" : null;
}
function assertReport(value) {
  if (
    value?.mode !== "health_history_dry_run" ||
    Number(value?.schemaVersion) < 3 ||
    value?.privacy?.containsPersonalData !== false ||
    Number(value?.linkChecks?.diagnosesWithoutVisit) !== 0 ||
    Number(value?.linkChecks?.tbDetailsWithoutCase) !== 0 ||
    Number(value?.linkChecks?.medicalDetailsWithoutAdvance) !== 0 ||
    Number(value?.linkChecks?.medicalSettlementsWithoutAdvance) !== 0 ||
    Number(value?.linkChecks?.medicalSettlementsWithoutValue) !== 0
  )
    throw new Error("The reviewed health history dry run has not cleared import gates.");
}
function safeError(result) {
  return (
    `${result.stdout}\n${result.stderr}`
      .split("\n")
      .filter((line) => /error|failed|constraint|no such/i.test(line))
      .slice(-4)
      .join(" | ") || `exit ${result.status}`
  );
}
async function assertTargetBinding() {
  const config = await readFile(resolve(webRoot, "wrangler.jsonc"), "utf8");
  if (!config.includes(confirmedDatabaseId))
    throw new Error("The confirmed D1 target is not configured.");
  if (target === "local") return;
  const result = spawnSync("pnpm", ["exec", "wrangler", "d1", "info", "DB"], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || !result.stdout.includes(confirmedDatabaseId))
    throw new Error("The live D1 binding does not match the confirmed database.");
}
