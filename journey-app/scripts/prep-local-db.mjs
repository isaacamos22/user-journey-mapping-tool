/**
 * Copies prisma/dev.db to %LOCALAPPDATA%/journey-mapping-tool/dev.db (writable on OneDrive setups).
 * Prints the DATABASE_URL to add to .env
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const source = path.join(appRoot, "prisma", "dev.db");

const localDir =
  process.env.JOURNEY_DB_DIR ||
  path.join(process.env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local"), "journey-mapping-tool");

mkdirSync(localDir, { recursive: true });
const dest = path.join(localDir, "dev.db");

if (existsSync(source) && (!existsSync(dest) || process.argv.includes("--force"))) {
  copyFileSync(source, dest);
  console.log("Copied database to:", dest);
} else if (existsSync(dest)) {
  console.log("Database already at:", dest);
} else {
  console.log("No prisma/dev.db to copy — run npx prisma migrate dev first.");
}

const url = `file:${dest.replace(/\\/g, "/")}`;
console.log("\nSet in .env:\n");
console.log(`DATABASE_URL="${url}"`);