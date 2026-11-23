"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataDirectory = path_1.default.join(process.cwd(), "data");
if (!fs_1.default.existsSync(dataDirectory)) {
    fs_1.default.mkdirSync(dataDirectory, { recursive: true });
}
const databasePath = path_1.default.join(dataDirectory, "vault.db");
const db = new better_sqlite3_1.default(databasePath);
db.pragma("journal_mode = WAL");
exports.default = db;
