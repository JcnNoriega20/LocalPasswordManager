"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databasePath = exports.dataDirectory = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
// Stable across `npm run dev` (src/) and `npm start` (dist/).
// Tests and portable installations may override the directory explicitly.
const dataDirectory = node_path_1.default.resolve(process.env.LPM_DATA_DIR || node_path_1.default.join(__dirname, "../../data"));
exports.dataDirectory = dataDirectory;
if (!node_fs_1.default.existsSync(dataDirectory)) {
    node_fs_1.default.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
}
const databasePath = node_path_1.default.join(dataDirectory, "vault.db");
exports.databasePath = databasePath;
const db = new better_sqlite3_1.default(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("secure_delete = ON");
exports.default = db;
