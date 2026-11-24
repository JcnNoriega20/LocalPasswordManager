declare module "csv-parser" {
  import { Transform } from "node:stream";

  interface CsvParserOptions {
    separator?: string;
    quote?: string;
    escape?: string;
    headers?: string[] | boolean;
    skipLines?: number;
    strict?: boolean;
    maxRowBytes?: number;
    mapHeaders?: (args: { header: string; index: number }) => string | null;
    mapValues?: (args: { header: string; index: number; value: string }) => string;
  }

  function csvParser(options?: CsvParserOptions): Transform;
  export = csvParser;
}
