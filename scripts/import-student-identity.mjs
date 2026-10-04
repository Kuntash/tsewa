import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  DEFAULT_SOURCE_DATABASE,
  SOURCE_SYSTEM,
  parseArguments,
  rawSql,
  requiredOption,
  sqlLiteral,
  stablePersonId,
  stableUuid,
} from "./lib/person-files.mjs";

// Backfills the student identity details added by migration 0034 from the legacy
// beneficiary table. Only empty target values are filled, so details already
// corrected in Tsewa are never overwritten and the script is safe to re-run.

const PLACEHOLDERS = new Set(["0", "-", "nil", "na", "n/a", "none"]);
const repositoryRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repositoryRoot, "apps/web");
// apps/web is its own pnpm workspace for one-click deploys, so `pnpm exec` there
// cannot resolve the root catalog; call the installed binary directly.
const wrangler = resolve(webRoot, "node_modules/.bin/wrangler");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(repositoryRoot, options.source ?? DEFAULT_SOURCE_DATABASE);
const wranglerConfig = options.config ?? "wrangler.jsonc";
const target = requiredOption(options, "target");
const organizationSlug = requiredOption(options, "organization-slug");
const confirmedDatabaseId = requiredOption(options, "confirm-database-id");
if (!["local", "remote"].includes(target)) throw new Error("--target must be local or remote.");

await assertTargetBinding();

const database = new DatabaseSync(sourcePath, { readOnly: true });
database.exec("PRAGMA query_only = ON");
let workspace;
try {
  const data = readData(database);
  const importedAt = new Date().toISOString();
  workspace = await mkdtemp(join(tmpdir(), "tsewa-student-identity-import-"));
  const sqlPath = join(workspace, "student-identity.sql");
  await writeFile(sqlPath, buildSql(data, importedAt), { encoding: "utf8", mode: 0o600 });
  const result = spawnSync(
    wrangler,
    ["d1", "execute", "DB", `--${target}`, "--config", wranglerConfig, "--file", sqlPath, "--yes"],
    { cwd: webRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`Wrangler did not complete the student identity import: ${safeError(result)}`);
  }
  console.log(
    JSON.stringify({
      target,
      databaseId: confirmedDatabaseId,
      categories: data.categories.length,
      childrenWithCategory: data.people.filter((item) => item.childCategoryId).length,
      childrenWithUnknownCategory: data.unknownCategoryCount,
      greenBookNumbers: data.people.filter((item) => item.greenBookNumber).length,
      previousSchools: data.people.filter((item) => item.previousSchoolName).length,
      transferCertificateNumbers: data.people.filter((item) => item.transferCertificateNumber)
        .length,
      temporaryPersonalDataRemoved: true,
    }),
  );
} finally {
  database.close();
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

function readData(connection) {
  const categories = connection
    .prepare("SELECT id,name FROM child_category ORDER BY id")
    .all()
    .map((row) => ({
      id: stableUuid(`tsewa|${organizationSlug}|child_category|${String(row.id)}`),
      sourceId: String(row.id),
      name: requiredText(row.name, "child category name"),
    }));
  const categoryIds = new Map(categories.map((item) => [item.sourceId, item.id]));
  let unknownCategoryCount = 0;
  const people = connection
    .prepare(
      `SELECT id,type,green_book_no,previous_school_name,prvs_school_tc_no,child_category_id
       FROM beneficiary ORDER BY id`,
    )
    .all()
    .map((row) => {
      const isChild = row.type === 0;
      const sourceCategoryId = optionalText(row.child_category_id);
      const childCategoryId = isChild ? (categoryIds.get(sourceCategoryId ?? "") ?? null) : null;
      if (isChild && sourceCategoryId && !childCategoryId) unknownCategoryCount += 1;
      return {
        id: stablePersonId(organizationSlug, "beneficiary", String(row.id)),
        greenBookNumber: recordedText(row.green_book_no),
        previousSchoolName: isChild ? recordedText(row.previous_school_name) : null,
        transferCertificateNumber: isChild ? recordedText(row.prvs_school_tc_no) : null,
        childCategoryId,
      };
    });
  return { categories, people, unknownCategoryCount };
}

function buildSql(data, importedAt) {
  const organizationId = rawSql(
    `(SELECT id FROM organization WHERE slug=${sqlLiteral(organizationSlug)})`,
  );
  const statements = [];
  for (const item of data.categories) {
    statements.push(
      `INSERT INTO child_category
         (id,organization_id,name,is_active,source_system,source_table,source_id,imported_at,created_at,updated_at)
       VALUES (${[
         item.id,
         organizationId,
         item.name,
         1,
         SOURCE_SYSTEM,
         "child_category",
         item.sourceId,
         importedAt,
         importedAt,
         importedAt,
       ]
         .map(sqlLiteral)
         .join(",")})
       ON CONFLICT(organization_id,source_system,source_table,source_id) DO NOTHING`,
    );
  }

  const peopleByCategory = Map.groupBy(
    data.people.filter((item) => item.childCategoryId),
    (item) => item.childCategoryId,
  );
  for (const [childCategoryId, people] of peopleByCategory) {
    for (let offset = 0; offset < people.length; offset += 50) {
      const ids = people
        .slice(offset, offset + 50)
        .map((item) => sqlLiteral(item.id))
        .join(",");
      statements.push(
        `UPDATE person SET child_category_id=${sqlLiteral(childCategoryId)}
         WHERE organization_id=${organizationId.sql} AND kind='child'
           AND child_category_id IS NULL AND id IN (${ids})`,
      );
    }
  }

  for (const item of data.people) {
    if (!item.greenBookNumber && !item.previousSchoolName && !item.transferCertificateNumber) {
      continue;
    }
    statements.push(
      `UPDATE person
       SET green_book_number=COALESCE(green_book_number,${sqlLiteral(item.greenBookNumber)}),
           previous_school_name=COALESCE(previous_school_name,${sqlLiteral(item.previousSchoolName)}),
           transfer_certificate_number=COALESCE(transfer_certificate_number,${sqlLiteral(item.transferCertificateNumber)})
       WHERE organization_id=${organizationId.sql} AND id=${sqlLiteral(item.id)}`,
    );
  }
  return `${statements.join(";\n\n")};\n`;
}

async function assertTargetBinding() {
  const configuration = await readFile(resolve(webRoot, wranglerConfig), "utf8");
  if (!configuration.includes(confirmedDatabaseId)) {
    throw new Error(`The confirmed database ID is not present in apps/web/${wranglerConfig}.`);
  }
  const result = spawnSync(wrangler, ["d1", "info", "DB", "--json", "--config", wranglerConfig], {
    cwd: webRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let liveDatabaseId = "";
  try {
    liveDatabaseId = JSON.parse(result.stdout).uuid;
  } catch {
    // The generic mismatch below intentionally avoids exposing command output.
  }
  if (result.status !== 0 || liveDatabaseId !== confirmedDatabaseId) {
    throw new Error("The live DB binding does not match --confirm-database-id.");
  }
}

function safeError(result) {
  return String(result.stderr || result.stdout || "unknown error")
    .replaceAll(/[\w.+-]+@[\w.-]+/g, "[email]")
    .slice(0, 1_000);
}

function recordedText(value) {
  const result = optionalText(value);
  return result && !PLACEHOLDERS.has(result.toLowerCase()) ? result : null;
}

function requiredText(value, label) {
  const result = optionalText(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}
