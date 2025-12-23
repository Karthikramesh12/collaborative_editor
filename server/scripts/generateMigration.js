#!/usr/bin/env node
const { exec } = require("child_process");
const path = require("path");

// Get migration name
const migrationName = process.argv[2];

if (!migrationName) {
  console.error("❌ Please provide a migration name, e.g., npm run gen:migration add_posts_table");
  process.exit(1);
}

if (!/^[a-zA-Z0-9_]+$/.test(migrationName)) {
  console.error("❌ Migration name should only contain letters, numbers, and underscores");
  process.exit(1);
}

const cwd = path.join(__dirname, "..");

function run(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n⏳ ${description}: ${command}`);
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

(async () => {
  try {
    await run("npx prisma generate", "Generating Prisma Client");

    const migrateResult = await run(`npx prisma migrate dev --name ${migrationName}`, "Running migration");
    console.log(migrateResult.stdout);
    if (/drift detected|reset the/i.test(migrateResult.stdout + migrateResult.stderr)) {
      console.warn("⚠️ Drift detected. Resetting database...");
      const resetResult = await run("npx prisma migrate reset --force", "Resetting database");
      console.log(resetResult.stdout);
      // Re-run migration after reset
      const migrateResult2 = await run(`npx prisma migrate dev --name ${migrationName}`, "Re-running migration");
      console.log(migrateResult2.stdout);
      console.log(`✅ Migration '${migrationName}' completed successfully after reset!`);
    } else {
      console.log(`✅ Migration '${migrationName}' completed successfully!`);
    }
    console.log("📁 Check prisma/migrations/ folder for the generated files");
  } catch ({ error, stdout, stderr }) {
    console.error("❌ Migration failed:");
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    console.error(error.message);
    process.exit(1);
  }
})();