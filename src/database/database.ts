import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Stable across `npm run dev` (src/) and `npm start` (dist/).
// Tests and portable installations may override the directory explicitly.
const dataDirectory = path.resolve(
  process.env.LPM_DATA_DIR || path.join(__dirname, "../../data")
);

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
}

const databasePath = path.join(dataDirectory, "vault.db");
const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("secure_delete = ON");

export { dataDirectory, databasePath };
export default db;
