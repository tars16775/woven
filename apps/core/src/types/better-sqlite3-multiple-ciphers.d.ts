// The cipher build ships the same API as better-sqlite3 but its "exports" map hides its own typings from TypeScript.
declare module "better-sqlite3-multiple-ciphers" {
  import Database from "better-sqlite3";
  export = Database;
}
