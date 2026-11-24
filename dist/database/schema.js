"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
// The first released schema did not contain format_version. Adding it with a
// default of 1 marks existing vaults for the metadata-encryption migration.
database_1.default.exec(`
  CREATE TABLE IF NOT EXISTS vault_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    salt TEXT NOT NULL,
    verifier TEXT NOT NULL,
    created_at TEXT NOT NULL,
    format_version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
const metadataColumns = database_1.default
    .prepare("PRAGMA table_info(vault_metadata)")
    .all();
if (!metadataColumns.some((column) => column.name === "format_version")) {
    database_1.default.exec("ALTER TABLE vault_metadata ADD COLUMN format_version INTEGER NOT NULL DEFAULT 1");
}
console.log("Base de datos inicializada correctamente.");
