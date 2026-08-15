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
const reportPath = resolve(
  repositoryRoot,
  options.report ?? "reports/sponsorship-history-dry-run.json",
);
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
  assertCounts(data);
  const importedAt = new Date().toISOString();
  const batchId = `sponsorship-history-${sourceFingerprint.slice(0, 16)}-v1`;
  const sql = buildSql(data, batchId, importedAt);
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== sourceFingerprint
  )
    throw new Error("The legacy source changed while preparing the import.");
  workspace = await mkdtemp(join(tmpdir(), "tsewa-sponsorship-import-"));
  const sqlPath = join(workspace, "sponsorship-history.sql");
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", `--${target}`, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0)
    throw new Error(`Wrangler did not complete the sponsorship import: ${safeError(result)}`);
  console.log(
    JSON.stringify({
      target,
      databaseId: confirmedDatabaseId,
      batchId,
      ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])),
      sourceUnchanged: true,
      temporaryPersonalDataRemoved: true,
    }),
  );
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readData(connection) {
  const beneficiaryIds = new Set(
    connection
      .prepare("SELECT id FROM beneficiary")
      .all()
      .map((row) => text(row.id)),
  );
  const organizations = connection
    .prepare("SELECT * FROM sponsors ORDER BY id")
    .all()
    .map((row) => ({
      id: id("sponsors", row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, "sponsor organization name"),
      countryName: optionalText(row.sponsor_country),
      supportsChildren: booleanNumber(row.children_support),
      supportsElderly: booleanNumber(row.elderly_support),
    }));
  const legacyOrganizationIds = new Set(organizations.map((item) => item.sourceId));
  const sponsorTypes = catalog(connection, "sponsor_type");
  const sponsorCategories = catalog(connection, "sponsor_category");
  const statuses = catalog(connection, "sponsor_ship_status");
  const fundTypes = catalog(connection, "fund_type");
  const correspondenceTypes = catalog(connection, "correspondence_type");
  const visitorTypes = catalog(connection, "visitor_type");
  const individuals = connection
    .prepare(`SELECT value.*,country.country AS country_name FROM individual value
      LEFT JOIN nationality country ON country.id=value.country_id ORDER BY value.id`)
    .all()
    .map((row) => ({
      id: id("individual", row.id),
      sourceId: text(row.id),
      sponsorOrganizationId: legacyOrganizationIds.has(text(row.sponsor_id))
        ? id("sponsors", row.sponsor_id)
        : null,
      legacySponsorOrganizationId: optionalText(row.sponsor_id),
      sponsorTypeId: optionalId("sponsor_type", row.sponsor_type_id),
      sponsorCategoryId: optionalId("sponsor_category", row.sponsor_category_id),
      firstName: requiredText(row.first_name, "individual first name"),
      middleName: optionalText(row.middle_name),
      lastName: optionalText(row.sur_name),
      displayName: displayName(row.first_name, row.middle_name, row.sur_name),
      address: joinedText(row.address1, row.address2, row.address3, row.address4),
      countryName: optionalText(row.country_name),
      email: optionalText(row.email),
      phone: optionalText(row.phone),
    }));
  const legacyIndividualIds = new Set(individuals.map((item) => item.sourceId));
  const assignments = connection
    .prepare("SELECT * FROM beneficeary_sponsors ORDER BY id")
    .all()
    .map((row) => ({
      id: id("beneficeary_sponsors", row.id),
      sourceId: text(row.id),
      personId: stablePersonId(organizationSlug, "beneficiary", row.beneficiary_id),
      sponsorIndividualId: id("individual", row.individual_id),
      statusId: id("sponsor_ship_status", row.sponsor_ship_status_id),
      sessionId: optionalId("session", row.session_id),
      statusOn: requiredDate(row.status_date, "assignment status date"),
      remarks: optionalText(row.remarks),
    }));
  const visitors = connection
    .prepare(`SELECT value.*,country.country AS country_name FROM visitor value
      LEFT JOIN nationality country ON country.id=value.nationality_id ORDER BY value.id`)
    .all()
    .map((row) => ({
      id: id("visitor", row.id),
      sourceId: text(row.id),
      visitorTypeId: optionalId("visitor_type", row.visitor_type_id),
      firstName: requiredText(row.first_name, "visitor first name"),
      middleName: optionalText(row.middle_name),
      lastName: optionalText(row.sur_name),
      displayName: displayName(row.first_name, row.middle_name, row.sur_name),
      address: joinedText(row.address1, row.address2, row.address3, row.address4),
      countryName: optionalText(row.country_name),
      email: optionalText(row.email),
      phone: optionalText(row.phone),
      relatedPersonName: optionalText(row.nameof_chaild_elderly),
      visitedOn: requiredDate(row.date, "visit date"),
      mementoQuantity: optionalInteger(row.momento_qty_issue),
      giftsPresented: optionalText(row.gifts_presented),
      visitSummary: optionalText(row.summaryof_visit),
      comments: optionalText(row.comments),
    }));
  const legacyVisitorIds = new Set(visitors.map((item) => item.sourceId));
  const funds = connection
    .prepare("SELECT * FROM funds ORDER BY id")
    .all()
    .map((row) => {
      const sponsorKind =
        row.individual_id != null
          ? "individual"
          : row.sponsors_id != null
            ? "organization"
            : "visitor";
      const legacyPartyId = text(row.individual_id ?? row.sponsors_id ?? row.visitor_id);
      return {
        id: id("funds", row.id),
        sourceId: text(row.id),
        fundTypeId: id("fund_type", row.fund_type_id),
        sessionId: optionalId("session", row.session_id),
        sponsorKind,
        sponsorIndividualId:
          sponsorKind === "individual" && legacyIndividualIds.has(legacyPartyId)
            ? id("individual", legacyPartyId)
            : null,
        sponsorOrganizationId:
          sponsorKind === "organization" && legacyOrganizationIds.has(legacyPartyId)
            ? id("sponsors", legacyPartyId)
            : null,
        visitorId:
          sponsorKind === "visitor" && legacyVisitorIds.has(legacyPartyId)
            ? id("visitor", legacyPartyId)
            : null,
        legacySponsorPartyId: legacyPartyId,
        receivedOn: requiredDate(row.received_date, "fund received date"),
        periodFrom: optionalDate(row.from_date),
        periodTo: optionalDate(row.to_date),
        amount: requiredNumber(row.amount, "fund amount"),
        receiptNumber: optionalText(row.receipt_no),
        remarks: optionalText(row.remarks),
      };
    });
  const allocations = connection
    .prepare("SELECT * FROM fund_detail ORDER BY id")
    .all()
    .map((row) => ({
      id: id("fund_detail", row.id),
      sourceId: text(row.id),
      fundId: id("funds", row.fund_id),
      personId: beneficiaryIds.has(text(row.beneficiary_id))
        ? stablePersonId(organizationSlug, "beneficiary", row.beneficiary_id)
        : null,
      legacyBeneficiaryId: optionalText(row.beneficiary_id),
      sessionId: optionalId("session", row.session_id),
      amount: requiredNumber(row.amount, "fund allocation amount"),
      receiptNumber: optionalText(row.receipt_no),
      periodFrom: optionalDate(row.date_from),
      periodTo: optionalDate(row.date_to),
      remarks: optionalText(row.remarks),
    }));
  const letters = connection
    .prepare("SELECT * FROM letter ORDER BY id")
    .all()
    .map((row) => ({
      id: id("letter", row.id),
      sourceId: text(row.id),
      correspondenceTypeId: id("correspondence_type", row.corrospondence_type_id),
      sponsorIndividualId: row.sponsor_id == null ? null : id("individual", row.sponsor_id),
      personId:
        row.beneficiary_id == null
          ? null
          : stablePersonId(organizationSlug, "beneficiary", row.beneficiary_id),
      sessionId: optionalId("session", row.session_id),
      sender: optionalText(row.sender),
      receiver: optionalText(row.receiver),
      receivedOn: requiredDate(row.recieve_date, "correspondence received date"),
      repliedOn: optionalDate(row.reply_date),
      replyDueOn: optionalDate(row.letter_reply_deadline_date),
      remarks: optionalText(row.letter_remarks),
    }));
  return {
    organizations,
    sponsorTypes,
    sponsorCategories,
    statuses,
    individuals,
    assignments,
    fundTypes,
    visitorTypes,
    visitors,
    funds,
    allocations,
    correspondenceTypes,
    letters,
  };
}

