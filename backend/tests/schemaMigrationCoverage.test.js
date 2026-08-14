const fs = require("fs");
const path = require("path");

// P0 regression guard: schema.prisma models that have zero corresponding migration in
// prisma/migrations/ never actually get created on a database built from `prisma migrate
// deploy`. That's exactly what happened to business_settings and branch_allocation_preferences —
// they were introspected into schema.prisma from a hand-built environment but no migration ever
// created them, so registration and allocation-weight saves failed with "Could not find the
// table ... in the schema cache" everywhere else. This test parses schema.prisma and every
// migration.sql the same way a human did to find that bug, so a new model added without a
// migration fails CI instead of failing at runtime in front of a user.

const SCHEMA_PATH = path.join(__dirname, "../prisma/schema.prisma");
const MIGRATIONS_DIR = path.join(__dirname, "../prisma/migrations");

function getModelNames() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  const modelNames = [];
  const modelRegex = /^model\s+(\w+)\s*\{/gm;
  let match;
  while ((match = modelRegex.exec(schema)) !== null) {
    modelNames.push(match[1]);
  }
  return modelNames;
}

function getCreatedTableNames() {
  const created = new Set();
  const migrationDirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const dir of migrationDirs) {
    const sqlPath = path.join(MIGRATIONS_DIR, dir.name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, "utf8");
    // Matches both `CREATE TABLE "name"` and `CREATE TABLE IF NOT EXISTS "name"`.
    const createRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"(\w+)"/gi;
    let match;
    while ((match = createRegex.exec(sql)) !== null) {
      created.add(match[1]);
    }
  }
  return created;
}

test("every model in schema.prisma has a CREATE TABLE in some migration", () => {
  const modelNames = getModelNames();
  const createdTableNames = getCreatedTableNames();

  const missing = modelNames.filter((name) => !createdTableNames.has(name));

  expect(missing).toEqual([]);
});
