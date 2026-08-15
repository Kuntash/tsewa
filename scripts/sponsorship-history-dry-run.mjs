import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/sponsorship-history-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const sourceFingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const inventory = numbers(
    database
      .prepare(`SELECT
      (SELECT COUNT(*) FROM individual) AS individuals,
      (SELECT COUNT(*) FROM sponsors) AS organizations,
      (SELECT COUNT(*) FROM beneficeary_sponsors) AS assignments,
      (SELECT COUNT(*) FROM funds) AS funds,
      (SELECT COUNT(*) FROM fund_detail) AS allocations,
      (SELECT COUNT(*) FROM letter) AS letters,
      (SELECT COUNT(*) FROM visitor) AS visitors,
      (SELECT COUNT(*) FROM fund_type) AS fundTypes,
      (SELECT COUNT(*) FROM sponsor_type) AS sponsorTypes,
      (SELECT COUNT(*) FROM sponsor_category) AS sponsorCategories,
      (SELECT COUNT(*) FROM sponsor_ship_status) AS statuses,
      (SELECT COUNT(*) FROM correspondence_type) AS correspondenceTypes,
      (SELECT COUNT(*) FROM visitor_type) AS visitorTypes,
      (SELECT COUNT(*) FROM sponsorship) AS emptySponsorshipRows,
      (SELECT COUNT(*) FROM beneficiary_funds) AS emptyBeneficiaryFundRows`)
      .get(),
  );
  const linkChecks = numbers(
    database
      .prepare(`SELECT
      (SELECT COUNT(*) FROM individual value LEFT JOIN sponsors parent ON parent.id=value.sponsor_id WHERE value.sponsor_id IS NOT NULL AND parent.id IS NULL) AS individualsWithoutOrganization,
      (SELECT COUNT(*) FROM beneficeary_sponsors value LEFT JOIN beneficiary person ON person.id=value.beneficiary_id WHERE person.id IS NULL) AS assignmentsWithoutPerson,
      (SELECT COUNT(*) FROM beneficeary_sponsors value LEFT JOIN individual sponsor ON sponsor.id=value.individual_id WHERE sponsor.id IS NULL) AS assignmentsWithoutSponsor,
      (SELECT COUNT(*) FROM beneficeary_sponsors value LEFT JOIN sponsor_ship_status status ON status.id=value.sponsor_ship_status_id WHERE status.id IS NULL) AS assignmentsWithoutStatus,
      (SELECT COUNT(*) FROM funds value LEFT JOIN fund_type type ON type.id=value.fund_type_id WHERE type.id IS NULL) AS fundsWithoutType,
      (SELECT COUNT(*) FROM funds value LEFT JOIN individual sponsor ON sponsor.id=value.individual_id WHERE value.individual_id IS NOT NULL AND sponsor.id IS NULL) AS fundsWithoutIndividual,
      (SELECT COUNT(*) FROM funds value LEFT JOIN sponsors sponsor ON sponsor.id=value.sponsors_id WHERE value.sponsors_id IS NOT NULL AND sponsor.id IS NULL) AS fundsWithoutOrganization,
      (SELECT COUNT(*) FROM funds WHERE (individual_id IS NOT NULL)+(sponsors_id IS NOT NULL)+(visitor_id IS NOT NULL)<>1) AS fundsWithoutSingleParty,
      (SELECT COUNT(*) FROM fund_detail value LEFT JOIN funds fund ON fund.id=value.fund_id WHERE fund.id IS NULL) AS allocationsWithoutFund,
      (SELECT COUNT(*) FROM fund_detail value LEFT JOIN beneficiary person ON person.id=value.beneficiary_id WHERE person.id IS NULL) AS allocationsWithoutPerson,
      (SELECT COUNT(*) FROM letter value LEFT JOIN correspondence_type type ON type.id=value.corrospondence_type_id WHERE type.id IS NULL) AS lettersWithoutType,
      (SELECT COUNT(*) FROM visitor value LEFT JOIN visitor_type type ON type.id=value.visitor_type_id WHERE type.id IS NULL) AS visitorsWithoutType`)
      .get(),
  );
  if (
    linkChecks.assignmentsWithoutPerson ||
    linkChecks.assignmentsWithoutSponsor ||
    linkChecks.assignmentsWithoutStatus ||
    linkChecks.fundsWithoutType ||
    linkChecks.fundsWithoutIndividual ||
    linkChecks.fundsWithoutSingleParty ||
    linkChecks.allocationsWithoutFund ||
    linkChecks.lettersWithoutType ||
    linkChecks.visitorsWithoutType
  )
    throw new Error("Required sponsorship links are missing from the legacy source.");

  const rawRanges = database
    .prepare(`SELECT
      (SELECT MIN(substr(status_date,1,10)) FROM beneficeary_sponsors) AS firstAssignmentOn,
      (SELECT MAX(substr(status_date,1,10)) FROM beneficeary_sponsors) AS lastAssignmentOn,
      (SELECT MIN(substr(received_date,1,10)) FROM funds) AS firstFundOn,
      (SELECT MAX(substr(received_date,1,10)) FROM funds) AS lastFundOn,
      (SELECT MIN(substr(recieve_date,1,10)) FROM letter) AS firstLetterOn,
      (SELECT MAX(substr(recieve_date,1,10)) FROM letter) AS lastLetterOn,
      (SELECT MIN(substr(date,1,10)) FROM visitor) AS firstVisitOn,
      (SELECT MAX(substr(date,1,10)) FROM visitor) AS lastVisitOn,
      (SELECT SUM(amount) FROM funds) AS receivedAmount,
      (SELECT SUM(amount) FROM fund_detail) AS allocatedAmount`)
    .get();
  const ranges = {
    ...rawRanges,
    receivedAmount: Number(rawRanges.receivedAmount),
    allocatedAmount: Number(rawRanges.allocatedAmount),
  };
  const assignmentStatuses = database
    .prepare(`SELECT status.name,COUNT(value.id) AS assignments FROM sponsor_ship_status status
      LEFT JOIN beneficeary_sponsors value ON value.sponsor_ship_status_id=status.id
      GROUP BY status.id,status.name ORDER BY assignments DESC`)
    .all()
    .map(numbersExceptName);
  const fundTypes = database
    .prepare(`SELECT type.name,COUNT(fund.id) AS funds,coalesce(SUM(fund.amount),0) AS amount
      FROM fund_type type LEFT JOIN funds fund ON fund.fund_type_id=type.id
      GROUP BY type.id,type.name ORDER BY funds DESC`)
    .all()
    .map(numbersExceptName);
  const report = {
    schemaVersion: 1,
    mode: "sponsorship_history_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: [
        "individual",
        "sponsors",
        "beneficeary_sponsors",
        "funds",
        "fund_detail",
        "letter",
        "visitor",
        "fund_type",
        "sponsor_type",
        "sponsor_category",
        "sponsor_ship_status",
        "correspondence_type",
        "visitor_type",
      ],
      sha256: sourceFingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory,
    linkChecks,
    ranges,
    assignmentStatuses,
    fundTypes,
    proposedPolicy: {
      access: "Require sponsorship.read for all records and sponsorship.manage for mutations.",
      missingOrganizations:
        "Retain 17 individual and two remittance organization identifiers without inventing parent records.",
      missingBeneficiaries:
        "Retain four allocation beneficiary identifiers without inventing person links.",
      editing:
        "Imported sponsorship records remain editable with audit history because the legacy workflows supported correction.",
      emptyTables:
        "Do not import the empty sponsorship and beneficiary_funds tables as evidence of separate workflows.",
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