function buildSql(data, batchId, importedAt) {
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
  const source = [
    "source_system",
    "source_table",
    "source_id",
    "import_batch_id",
    "imported_at",
    "created_at",
    "updated_at",
  ];
  const statements = [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO sponsorship_import_batch (id,organization_id,source_system,source_database,source_fingerprint,status,individual_count,assignment_count,fund_count,allocation_count,started_at,created_at) VALUES (${sqlLiteral(batchId)},${organizationId.sql},${sqlLiteral(SOURCE_SYSTEM)},'tibethomes-newer-d1.sqlite',${sqlLiteral(report.source.sha256)},'running',${data.individuals.length},${data.assignments.length},${data.funds.length},${data.allocations.length},${sqlLiteral(importedAt)},${sqlLiteral(importedAt)}) ON CONFLICT(id) DO UPDATE SET status='running',started_at=excluded.started_at,finished_at=NULL`,
  ];
  addCatalog(
    statements,
    "sponsorship_sponsor_type",
    "sponsor_type",
    data.sponsorTypes,
    organizationId,
    common,
    source,
  );
  addCatalog(
    statements,
    "sponsorship_sponsor_category",
    "sponsor_category",
    data.sponsorCategories,
    organizationId,
    common,
    source,
  );
  addCatalog(
    statements,
    "sponsorship_status",
    "sponsor_ship_status",
    data.statuses,
    organizationId,
    common,
    source,
  );
  addCatalog(
    statements,
    "sponsorship_fund_type",
    "fund_type",
    data.fundTypes,
    organizationId,
    common,
    source,
  );
  addCatalog(
    statements,
    "sponsorship_visitor_type",
    "visitor_type",
    data.visitorTypes,
    organizationId,
    common,
    source,
  );
  addCatalog(
    statements,
    "sponsorship_correspondence_type",
    "correspondence_type",
    data.correspondenceTypes,
    organizationId,
    common,
    source,
  );
  add(
    statements,
    "sponsorship_organization",
    [
      "id",
      "organization_id",
      "name",
      "country_name",
      "supports_children",
      "supports_elderly",
      "is_active",
      ...source,
    ],
    data.organizations.map((x) => [
      x.id,
      organizationId,
      x.name,
      x.countryName,
      x.supportsChildren,
      x.supportsElderly,
      1,
      ...common("sponsors", x),
    ]),
  );
  add(
    statements,
    "sponsorship_individual",
    [
      "id",
      "organization_id",
      "sponsor_organization_id",
      "legacy_sponsor_organization_id",
      "sponsor_type_id",
      "sponsor_category_id",
      "first_name",
      "middle_name",
      "last_name",
      "display_name",
      "address",
      "country_name",
      "email",
      "phone",
      "is_active",
      ...source,
    ],
    data.individuals.map((x) => [
      x.id,
      organizationId,
      x.sponsorOrganizationId,
      x.legacySponsorOrganizationId,
      x.sponsorTypeId,
      x.sponsorCategoryId,
      x.firstName,
      x.middleName,
      x.lastName,
      x.displayName,
      x.address,
      x.countryName,
      x.email,
      x.phone,
      1,
      ...common("individual", x),
    ]),
  );
  add(
    statements,
    "sponsorship_assignment",
    [
      "id",
      "organization_id",
      "person_id",
      "sponsor_individual_id",
      "sponsorship_status_id",
      "academic_session_id",
      "status_on",
      "remarks",
      ...source,
    ],
    data.assignments.map((x) => [
      x.id,
      organizationId,
      x.personId,
      x.sponsorIndividualId,
      x.statusId,
      x.sessionId,
      x.statusOn,
      x.remarks,
      ...common("beneficeary_sponsors", x),
    ]),
  );
  add(
    statements,
    "sponsorship_visitor",
    [
      "id",
      "organization_id",
      "visitor_type_id",
      "first_name",
      "middle_name",
      "last_name",
      "display_name",
      "address",
      "country_name",
      "email",
      "phone",
      "related_person_name",
      "visited_on",
      "memento_quantity",
      "gifts_presented",
      "visit_summary",
      "comments",
      ...source,
    ],
    data.visitors.map((x) => [
      x.id,
      organizationId,
      x.visitorTypeId,
      x.firstName,
      x.middleName,
      x.lastName,
      x.displayName,
      x.address,
      x.countryName,
      x.email,
      x.phone,
      x.relatedPersonName,
      x.visitedOn,
      x.mementoQuantity,
      x.giftsPresented,
      x.visitSummary,
      x.comments,
      ...common("visitor", x),
    ]),
  );
  add(
    statements,
    "sponsorship_fund",
    [
      "id",
      "organization_id",
      "fund_type_id",
      "academic_session_id",
      "sponsor_kind",
      "sponsor_individual_id",
      "sponsor_organization_id",
      "visitor_id",
      "legacy_sponsor_party_id",
      "received_on",
      "period_from",
      "period_to",
      "amount",
      "receipt_number",
      "remarks",
      ...source,
    ],
    data.funds.map((x) => [
      x.id,
      organizationId,
      x.fundTypeId,
      x.sessionId,
      x.sponsorKind,
      x.sponsorIndividualId,
      x.sponsorOrganizationId,
      x.visitorId,
      x.legacySponsorPartyId,
      x.receivedOn,
      x.periodFrom,
      x.periodTo,
      x.amount,
      x.receiptNumber,
      x.remarks,
      ...common("funds", x),
    ]),
  );
  add(
    statements,
    "sponsorship_fund_allocation",
    [
      "id",
      "organization_id",
      "fund_id",
      "person_id",
      "legacy_beneficiary_id",
      "academic_session_id",
      "amount",
      "receipt_number",
      "period_from",
      "period_to",
      "remarks",
      ...source,
    ],
    data.allocations.map((x) => [
      x.id,
      organizationId,
      x.fundId,
      x.personId,
      x.legacyBeneficiaryId,
      x.sessionId,
      x.amount,
      x.receiptNumber,
      x.periodFrom,
      x.periodTo,
      x.remarks,
      ...common("fund_detail", x),
    ]),
  );
  add(
    statements,
    "sponsorship_letter",
    [
      "id",
      "organization_id",
      "correspondence_type_id",
      "sponsor_individual_id",
      "person_id",
      "academic_session_id",
      "sender",
      "receiver",
      "received_on",
      "replied_on",
      "reply_due_on",
      "remarks",
      ...source,
    ],
    data.letters.map((x) => [
      x.id,
      organizationId,
      x.correspondenceTypeId,
      x.sponsorIndividualId,
      x.personId,
      x.sessionId,
      x.sender,
      x.receiver,
      x.receivedOn,
      x.repliedOn,
      x.replyDueOn,
      x.remarks,
      ...common("letter", x),
    ]),
  );
  statements.push(
    `UPDATE sponsorship_import_batch SET status='completed',finished_at=${sqlLiteral(importedAt)} WHERE id=${sqlLiteral(batchId)}`,
  );
  return `${statements.join(";\n\n")};\n`;
}

function addCatalog(statements, targetTable, sourceTable, rows, organizationId, common, source) {
  add(
    statements,
    targetTable,
    ["id", "organization_id", "name", "is_active", ...source],
    rows.map((x) => [x.id, organizationId, x.name, 1, ...common(sourceTable, x)]),
  );
}
function add(statements, table, columns, rows, chunkSize = 25) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const values = rows
      .slice(index, index + chunkSize)
      .map((row) => `(${row.map(sqlValue).join(",")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES\n${values}\nON CONFLICT(organization_id,source_system,source_table,source_id) DO UPDATE SET ${columns
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
        .join(",")}`,
    );
  }
}
function catalog(connection, table) {
  return connection
    .prepare(`SELECT id,name FROM ${table} ORDER BY id`)
    .all()
    .map((row) => ({
      id: id(table, row.id),
      sourceId: text(row.id),
      name: requiredText(row.name, table),
    }));
}
function sqlValue(value) {
  return value && typeof value === "object" && "sql" in value ? value.sql : sqlLiteral(value);
}
function id(table, sourceId) {
  return stableUuid(`tsewa|${organizationSlug}|${table}|${text(sourceId)}`);
}
function optionalId(table, value) {
  return value == null ? null : id(table, value);
}
function text(value) {
  return String(value);
}
function optionalText(value) {
  return value == null ? null : String(value).trim() || null;
}
function requiredText(value, label) {
  const result = optionalText(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}
function joinedText(...values) {
  return values.map(optionalText).filter(Boolean).join("\n") || null;
}
function displayName(...values) {
  const result = values.map(optionalText).filter(Boolean).join(" ");
  if (!result) throw new Error("Missing display name.");
  return result;
}
function optionalNumber(value) {
  if (value == null || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid number ${value}`);
  return result;
}
function requiredNumber(value, label) {
  const result = optionalNumber(value);
  if (result == null) throw new Error(`Missing ${label}.`);
  return result;
}
function optionalInteger(value) {
  const result = optionalNumber(value);
  return result == null ? null : Math.trunc(result);
}
function booleanNumber(value) {
  return Number(value) ? 1 : 0;
}
function optionalDate(value) {
  return optionalText(value)?.slice(0, 10) ?? null;
}
function requiredDate(value, label) {
  const result = optionalDate(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}
function assertCounts(data) {
  const mapping = {
    individuals: "individuals",
    organizations: "organizations",
    assignments: "assignments",
    funds: "funds",
    allocations: "allocations",
    letters: "letters",
    visitors: "visitors",
    fundTypes: "fundTypes",
    sponsorTypes: "sponsorTypes",
    sponsorCategories: "sponsorCategories",
    statuses: "statuses",
    correspondenceTypes: "correspondenceTypes",
    visitorTypes: "visitorTypes",
  };
  for (const [key, targetKey] of Object.entries(mapping))
    if (data[targetKey].length !== Number(report.inventory[key]))
      throw new Error(`${key} count does not match dry run.`);
}
function assertReport(value) {
  if (
    value?.mode !== "sponsorship_history_dry_run" ||
    value?.schemaVersion !== 1 ||
    value?.privacy?.containsPersonalData !== false ||
    Number(value?.linkChecks?.assignmentsWithoutPerson) ||
    Number(value?.linkChecks?.assignmentsWithoutSponsor) ||
    Number(value?.linkChecks?.assignmentsWithoutStatus) ||
    Number(value?.linkChecks?.fundsWithoutType) ||
    Number(value?.linkChecks?.fundsWithoutIndividual) ||
    Number(value?.linkChecks?.fundsWithoutSingleParty) ||
    Number(value?.linkChecks?.allocationsWithoutFund) ||
    Number(value?.linkChecks?.lettersWithoutType) ||
    Number(value?.linkChecks?.visitorsWithoutType)
  )
    throw new Error("The reviewed sponsorship dry run has not cleared import gates.");
}
function safeError(result) {
  return (
    `${result.stdout}\n${result.stderr}`
      .split("\n")
      .filter((line) => /error|failed|constraint|no such/i.test(line))
      .slice(-5)
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
