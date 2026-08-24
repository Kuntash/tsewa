import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DEFAULT_SOURCE_DATABASE, parseArguments, sha256File } from "./lib/person-files.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const outputPath = resolve(
  repositoryRoot,
  options.output ?? "reports/staff-operations-dry-run.json",
);
const sourceBefore = await stat(sourcePath);
const fingerprint = await sha256File(sourcePath);
const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");

try {
  const inventory = numbers(
    database
      .prepare(`SELECT
        (SELECT COUNT(*) FROM staff) staff,
        (SELECT COUNT(*) FROM department) departments,
        (SELECT COUNT(*) FROM designation) designations,
        (SELECT COUNT(*) FROM staff_category) categories,
        (SELECT COUNT(*) FROM staff_designation) employmentEvents`)
      .get(),
  );
  const links = numbers(
    database
      .prepare(`SELECT
        (SELECT COUNT(*) FROM staff value LEFT JOIN department item ON item.id=value.department_id
          WHERE value.department_id IS NOT NULL AND item.id IS NULL) staffMissingDepartment,
        (SELECT COUNT(*) FROM staff value LEFT JOIN designation item ON item.id=value.designation_id
          WHERE value.designation_id IS NOT NULL AND item.id IS NULL) staffMissingDesignation,
        (SELECT COUNT(*) FROM staff value LEFT JOIN staff_category item ON item.id=value.catogary_id
          WHERE value.catogary_id IS NOT NULL AND item.id IS NULL) staffMissingCategory,
        (SELECT COUNT(*) FROM staff_designation value LEFT JOIN staff item ON item.id=value.staff_id
          WHERE item.id IS NULL) employmentEventsMissingStaff,
        (SELECT COUNT(*) FROM staff_designation value LEFT JOIN department item ON item.id=value.department_id
          WHERE value.department_id IS NOT NULL AND item.id IS NULL) eventsMissingDepartment,
        (SELECT COUNT(*) FROM staff_designation value LEFT JOIN designation item ON item.id=value.designation_id
          WHERE value.designation_id IS NOT NULL AND item.id IS NULL) eventsMissingDesignation`)
      .get(),
  );
  if (
    links.employmentEventsMissingStaff ||
    links.staffMissingCategory ||
    links.eventsMissingDesignation
  ) {
    throw new Error("Required staff relationships do not reconcile.");
  }
  const status = database
    .prepare("SELECT status,COUNT(*) count FROM staff GROUP BY status ORDER BY status")
    .all()
    .map(numbers);
  const report = {
    schemaVersion: 1,
    mode: "staff_operations_dry_run",
    generatedAt: new Date().toISOString(),
    privacy: { classification: "aggregate-only", containsPersonalData: false },
    source: {
      system: "THF Office Manager",
      database: "tibethomes-newer-d1.sqlite",
      tables: [
        "staff",
        "department",
        "designation",
        "staff_category",
        "staff_designation",
        "transfer_reason",
        "location",
      ],
      sha256: fingerprint,
      sizeBytes: sourceBefore.size,
      openedReadOnly: true,
    },
    inventory,
    links,
    status,
    proposedPolicy: {
      access: "Require staff.read for directory access and staff.manage for audited edits.",
      missingCatalogLinks:
        "Retain missing legacy department and designation identifiers without inventing catalog rows.",
      scope:
        "Import employment, department, designation, official contact, and the nine recorded employment events. Leave remains a later slice.",
    },
  };
  const sourceAfter = await stat(sourcePath);
  if (
    sourceAfter.size !== sourceBefore.size ||
    sourceAfter.mtimeMs !== sourceBefore.mtimeMs ||
    (await sha256File(sourcePath)) !== fingerprint
  ) {
    throw new Error("The legacy source changed during the staff dry run.");
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ report: relative(repositoryRoot, outputPath), ...inventory }));
} finally {
  database.close();
}

function numbers(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item)]));
}
